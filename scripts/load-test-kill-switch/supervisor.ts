/**
 * Load-test kill-switch supervisor.
 *
 * Wraps `k6 run` and holds unconditional authority to terminate it: it tails
 * k6's own streamed --out json output (confirmed to flush incrementally
 * during a run, not just at exit - see scripts/load-test-kill-switch), keeps
 * a true rolling-window computation of http_req_duration p95 and
 * http_req_failed rate, and sends SIGTERM (escalating to SIGKILL after a
 * grace period) to the k6 child process the instant either window breaches
 * its threshold. No human has to watch the run or react in time.
 *
 * Exit codes:
 *   0   k6 completed, all thresholds passed
 *   99  k6 completed, at least one threshold failed (k6's own exit code)
 *   77  supervisor aborted the run mid-flight (kill-switch fired)
 *   1+  other failure (k6 failed to start, etc.)
 *
 * Usage:
 *   npx tsx scripts/load-test-kill-switch/supervisor.ts \
 *     --script load-tests/k6-config.js \
 *     --out load-tests/results/nr4-run.json \
 *     --p95-threshold-ms 10000 --p95-window-s 60 \
 *     --error-rate-threshold 0.05 --error-window-s 30 \
 *     --check-interval-ms 3000 --min-samples 20
 *
 * Any trailing args after -- are passed through to `k6 run` verbatim.
 */
import { spawn, type ChildProcess } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

type Sample = { t: number; v: number }

interface Config {
  script: string
  outFile: string
  p95ThresholdMs: number
  p95WindowMs: number
  errorRateThreshold: number
  errorWindowMs: number
  checkIntervalMs: number
  minSamples: number
  graceMs: number
  eventFile: string
  extraArgs: string[]
}

function parseArgs(argv: string[]): Config {
  const get = (flag: string, def: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : def
  }
  const dashDash = argv.indexOf("--")
  const extraArgs = dashDash >= 0 ? argv.slice(dashDash + 1) : []

  return {
    script: get("--script", ""),
    outFile: get("--out", "load-tests/results/supervisor-run.json"),
    p95ThresholdMs: Number(get("--p95-threshold-ms", "10000")),
    p95WindowMs: Number(get("--p95-window-s", "60")) * 1000,
    errorRateThreshold: Number(get("--error-rate-threshold", "0.05")),
    errorWindowMs: Number(get("--error-window-s", "30")) * 1000,
    checkIntervalMs: Number(get("--check-interval-ms", "3000")),
    minSamples: Number(get("--min-samples", "20")),
    graceMs: Number(get("--grace-ms", "10000")),
    eventFile: get("--event-file", "load-tests/results/supervisor-abort-event.json"),
    extraArgs,
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length))
  return sorted[idx]
}

function log(msg: string) {
  console.log(`[kill-switch] ${new Date().toISOString()} ${msg}`)
}

