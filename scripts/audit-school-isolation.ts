import { readFileSync, readdirSync, statSync } from "fs"
import { join } from "path"

const API_DIR = "app/api"
const results: {
  file: string
  hasRequireUser: boolean
  hasSchoolCheck: boolean
  risk: "HIGH" | "MEDIUM" | "LOW" | "OK"
}[] = []

function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) { walk(full); continue }
    if (!full.endsWith("route.ts")) continue

    const src = readFileSync(full, "utf-8")
    const hasAuth = src.includes("requireUser") ||
                    src.includes("requireRole") ||
                    src.includes("getServerSession")
    const hasSchool = src.includes("schoolId") ||
                      src.includes("assertSchoolAccess") ||
                      src.includes("school_id")
    const isPlatformOnly = src.includes("isPlatformAdmin") &&
                           !src.includes("schoolId")

    let risk: "HIGH" | "MEDIUM" | "LOW" | "OK" = "OK"
    if (!hasAuth) risk = "HIGH"
    else if (hasAuth && !hasSchool && !isPlatformOnly) risk = "MEDIUM"
    else if (hasSchool) risk = "OK"

    results.push({
      file: full.replace("app/api/", ""),
      hasRequireUser: hasAuth,
      hasSchoolCheck: hasSchool,
      risk,
    })
  }
}

walk(API_DIR)

const high = results.filter(r => r.risk === "HIGH")
const medium = results.filter(r => r.risk === "MEDIUM")
const ok = results.filter(r => r.risk === "OK")

console.log(`\n=== SCHOOL ISOLATION AUDIT ===`)
console.log(`Total routes: ${results.length}`)
console.log(`HIGH (no auth): ${high.length}`)
console.log(`MEDIUM (auth but no schoolId): ${medium.length}`)
console.log(`OK: ${ok.length}`)

if (high.length) {
  console.log(`\n--- HIGH RISK (no auth at all) ---`)
  high.forEach(r => console.log(" ", r.file))
}
if (medium.length) {
  console.log(`\n--- MEDIUM RISK (auth, missing schoolId) ---`)
  medium.slice(0, 30).forEach(r => console.log(" ", r.file))
  if (medium.length > 30)
    console.log(`  ... and ${medium.length - 30} more`)
}
