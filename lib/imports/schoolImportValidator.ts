import { prisma } from "@/lib/db";

export type ImportRow = Record<string, string>;

export type InvalidRow = {
  row: ImportRow;
  rowNumber: number;
  errors: string[];
};

export type ValidationResult = {
  valid: ImportRow[];
  invalid: InvalidRow[];
  summary: {
    total: number;
    validCount: number;
    invalidCount: number;
    duplicateEmails: string[];
    warnings: string[];
  };
};

const VALID_SUBJECTS = [
  "MATH",
  "SCIENCE",
  "COMPUTER_SCIENCE",
  "ENGINEERING",
  "LITERACY",
  "CIVICS",
  "ARTS",
  "PE",
  "CAREER",
] as const;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function checkRequiredColumns(headers: string[], required: string[]): string[] {
  return required
    .filter((col) => !headers.includes(col))
    .map(
      (col) =>
        `Your CSV is missing the '${col}' column. Download the template to see the correct format.`
    );
}

function normaliseRows(text: string | ImportRow[]): {
  rows: ImportRow[];
  headers: string[];
  columnErrors: string[];
} {
  if (Array.isArray(text)) {
    const headers = text.length > 0 ? Object.keys(text[0]) : [];
    return { rows: text, headers, columnErrors: [] };
  }
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0]?.split(",").map((h) => h.trim()) ?? [];
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? ""]));
  });
  return { rows, headers, columnErrors: [] };
}

export async function validateStudentRows(
  rows: ImportRow[],
  schoolId: string
): Promise<ValidationResult> {
  const requiredColumns = ["firstName", "lastName", "grade", "dateOfBirth"];
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const columnErrors = checkRequiredColumns(headers, requiredColumns);

  if (columnErrors.length > 0) {
    return {
      valid: [],
      invalid: rows.map((row, i) => ({ row, rowNumber: i + 2, errors: columnErrors })),
      summary: {
        total: rows.length,
        validCount: 0,
        invalidCount: rows.length,
        duplicateEmails: [],
        warnings: [],
      },
    };
  }

  const valid: ImportRow[] = [];
  const invalid: InvalidRow[] = [];
  const warnings: string[] = [];
  const seenNameDob = new Set<string>();
  const duplicateEmails: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const errors: string[] = [];

    if (!row.firstName?.trim()) errors.push("firstName is required.");
    if (!row.lastName?.trim()) errors.push("lastName is required.");

    const grade = Number(row.grade);
    if (!row.grade || !Number.isInteger(grade) || grade < 1 || grade > 12) {
      errors.push(
        `Grade '${row.grade}' is not valid. Use a number from 1 to 12.`
      );
    }

    if (!row.dateOfBirth || !isValidDate(row.dateOfBirth)) {
      errors.push(
        `Date '${row.dateOfBirth}' is not in the right format. Use YYYY-MM-DD, for example: 2012-03-15.`
      );
    }

    if (row.guardianPhone && !/^\+/.test(row.guardianPhone.trim())) {
      warnings.push(
        `Row ${rowNumber}: guardianPhone '${row.guardianPhone}' may not be in international format. Use +231XXXXXXXX.`
      );
    }

    // Within-CSV duplicate check (name + DOB)
    if (row.firstName && row.lastName && row.dateOfBirth) {
      const key = `${row.firstName.trim().toLowerCase()}|${row.lastName.trim().toLowerCase()}|${row.dateOfBirth}`;
      if (seenNameDob.has(key)) {
        errors.push(
          `A student named '${row.firstName} ${row.lastName}' born on ${row.dateOfBirth} appears more than once in this file.`
        );
      } else {
        seenNameDob.add(key);
      }
    }

    if (errors.length > 0) {
      invalid.push({ row, rowNumber, errors });
    } else {
      valid.push(row);
    }
  }

  // DB duplicate check for valid rows (name + DOB)
  const stillValid: ImportRow[] = [];
  for (const row of valid) {
    const targetName = `${row.firstName.trim()} ${row.lastName.trim()}`;
    const dob = new Date(row.dateOfBirth);
    const duplicate = await prisma.student.findFirst({
      where: {
        dateOfBirth: dob,
        user: { schoolId, name: { equals: targetName, mode: "insensitive" } },
      },
      select: { id: true },
    });

    if (duplicate) {
      invalid.push({
        row,
        rowNumber: rows.indexOf(row) + 2,
        errors: [
          `A student named '${targetName}' born on ${row.dateOfBirth} is already enrolled at this school.`,
        ],
      });
    } else {
      stillValid.push(row);
    }
  }

  return {
    valid: stillValid,
    invalid,
    summary: {
      total: rows.length,
      validCount: stillValid.length,
      invalidCount: invalid.length,
      duplicateEmails,
      warnings,
    },
  };
}

