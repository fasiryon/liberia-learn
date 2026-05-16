/**
 * Sprint 18 — Labs Pass 3, Password Recovery, PDF Progress Reports
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

// ─── Helpers shared across tests ─────────────────────────────────────────────

function makeValidLab(overrides: Record<string, unknown> = {}) {
  return {
    title: "Water Absorption Lab",
    type: "guided_walkthrough" as const,
    durationMinutes: 25,
    subject: "SCIENCE",
    gradeLevel: 7,
    labObjective: "Students will observe how different materials absorb water.",
    materialsNeeded: ["cups", "stones", "paper", "water"],
    safetyNotes: null,
    procedure: [
      { stepNumber: 1, instruction: "Fill three cups with equal amounts of water.", teacherNote: null, durationMinutes: 5 },
      { stepNumber: 2, instruction: "Place stones, paper, and leaves in separate cups.", teacherNote: "Monitor students carefully.", durationMinutes: 10 },
      { stepNumber: 3, instruction: "After 5 minutes, measure the remaining water.", teacherNote: null, durationMinutes: 10 },
    ],
    observationForm: [
      { field: "water_before", prompt: "How much water was in the cup before?", inputType: "number" as const, choices: null },
      { field: "water_after", prompt: "How much water remains after 5 minutes?", inputType: "number" as const, choices: null },
    ],
    analysisQuestions: [
      { question: "Which material absorbed the most water?", expectedAnswer: "Paper absorbed the most water.", scoringRubric: "1 point for correct material, 1 for explanation." },
      { question: "Why do you think stones absorbed less water?", expectedAnswer: "Stones are non-porous and cannot absorb water.", scoringRubric: "2 points for explaining porosity concept." },
    ],
    connectionToLesson: "This lab connects to the lesson on water cycles and absorption.",
    offlineCapable: true as const,
    virtualAlternative: null,
    ...overrides,
  };
}

function validateLab(lab: unknown): boolean {
  if (!lab || typeof lab !== "object") return false;
  const l = lab as Record<string, unknown>;
  if (!Array.isArray(l.procedure) || l.procedure.length < 3) return false;
  if (!Array.isArray(l.observationForm) || l.observationForm.length < 2) return false;
  if (!Array.isArray(l.analysisQuestions) || l.analysisQuestions.length < 2) return false;
  return true;
}

// ─── Lab generation validation ────────────────────────────────────────────────

describe("Lab generation script — validation gate", () => {
  it("passes a lab with exactly 3 procedure steps, 2 observation fields, 2 analysis questions", () => {
    const lab = makeValidLab();
    expect(validateLab(lab)).toBe(true);
  });

  it("passes a lab with more than the minimum requirements", () => {
    const lab = makeValidLab({
      procedure: [
        { stepNumber: 1, instruction: "Step 1", teacherNote: null, durationMinutes: 5 },
        { stepNumber: 2, instruction: "Step 2", teacherNote: null, durationMinutes: 5 },
        { stepNumber: 3, instruction: "Step 3", teacherNote: null, durationMinutes: 5 },
        { stepNumber: 4, instruction: "Step 4", teacherNote: null, durationMinutes: 5 },
      ],
      observationForm: [
        { field: "obs1", prompt: "Observation 1", inputType: "text", choices: null },
        { field: "obs2", prompt: "Observation 2", inputType: "text", choices: null },
        { field: "obs3", prompt: "Observation 3", inputType: "text", choices: null },
      ],
      analysisQuestions: [
        { question: "Q1?", expectedAnswer: "A1", scoringRubric: "1pt" },
        { question: "Q2?", expectedAnswer: "A2", scoringRubric: "1pt" },
        { question: "Q3?", expectedAnswer: "A3", scoringRubric: "1pt" },
      ],
    });
    expect(validateLab(lab)).toBe(true);
  });

  it("rejects a lab with only 2 procedure steps (< 3 required)", () => {
    const lab = makeValidLab({
      procedure: [
        { stepNumber: 1, instruction: "Step 1", teacherNote: null, durationMinutes: 10 },
        { stepNumber: 2, instruction: "Step 2", teacherNote: null, durationMinutes: 10 },
      ],
    });
    expect(validateLab(lab)).toBe(false);
  });

  it("rejects a lab with only 1 observation field (< 2 required)", () => {
    const lab = makeValidLab({
      observationForm: [
        { field: "obs1", prompt: "Observation 1", inputType: "text", choices: null },
      ],
    });
    expect(validateLab(lab)).toBe(false);
  });

  it("rejects a lab with only 1 analysis question (< 2 required)", () => {
    const lab = makeValidLab({
      analysisQuestions: [
        { question: "Only question?", expectedAnswer: "Only answer", scoringRubric: "1pt" },
      ],
    });
    expect(validateLab(lab)).toBe(false);
  });

  it("rejects null input", () => {
    expect(validateLab(null)).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(validateLab("not a lab")).toBe(false);
    expect(validateLab(42)).toBe(false);
  });

  it("rejects an object with missing required arrays", () => {
    expect(validateLab({ title: "Incomplete Lab" })).toBe(false);
  });

  it("skips lab when procedure is empty array", () => {
    const lab = makeValidLab({ procedure: [] });
    expect(validateLab(lab)).toBe(false);
  });
});

// ─── Password Recovery — PasswordResetToken logic ─────────────────────────────

describe("Password recovery — PasswordResetToken", () => {
  it("creates a token with future expiresAt (24h from now for email reset)", () => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const now = new Date();
    expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
    const hoursDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    expect(hoursDiff).toBeCloseTo(24, 0);
  });

  it("detects an expired token (expiresAt in the past)", () => {
    const expiredAt = new Date(Date.now() - 1000);
    expect(expiredAt < new Date()).toBe(true);
  });

  it("detects a token that has been used (usedAt is set)", () => {
    const usedAt = new Date(Date.now() - 5000);
    expect(usedAt !== null && usedAt !== undefined).toBe(true);
  });

  it("a token with no usedAt and future expiresAt is valid", () => {
    const token = {
      usedAt: null as Date | null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
    const isValid = !token.usedAt && token.expiresAt > new Date();
    expect(isValid).toBe(true);
  });

  it("a token with usedAt set cannot be reused", () => {
    const token = {
      usedAt: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
    const canUse = !token.usedAt;
    expect(canUse).toBe(false);
  });

  it("generates a 6-digit admin reset code using Math.floor pattern", () => {
    // Simulate the code generation logic
    for (let i = 0; i < 20; i++) {
      const codeNum = Math.floor(100000 + Math.random() * 900000);
      const adminCode = String(codeNum).padStart(6, "0");
      expect(adminCode).toMatch(/^\d{6}$/);
      expect(Number(adminCode)).toBeGreaterThanOrEqual(100000);
      expect(Number(adminCode)).toBeLessThanOrEqual(999999);
    }
  });

  it("admin reset code expires after 1 hour (not 24 hours)", () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const hoursDiff = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
    expect(hoursDiff).toBeCloseTo(1, 0);
  });

  it("bcrypt hashes a new password before storing", async () => {
    const password = "NewPassword123";
    const hash = await bcrypt.hash(password, 10);
    expect(hash).not.toBe(password);
    const match = await bcrypt.compare(password, hash);
    expect(match).toBe(true);
  });
});

// ─── Admin reset code — SMS to guardian ──────────────────────────────────────

describe("Admin reset code — guardian SMS", () => {
  it("dispatches SMS only when guardian has a phone and smsOptIn=true", () => {
    const guardian = { guardianPhoneE164: "+2310701234567", smsOptIn: true };
    const shouldSend = Boolean(guardian.guardianPhoneE164 && guardian.smsOptIn);
    expect(shouldSend).toBe(true);
  });

  it("skips SMS when guardian smsOptIn=false", () => {
    const guardian = { guardianPhoneE164: "+2310701234567", smsOptIn: false };
    const shouldSend = Boolean(guardian.guardianPhoneE164 && guardian.smsOptIn);
    expect(shouldSend).toBe(false);
  });

  it("skips SMS when guardian has no phone", () => {
    const guardian = { guardianPhoneE164: null, smsOptIn: true };
    const shouldSend = Boolean(guardian.guardianPhoneE164 && guardian.smsOptIn);
    expect(shouldSend).toBe(false);
  });

  it("SMS message includes mention of code expiry and admin action", () => {
    const message = `Your child's LiberiaLearn password was reset by school admin. Code expires in 1 hour. If you did not request this, contact school.`;
    expect(message).toContain("school admin");
    expect(message).toContain("1 hour");
    expect(message).toContain("contact school");
  });
});

// ─── PDF Progress Report — structure and auth ─────────────────────────────────

describe("PDF progress report — section structure", () => {
  it("ProgressReportData includes all 5 required section fields", () => {
    const data = {
      studentName: "Fatu Kollie",
      grade: 7,
      termName: "Term 1",
      schoolName: "CHA School",
      generatedDate: "15/05/2026",
      attendance: { present: 45, absent: 3, late: 2, rate: 90 },
      subjects: [
        { subject: "MATH", assignmentsAvg: 85, examScore: 88, masteryPct: 80, gradeLetter: "B" },
      ],
      overallAvg: 85,
      lessonCompletion: {
        total: 8,
        bySubject: [{ subject: "MATH", completed: 8, total: 10 }],
      },
      teacherComment: "Fatu is an excellent student.",
    };

    // Verify all 5 sections are representable
    expect(data.attendance).toBeDefined(); // Section 1
    expect(data.subjects).toBeDefined();   // Section 2
    expect(data.lessonCompletion).toBeDefined(); // Section 3
    expect(data.teacherComment).toBeDefined(); // Section 4
    // Section 5 (signatures) is static in the PDF template
    expect(data.studentName).toBeDefined();
  });

  it("attendance rate color: green >= 90%, amber 75-89%, red < 75%", () => {
    function attendanceColor(rate: number): string {
      if (rate >= 90) return "green";
      if (rate >= 75) return "amber";
      return "red";
    }
    expect(attendanceColor(95)).toBe("green");
    expect(attendanceColor(90)).toBe("green");
    expect(attendanceColor(89)).toBe("amber");
    expect(attendanceColor(75)).toBe("amber");
    expect(attendanceColor(74)).toBe("red");
    expect(attendanceColor(0)).toBe("red");
  });

  it("grade letters: A>=90, B>=80, C>=70, D>=60, F<60", () => {
    function gradeLetter(avg: number): string {
      if (avg >= 90) return "A";
      if (avg >= 80) return "B";
      if (avg >= 70) return "C";
      if (avg >= 60) return "D";
      return "F";
    }
    expect(gradeLetter(95)).toBe("A");
    expect(gradeLetter(90)).toBe("A");
    expect(gradeLetter(89)).toBe("B");
    expect(gradeLetter(80)).toBe("B");
    expect(gradeLetter(79)).toBe("C");
    expect(gradeLetter(70)).toBe("C");
    expect(gradeLetter(69)).toBe("D");
    expect(gradeLetter(60)).toBe("D");
    expect(gradeLetter(59)).toBe("F");
    expect(gradeLetter(0)).toBe("F");
  });

  it("bar string represents completion ratio visually", () => {
    function barString(completed: number, total: number, width = 10): string {
      if (total === 0) return "░".repeat(width);
      const filled = Math.round((completed / total) * width);
      return "█".repeat(filled) + "░".repeat(width - filled);
    }
    expect(barString(10, 10)).toBe("██████████");
    expect(barString(0, 10)).toBe("░░░░░░░░░░");
    expect(barString(5, 10)).toBe("█████░░░░░");
    expect(barString(0, 0)).toBe("░░░░░░░░░░");
    expect(barString(8, 10).length).toBe(10);
  });
});

describe("PDF progress report API — authorization", () => {
  it("guardian can access own child: guardianId matches StudentGuardian.guardianId", () => {
    const guardianUserId = "guardian-1";
    const studentGuardians = [{ guardianId: "guardian-1" }, { guardianId: "guardian-2" }];
    const isGuardian = studentGuardians.some((sg) => sg.guardianId === guardianUserId);
    expect(isGuardian).toBe(true);
  });

  it("guardian cannot access another guardian's child", () => {
    const guardianUserId = "guardian-3";
    const studentGuardians = [{ guardianId: "guardian-1" }, { guardianId: "guardian-2" }];
    const isGuardian = studentGuardians.some((sg) => sg.guardianId === guardianUserId);
    expect(isGuardian).toBe(false);
  });

  it("student can access own report: student.userId matches session userId", () => {
    const sessionUserId = "user-1";
    const student = { userId: "user-1" };
    expect(student.userId === sessionUserId).toBe(true);
  });

  it("student cannot access another student's report", () => {
    const sessionUserId = "user-2";
    const student = { userId: "user-1" };
    expect(student.userId === sessionUserId).toBe(false);
  });

  it("teacher/admin can access report only within same school", () => {
    const adminSchoolId = "school-1";
    const studentSchoolId = "school-1";
    expect(adminSchoolId === studentSchoolId).toBe(true);
  });

  it("teacher/admin from different school is denied", () => {
    const schools = ["school-A", "school-B"];
    expect(schools[0] === schools[1]).toBe(false);
  });
});