async function main() {
  const cfg = parseArgs(process.argv.slice(2))
  if (!cfg.script) {
    console.error("Usage: supervisor.ts --script <k6-script> [options] [-- extra k6 args]")
    process.exit(2)
  }

  fs.mkdirSync(path.dirname(cfg.outFile), { recursive: true })
  // Start from a clean output file so byte-offset tailing is unambiguous.
  fs.writeFileSync(cfg.outFile, "")

  log(
    `starting k6 run ${cfg.script} | abort criteria: p95>${cfg.p95ThresholdMs}ms sustained ${cfg.p95WindowMs / 1000}s OR error-rate>${cfg.errorRateThreshold * 100}% sustained ${cfg.errorWindowMs / 1000}s (min ${cfg.minSamples} samples per window)`
  )

  const k6Args = ["run", cfg.script, "--out", `json=${cfg.outFile}`, ...cfg.extraArgs]
  const child: ChildProcess = spawn("k6", k6Args, { stdio: "inherit" })

  let offset = 0
  let partial = ""
  const durationSamples: Sample[] = []
  const failedSamples: Sample[] = []
  let aborted = false
  let k6Exited = false
  let k6ExitCode: number | null = null

  function pruneOld(arr: Sample[], now: number, windowMs: number) {
    let cut = 0
    while (cut < arr.length && now - arr[cut].t > windowMs) cut++
    if (cut > 0) arr.splice(0, cut)
  }

  function ingestNewLines() {
    let fd: number
    try {
      fd = fs.openSync(cfg.outFile, "r")
    } catch {
      return
    }
    const stat = fs.fstatSync(fd)
    if (stat.size <= offset) {
      fs.closeSync(fd)
      return
    }
    const len = stat.size - offset
    const buf = Buffer.alloc(len)
    fs.readSync(fd, buf, 0, len, offset)
    fs.closeSync(fd)
    offset = stat.size

    const chunk = partial + buf.toString("utf8")
    const lines = chunk.split("\n")
    partial = lines.pop() ?? ""

    for (const line of lines) {
      if (!line.trim()) continue
      let obj: any
      try {
        obj = JSON.parse(line)
      } catch {
        continue
      }
      if (obj.type !== "Point") continue
      const tMs = Date.parse(obj.data?.time)
      const v = obj.data?.value
      if (!Number.isFinite(tMs) || typeof v !== "number") continue
      if (obj.metric === "http_req_duration") {
        durationSamples.push({ t: tMs, v })
      } else if (obj.metric === "http_req_failed") {
        failedSamples.push({ t: tMs, v })
      }
    }
  }

  function checkAbortCondition(): { breached: boolean; reason?: string; evidence?: object } {
    const now = Date.now()
    pruneOld(durationSamples, now, cfg.p95WindowMs)
    pruneOld(failedSamples, now, cfg.errorWindowMs)

    if (durationSamples.length >= cfg.minSamples) {
      const sorted = durationSamples.map((s) => s.v).sort((a, b) => a - b)
      const p95 = percentile(sorted, 0.95)
      if (p95 > cfg.p95ThresholdMs) {
        return {
          breached: true,
          reason: `p95 latency ${p95.toFixed(0)}ms > ${cfg.p95ThresholdMs}ms over trailing ${cfg.p95WindowMs / 1000}s (${durationSamples.length} samples)`,
          evidence: { metric: "http_req_duration_p95", value: p95, windowSamples: durationSamples.length, windowMs: cfg.p95WindowMs },
        }
      }
    }

    if (failedSamples.length >= cfg.minSamples) {
      const failCount = failedSamples.reduce((sum, s) => sum + s.v, 0)
      const rate = failCount / failedSamples.length
      if (rate > cfg.errorRateThreshold) {
        return {
          breached: true,
          reason: `error rate ${(rate * 100).toFixed(1)}% > ${cfg.errorRateThreshold * 100}% over trailing ${cfg.errorWindowMs / 1000}s (${failedSamples.length} samples)`,
          evidence: { metric: "http_req_failed_rate", value: rate, windowSamples: failedSamples.length, windowMs: cfg.errorWindowMs },
        }
      }
    }

    return { breached: false }
  }

  const interval = setInterval(() => {
    if (aborted || k6Exited) return
    ingestNewLines()
    const result = checkAbortCondition()
    if (result.breached) {
      aborted = true
      log(`ABORT CONDITION BREACHED: ${result.reason}`)
      const event = {
        abortedAt: new Date().toISOString(),
        reason: result.reason,
        evidence: result.evidence,
        config: cfg,
      }
      fs.writeFileSync(cfg.eventFile, JSON.stringify(event, null, 2))
      log(`evidence written to ${cfg.eventFile}`)
      log("sending SIGTERM to k6 child process")
      child.kill("SIGTERM")
      setTimeout(() => {
        if (!k6Exited) {
          log("k6 still alive after grace period, sending SIGKILL")
          child.kill("SIGKILL")
        }
      }, cfg.graceMs)
      clearInterval(interval)
    }
  }, cfg.checkIntervalMs)

  const exitCode: number = await new Promise((resolve) => {
    child.on("exit", (code) => {
      k6Exited = true
      k6ExitCode = code
      clearInterval(interval)
      if (aborted) {
        log(`k6 process terminated by kill-switch (exit code ${code})`)
        resolve(77)
      } else {
        log(`k6 exited naturally with code ${code}`)
        resolve(code ?? 1)
      }
    })
    child.on("error", (err) => {
      log(`failed to start k6: ${err.message}`)
      resolve(1)
    })
  })

  process.exit(exitCode)
}

main()
