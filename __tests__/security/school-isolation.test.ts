import { vi, describe, it, expect, beforeEach } from "vitest"
import { assertSchoolAccess, checkSchoolAccess, SchoolAccessError } from "@/lib/tenant/assert-school-access"

// ─── Mocks for route integration tests ────────────────────────────────────────

const mockRequireRole = vi.hoisted(() => vi.fn())
const mockPrismaClassFindMany = vi.hoisted(() => vi.fn())
const mockPrismaStudentFindMany = vi.hoisted(() => vi.fn())
const mockPrismaStudentFindFirst = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole, requireUser: mockRequireRole }))
vi.mock("@/lib/db", () => ({
  prisma: {
    class: { findMany: mockPrismaClassFindMany },
    student: { findMany: mockPrismaStudentFindMany, findFirst: mockPrismaStudentFindFirst },
  },
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    role: "TEACHER",
    schoolId: "school-a",
    isPlatformAdmin: false,
    ...overrides,
  } as any
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("assertSchoolAccess — unit tests", () => {
  beforeEach(() => vi.clearAllMocks())

  it("1. STUDENT same school → passes", async () => {
    const user = makeUser({ role: "STUDENT", schoolId: "school-a" })
    await expect(assertSchoolAccess(user, "school-a")).resolves.toBeUndefined()
  })

  it("2. STUDENT different school → throws SchoolAccessError", async () => {
    const user = makeUser({ role: "STUDENT", schoolId: "school-a" })
    await expect(assertSchoolAccess(user, "school-b")).rejects.toBeInstanceOf(SchoolAccessError)
  })

  it("3. TEACHER different school → throws SchoolAccessError", async () => {
    const user = makeUser({ role: "TEACHER", schoolId: "school-a" })
    await expect(assertSchoolAccess(user, "school-b")).rejects.toBeInstanceOf(SchoolAccessError)
  })

  it("4. ADMIN different school → throws SchoolAccessError", async () => {
    const user = makeUser({ role: "ADMIN", schoolId: "school-a" })
    await expect(assertSchoolAccess(user, "school-b")).rejects.toBeInstanceOf(SchoolAccessError)
  })

  it("5. MOE_OFFICIAL any school → passes", async () => {
    const user = makeUser({ role: "MOE_OFFICIAL", schoolId: "school-a" })
    await expect(assertSchoolAccess(user, "school-z")).resolves.toBeUndefined()
  })

  it("6. isPlatformAdmin any school → passes", async () => {
    const user = makeUser({ role: "ADMIN", schoolId: null, isPlatformAdmin: true })
    await expect(assertSchoolAccess(user, "school-z")).resolves.toBeUndefined()
  })
})

describe("checkSchoolAccess — unit tests", () => {
  it("7. returns null on schoolId match", async () => {
    const user = makeUser({ role: "TEACHER", schoolId: "school-a" })
    const result = await checkSchoolAccess(user, "school-a")
    expect(result).toBeNull()
  })

  it("8. returns 403 Response on schoolId mismatch", async () => {
    const user = makeUser({ role: "TEACHER", schoolId: "school-a" })
    const result = await checkSchoolAccess(user, "school-b")
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
    const body = await result!.json()
    expect(body).toMatchObject({ error: "Access denied" })
  })
})

describe("Route isolation — integration scenarios", () => {
  beforeEach(() => vi.clearAllMocks())

  it("9. student/today: null schoolId in token → 403 (no cross-school data exposure)", async () => {
    mockRequireRole.mockResolvedValue(
      makeUser({ role: "STUDENT", schoolId: null, id: "s1" })
    )
    const { GET } = await import("@/app/api/student/today/route")
    const res = await GET()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/school/i)
  })

  it("10. teacher/gradebook: classId from different school → 403", async () => {
    // Teacher belongs to school-b; class-from-school-a doesn't appear in their WHERE filter
    mockRequireRole.mockResolvedValue(
      makeUser({ role: "TEACHER", schoolId: "school-b", id: "t1" })
    )
    mockPrismaClassFindMany.mockResolvedValue([
      // only school-b classes returned
      { id: "class-school-b-1", name: "Math B", subject: "MATH" },
    ])
    const { GET } = await import("@/app/api/teacher/gradebook/route")
    const req = new Request("http://localhost/api/teacher/gradebook?classId=class-from-school-a")
    const res = await GET(req as any)
    expect(res.status).toBe(403)
  })

  it("11. admin/students: query scoped to user.schoolId — school-b admin sees only school-b students", async () => {
    mockRequireRole.mockResolvedValue(
      makeUser({ role: "ADMIN", schoolId: "school-b", id: "admin1" })
    )
    mockPrismaStudentFindMany.mockResolvedValue([])
    const { GET } = await import("@/app/api/admin/students/route")
    const req = new Request("http://localhost/api/admin/students")
    const res = await GET(req as any)
    expect(res.status).toBe(200)
    // Verify prisma was called with school-b scope
    expect(mockPrismaStudentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ user: { schoolId: "school-b" } }),
      })
    )
  })

  it("12. assertSchoolAccess: MOE_OFFICIAL can access any school — passes without 403", async () => {
    const moeUser = makeUser({ role: "MOE_OFFICIAL", schoolId: "school-a", id: "moe1" })
    // MOE_OFFICIAL should be able to access any school
    const resultA = await checkSchoolAccess(moeUser, "school-a")
    const resultB = await checkSchoolAccess(moeUser, "school-b")
    const resultZ = await checkSchoolAccess(moeUser, "school-z-national")
    expect(resultA).toBeNull()
    expect(resultB).toBeNull()
    expect(resultZ).toBeNull()
  })
})