export async function validateTeacherRows(
  rows: ImportRow[],
  schoolId: string
): Promise<ValidationResult> {
  const requiredColumns = ["firstName", "lastName", "email", "subject"];
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const columnErrors = checkRequiredColumns(headers, requiredColumns);

  if (columnErrors.length > 0) {
    return {
      valid: [],
      invalid: rows.map((row, i) => ({ row, rowNumber: i + 2, errors: columnErrors })),
      summary: {
        total: rows.length,
        validCount: 0,
        invalidCount: rows.length,
        duplicateEmails: [],
        warnings: [],
      },
    };
  }

  const valid: ImportRow[] = [];
  const invalid: InvalidRow[] = [];
  const warnings: string[] = [];
  const duplicateEmails: string[] = [];
  const seenEmails = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const errors: string[] = [];

    if (!row.firstName?.trim()) errors.push("firstName is required.");
    if (!row.lastName?.trim()) errors.push("lastName is required.");

    const email = row.email?.trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      errors.push(`Email '${row.email}' is not a valid email address.`);
    } else if (seenEmails.has(email)) {
      errors.push(`Email '${email}' appears more than once in this file.`);
      if (!duplicateEmails.includes(email)) duplicateEmails.push(email);
    } else {
      seenEmails.add(email);
    }

    const subject = row.subject?.trim().toUpperCase();
    if (!subject || !(VALID_SUBJECTS as readonly string[]).includes(subject)) {
      errors.push(
        `Subject '${row.subject}' is not valid. Use one of: ${VALID_SUBJECTS.join(", ")}.`
      );
    }

    if (errors.length > 0) {
      invalid.push({ row, rowNumber, errors });
    } else {
      valid.push(row);
    }
  }

  // DB duplicate check for teacher emails
  const stillValid: ImportRow[] = [];
  for (const row of valid) {
    const email = row.email.trim().toLowerCase();
    const duplicate = await prisma.user.findFirst({
      where: { email, schoolId, role: "TEACHER" },
      select: { id: true },
    });

    if (duplicate) {
      invalid.push({
        row,
        rowNumber: rows.indexOf(row) + 2,
        errors: [
          `A teacher with email '${email}' already exists at this school.`,
        ],
      });
      if (!duplicateEmails.includes(email)) duplicateEmails.push(email);
    } else {
      stillValid.push(row);
    }
  }

  return {
    valid: stillValid,
    invalid,
    summary: {
      total: rows.length,
      validCount: stillValid.length,
      invalidCount: invalid.length,
      duplicateEmails,
      warnings,
    },
  };
}

export async function validateGuardianRows(
  rows: ImportRow[],
  schoolId: string
): Promise<ValidationResult> {
  const requiredColumns = ["firstName", "lastName", "email", "studentFirstName", "studentLastName"];
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const columnErrors = checkRequiredColumns(headers, requiredColumns);

  if (columnErrors.length > 0) {
    return {
      valid: [],
      invalid: rows.map((row, i) => ({ row, rowNumber: i + 2, errors: columnErrors })),
      summary: {
        total: rows.length,
        validCount: 0,
        invalidCount: rows.length,
        duplicateEmails: [],
        warnings: [],
      },
    };
  }

  const valid: ImportRow[] = [];
  const invalid: InvalidRow[] = [];
  const warnings: string[] = [];
  const duplicateEmails: string[] = [];
  const seenEmails = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const errors: string[] = [];

    if (!row.firstName?.trim()) errors.push("firstName is required.");
    if (!row.lastName?.trim()) errors.push("lastName is required.");

    const email = row.email?.trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      errors.push(`Email '${row.email}' is not a valid email address.`);
    } else if (seenEmails.has(email)) {
      errors.push(`Email '${email}' appears more than once in this file.`);
      if (!duplicateEmails.includes(email)) duplicateEmails.push(email);
    } else {
      seenEmails.add(email);
    }

    if (!row.studentFirstName?.trim() || !row.studentLastName?.trim()) {
      errors.push("studentFirstName and studentLastName are required.");
    }

    if (errors.length > 0) {
      invalid.push({ row, rowNumber, errors });
    } else {
      valid.push(row);
    }
  }

  // DB checks: duplicate guardian email + student-match warning
  const stillValid: ImportRow[] = [];
  for (const row of valid) {
    const email = row.email.trim().toLowerCase();

    const dupGuardian = await prisma.user.findFirst({
      where: { email, role: "GUARDIAN" },
      select: { id: true },
    });

    if (dupGuardian) {
      invalid.push({
        row,
        rowNumber: rows.indexOf(row) + 2,
        errors: [`A guardian with email '${email}' is already registered.`],
      });
      if (!duplicateEmails.includes(email)) duplicateEmails.push(email);
      continue;
    }

    // Warn if no matching student found
    const studentName = `${row.studentFirstName.trim()} ${row.studentLastName.trim()}`;
    const matchingStudent = await prisma.student.findFirst({
      where: { user: { schoolId, name: { equals: studentName, mode: "insensitive" } } },
      select: { id: true },
    });

    if (!matchingStudent) {
      warnings.push(
        `Guardian '${row.firstName} ${row.lastName}': no student named '${studentName}' found at this school — guardian will be imported without a student link.`
      );
    }

    stillValid.push(row);
  }

  return {
    valid: stillValid,
    invalid,
    summary: {
      total: rows.length,
      validCount: stillValid.length,
      invalidCount: invalid.length,
      duplicateEmails,
      warnings,
    },
  };
}

export function buildErrorCsv(
  originalHeaders: string[],
  rows: InvalidRow[]
): string {
  const headers = [...originalHeaders, "error_reason"];
  const lines = [
    headers.join(","),
    ...rows.map((item) => {
      const values = originalHeaders.map((h) => {
        const val = item.row[h] ?? "";
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      values.push(`"${item.errors.join("; ").replace(/"/g, '""')}"`);
      return values.join(",");
    }),
  ];
  return lines.join("\n");
}
