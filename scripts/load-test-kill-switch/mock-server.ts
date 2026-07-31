/**
 * Controllable local HTTP server for testing the load-test supervisor
 * (scripts/load-test-kill-switch/supervisor.ts) without touching production.
 *
 * Mode is read fresh from a control file on every request (no caching), so a
 * test script can flip behaviour mid-run by rewriting the file:
 *
 *   echo healthy > mode.txt   -> ~30-60ms, always 200
 *   echo slow    > mode.txt   -> ~15s delay, then 200 (drives p95 up)
 *   echo erroring > mode.txt  -> immediate 500 (drives error rate up)
 *
 * Run: npx tsx scripts/load-test-kill-switch/mock-server.ts <port> <modeFile>
 */
import http from "node:http"
import fs from "node:fs"

const port = Number(process.argv[2] ?? 4999)
const modeFile = process.argv[3] ?? "mode.txt"

function readMode(): string {
  try {
    return fs.readFileSync(modeFile, "utf8").trim()
  } catch {
    return "healthy"
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const server = http.createServer(async (req, res) => {
  const mode = readMode()

  if (mode === "slow") {
    await sleep(15000)
    res.writeHead(200, { "Content-Type": "text/plain" })
    res.end("ok (slow)")
    return
  }

  if (mode === "erroring") {
    res.writeHead(500, { "Content-Type": "text/plain" })
    res.end("simulated failure")
    return
  }

  await sleep(20 + Math.random() * 40)
  res.writeHead(200, { "Content-Type": "text/plain" })
  res.end("ok")
})

server.listen(port, () => {
  console.log(`mock-server listening on ${port}, mode file: ${modeFile}`)
})
