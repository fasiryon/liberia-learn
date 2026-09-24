import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetOptionalUser, mockFindUnique, mockRedirect } = vi.hoisted(() => ({
  mockGetOptionalUser: vi.fn(),
  mockFindUnique: vi.fn(),
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/auth", () => ({ getOptionalUser: mockGetOptionalUser }));
vi.mock("@/lib/db", () => ({ prisma: { student: { findUnique: mockFindUnique } } }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

import { renderToStaticMarkup } from "react-dom/server";
import TeacherStudentProfilePage from "@/app/teacher/student/[id]/page";

function studentIn(cls: { teacherId: string; schoolId: string }) {
  return {
    id: "stu-1",
    county: null,
    community: null,
    user: { name: "Child Name", email: "child@example.org" },
    enrollments: [{ Class: { id: "class-1", name: "Grade 5A", ...cls, School: {}, Teacher: {} } }],
    grades: [],
    homeworkSubmissions: [],
    placementTests: [],
  };
}

describe("/teacher/student/[id] — roster scope (hostile)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects a teacher who does not teach the student", async () => {
    mockGetOptionalUser.mockResolvedValueOnce({ id: "teacher-9", role: "TEACHER", schoolId: "school-9" });
    mockFindUnique.mockResolvedValueOnce(studentIn({ teacherId: "teacher-1", schoolId: "school-1" }));
    await expect(TeacherStudentProfilePage({ params: { id: "stu-1" } })).rejects.toThrow("REDIRECT:/teacher");
  });

  it("redirects when the teacher id matches but the class belongs to another school", async () => {
    mockGetOptionalUser.mockResolvedValueOnce({ id: "teacher-1", role: "TEACHER", schoolId: "school-9" });
    mockFindUnique.mockResolvedValueOnce(studentIn({ teacherId: "teacher-1", schoolId: "school-1" }));
    await expect(TeacherStudentProfilePage({ params: { id: "stu-1" } })).rejects.toThrow("REDIRECT:/teacher");
  });

  it("redirects non-teachers", async () => {
    mockGetOptionalUser.mockResolvedValueOnce({ id: "g-1", role: "GUARDIAN", schoolId: "school-1" });
    await expect(TeacherStudentProfilePage({ params: { id: "stu-1" } })).rejects.toThrow("REDIRECT:/");
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("renders for the student's own teacher without inventing a location", async () => {
    mockGetOptionalUser.mockResolvedValueOnce({ id: "teacher-1", role: "TEACHER", schoolId: "school-1" });
    mockFindUnique.mockResolvedValueOnce(studentIn({ teacherId: "teacher-1", schoolId: "school-1" }));
    const tree = await TeacherStudentProfilePage({ params: { id: "stu-1" } });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain("Location not recorded");
    expect(html).not.toContain("New Kru Town");
  });
});
