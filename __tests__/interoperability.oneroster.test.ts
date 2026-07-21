import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  ONE_ROSTER_HEADERS,
  buildOneRosterZip,
  deterministicOneRosterSourcedId,
  parseOneRosterZip,
  parseRfc4180Csv,
  serializeRfc4180Csv,
  type OneRosterExportData,
} from "@/lib/interoperability/oneroster";

function fixture(): OneRosterExportData {
  return {
    sourceSystemName: "LiberiaLearn",
    sourceSystemCode: "liberialearn",
    orgs: [
      {
        sourcedId: "school.monrovia-1",
        name: 'Monrovia, "Central" School',
        type: "school",
        identifier: "MOE-001",
      },
    ],
    academicSessions: [
      {
        sourcedId: "session.2026",
        title: "2025/2026 School Year",
        type: "schoolYear",
        startDate: "2025-09-01",
        endDate: "2026-07-31",
        schoolYear: "2026",
      },
      {
        sourcedId: "term.2026-1",
        title: "Term 1",
        type: "term",
        startDate: "2025-09-01",
        endDate: "2025-12-20",
        parentSourcedId: "session.2026",
        schoolYear: "2026",
      },
    ],
    courses: [
      {
        sourcedId: "course.g6-math",
        schoolYearSourcedId: "session.2026",
        title: "Grade 6 Mathematics",
        courseCode: "G6-MATH",
        grades: ["6"],
        orgSourcedId: "school.monrovia-1",
        subjects: ["Mathematics"],
        subjectCodes: ["MATH"],
      },
    ],
    classes: [
      {
        sourcedId: "class.g6-math-a",
        title: 'Grade 6, "A" Mathematics',
        grades: ["6"],
        courseSourcedId: "course.g6-math",
        classCode: "G6-A-MATH",
        classType: "scheduled",
        location: "Room 2",
        schoolSourcedId: "school.monrovia-1",
        termSourcedIds: ["term.2026-1"],
        subjects: ["Mathematics"],
        subjectCodes: ["MATH"],
        periods: ["1", "3"],
      },
    ],
    users: [
      {
        sourcedId: "user.student-1",
        enabledUser: true,
        username: "student1",
        userIds: ["{local:student-1}"],
        givenName: 'Mary, "MJ"',
        familyName: "Doe",
        email: "mary@example.org",
        grades: ["6"],
        primaryOrgSourcedId: "school.monrovia-1",
      },
      {
        sourcedId: "user.teacher-1",
        enabledUser: true,
        username: "teacher1",
        givenName: "Joseph",
        familyName: "Kollie",
        primaryOrgSourcedId: "school.monrovia-1",
      },
    ],
    roles: [
      {
        sourcedId: "role.student-1",
        userSourcedId: "user.student-1",
        roleType: "primary",
        role: "student",
        orgSourcedId: "school.monrovia-1",
      },
      {
        sourcedId: "role.teacher-1",
        userSourcedId: "user.teacher-1",
        roleType: "primary",
        role: "teacher",
        orgSourcedId: "school.monrovia-1",
      },
    ],
    enrollments: [
      {
        sourcedId: "enrollment.student-1",
        classSourcedId: "class.g6-math-a",
        schoolSourcedId: "school.monrovia-1",
        userSourcedId: "user.student-1",
        role: "student",
      },
      {
        sourcedId: "enrollment.teacher-1",
        classSourcedId: "class.g6-math-a",
        schoolSourcedId: "school.monrovia-1",
        userSourcedId: "user.teacher-1",
        role: "teacher",
        primary: true,
      },
    ],
    demographics: [
      {
        sourcedId: "user.student-1",
        birthDate: "2013-04-10",
        sex: "female",
      },
    ],
  };
}

async function rewriteZip(
  source: Uint8Array,
  rewrite: (zip: JSZip) => Promise<void> | void,
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(source);
  await rewrite(zip);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

describe("OneRoster 1.2.1 CSV ZIP", () => {
  it("exports and parses a semantically complete users, classes, and enrollments round trip", async () => {
    const zipBytes = await buildOneRosterZip(fixture());
    const zip = await JSZip.loadAsync(zipBytes);

    expect(Object.keys(zip.files).sort()).toEqual([
      "academicSessions.csv",
      "classes.csv",
      "courses.csv",
      "demographics.csv",
      "enrollments.csv",
      "manifest.csv",
      "orgs.csv",
      "roles.csv",
      "users.csv",
    ]);
    expect(Object.keys(zip.files).every((name) => !name.includes("/"))).toBe(true);

    const parsed = await parseOneRosterZip(zipBytes);
    expect(parsed.valid).toBe(true);
    expect(parsed.errors).toEqual([]);
    expect(parsed.counts.manifest).toBe(25);
    expect(parsed.counts).toMatchObject({ users: 2, classes: 1, enrollments: 2, demographics: 1 });
    expect(parsed.rows.users[0]).toMatchObject({
      sourcedId: "user.student-1",
      givenName: 'Mary, "MJ"',
      grades: ["6"],
    });
    expect(parsed.rows.classes[0]).toMatchObject({
      title: 'Grade 6, "A" Mathematics',
      periods: ["1", "3"],
    });
    expect(parsed.rows.enrollments.map((row) => row.role)).toEqual(["student", "teacher"]);

    const usersCsv = await zip.file("users.csv")!.async("string");
    const manifestCsv = await zip.file("manifest.csv")!.async("string");
    expect(parseRfc4180Csv(usersCsv)[0]).toEqual(ONE_ROSTER_HEADERS.users);
    expect(parseRfc4180Csv(manifestCsv)).toHaveLength(26);
    expect(usersCsv).toContain('"Mary, ""MJ"""');
  });

  it("parses RFC 4180 quoted commas and escaped quotes", () => {
    const serialized = serializeRfc4180Csv([
      ["name", "note"],
      ['Doe, "Mary"', 'Says "hello", clearly'],
    ]);
    expect(parseRfc4180Csv(serialized)).toEqual([
      ["name", "note"],
      ['Doe, "Mary"', 'Says "hello", clearly'],
    ]);
  });

  it("tolerates a UTF-8 BOM before a CSV header", async () => {
    const source = await buildOneRosterZip(fixture());
    const withBom = await rewriteZip(source, async (zip) => {
      const users = await zip.file("users.csv")!.async("string");
      zip.file("users.csv", `\uFEFF${users}`);
    });

    const parsed = await parseOneRosterZip(withBom);
    expect(parsed.valid).toBe(true);
    expect(parsed.rows.users).toHaveLength(2);
  });

  it("reports a missing manifest", async () => {
    const source = await buildOneRosterZip(fixture());
    const withoutManifest = await rewriteZip(source, (zip) => {
      zip.remove("manifest.csv");
    });

    const parsed = await parseOneRosterZip(withoutManifest);
    expect(parsed.valid).toBe(false);
    expect(parsed.errors).toContainEqual(expect.objectContaining({ code: "MISSING_MANIFEST" }));
  });

  it("reports a missing manifest dependency", async () => {
    const source = await buildOneRosterZip(fixture());
    const withoutCourses = await rewriteZip(source, (zip) => {
      zip.remove("courses.csv");
    });

    const parsed = await parseOneRosterZip(withoutCourses);
    expect(parsed.valid).toBe(false);
    expect(parsed.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MISSING_DECLARED_FILE", file: "courses.csv" }),
        expect.objectContaining({ code: "MISSING_REFERENCE", file: "classes.csv" }),
      ]),
    );
  });

  it("rejects cross-school references", async () => {
    const source = await buildOneRosterZip(fixture());
    const crossSchool = await rewriteZip(source, async (zip) => {
      const enrollmentRows = parseRfc4180Csv(await zip.file("enrollments.csv")!.async("string"));
      const schoolIndex = enrollmentRows[0].indexOf("schoolSourcedId");
      enrollmentRows[1][schoolIndex] = "school.other";
      zip.file("enrollments.csv", serializeRfc4180Csv(enrollmentRows));
    });

    const parsed = await parseOneRosterZip(crossSchool);
    expect(parsed.valid).toBe(false);
    expect(parsed.errors).toContainEqual(
      expect.objectContaining({ code: "CROSS_SCHOOL_REFERENCE", file: "enrollments.csv" }),
    );
  });

  it("rejects and strips password values", async () => {
    const source = await buildOneRosterZip(fixture());
    const withPassword = await rewriteZip(source, async (zip) => {
      const userRows = parseRfc4180Csv(await zip.file("users.csv")!.async("string"));
      const passwordIndex = userRows[0].indexOf("password");
      userRows[1][passwordIndex] = "secret-password";
      zip.file("users.csv", serializeRfc4180Csv(userRows));
    });

    const parsed = await parseOneRosterZip(withPassword);
    expect(parsed.valid).toBe(false);
    expect(parsed.errors).toContainEqual(expect.objectContaining({ code: "PASSWORD_NOT_ACCEPTED" }));
    expect(JSON.stringify(parsed.rows.users)).not.toContain("secret-password");
    expect(parsed.rows.users[0]).not.toHaveProperty("password");
  });

  it("creates stable, valid sourcedIds", () => {
    const first = deterministicOneRosterSourcedId("user", "student-123");
    expect(first).toBe(deterministicOneRosterSourcedId("user", "student-123"));
    expect(first).not.toBe(deterministicOneRosterSourcedId("user", "student-124"));
    expect(first).toMatch(/^[0-9A-Za-z._/@-]+$/);
    expect(first.length).toBeLessThan(256);
    expect(deterministicOneRosterSourcedId("x".repeat(400), "student-123").length).toBeLessThan(256);
  });
});
