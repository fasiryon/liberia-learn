import { createHash } from "node:crypto";
import JSZip from "jszip";

export const ONE_ROSTER_VERSION = "1.2";
export const ONE_ROSTER_MANIFEST_VERSION = "1.0";

export const ONE_ROSTER_HEADERS = {
  manifest: ["propertyName", "value"],
  academicSessions: [
    "sourcedId",
    "status",
    "dateLastModified",
    "title",
    "type",
    "startDate",
    "endDate",
    "parentSourcedId",
    "schoolYear",
  ],
  classes: [
    "sourcedId",
    "status",
    "dateLastModified",
    "title",
    "grades",
    "courseSourcedId",
    "classCode",
    "classType",
    "location",
    "schoolSourcedId",
    "termSourcedIds",
    "subjects",
    "subjectCodes",
    "periods",
  ],
  courses: [
    "sourcedId",
    "status",
    "dateLastModified",
    "schoolYearSourcedId",
    "title",
    "courseCode",
    "grades",
    "orgSourcedId",
    "subjects",
    "subjectCodes",
  ],
  demographics: [
    "sourcedId",
    "status",
    "dateLastModified",
    "birthDate",
    "sex",
    "americanIndianOrAlaskaNative",
    "asian",
    "blackOrAfricanAmerican",
    "nativeHawaiianOrOtherPacificIslander",
    "white",
    "demographicRaceTwoOrMoreRaces",
    "hispanicOrLatinoEthnicity",
    "countryOfBirthCode",
    "stateOfBirthAbbreviation",
    "cityOfBirth",
    "publicSchoolResidenceStatus",
  ],
  enrollments: [
    "sourcedId",
    "status",
    "dateLastModified",
    "classSourcedId",
    "schoolSourcedId",
    "userSourcedId",
    "role",
    "primary",
    "beginDate",
    "endDate",
  ],
  orgs: [
    "sourcedId",
    "status",
    "dateLastModified",
    "name",
    "type",
    "identifier",
    "parentSourcedId",
  ],
  roles: [
    "sourcedId",
    "status",
    "dateLastModified",
    "userSourcedId",
    "roleType",
    "role",
    "beginDate",
    "endDate",
    "orgSourcedId",
    "userProfileSourcedId",
  ],
  users: [
    "sourcedId",
    "status",
    "dateLastModified",
    "enabledUser",
    "username",
    "userIds",
    "givenName",
    "familyName",
    "middleName",
    "identifier",
    "email",
    "sms",
    "phone",
    "agentSourcedIds",
    "grades",
    "password",
    "userMasterIdentifier",
    "preferredGivenName",
    "preferredMiddleName",
    "preferredFamilyName",
    "primaryOrgSourcedId",
    "pronouns",
  ],
} as const;

export const ONE_ROSTER_MANIFEST_PROPERTIES = [
  "manifest.version",
  "oneroster.version",
  "file.academicSessions",
  "file.categories",
  "file.classes",
  "file.classResources",
  "file.courses",
  "file.courseResources",
  "file.demographics",
  "file.enrollments",
  "file.lineItemLearningObjectiveIds",
  "file.lineItems",
  "file.lineItemScoreScales",
  "file.orgs",
  "file.resources",
  "file.resultLearningObjectiveIds",
  "file.results",
  "file.resultScoreScales",
  "file.roles",
  "file.scoreScales",
  "file.userProfiles",
  "file.userResources",
  "file.users",
  "source.systemName",
  "source.systemCode",
] as const;

const SUPPORTED_FILES = [
  "academicSessions.csv",
  "classes.csv",
  "courses.csv",
  "demographics.csv",
  "enrollments.csv",
  "orgs.csv",
  "roles.csv",
  "users.csv",
] as const;

const REQUIRED_ROSTER_FILES = [
  "academicSessions.csv",
  "classes.csv",
  "courses.csv",
  "enrollments.csv",
  "orgs.csv",
  "roles.csv",
  "users.csv",
] as const;

const FILE_PROPERTY_BY_NAME: Record<(typeof SUPPORTED_FILES)[number], string> = {
  "academicSessions.csv": "file.academicSessions",
  "classes.csv": "file.classes",
  "courses.csv": "file.courses",
  "demographics.csv": "file.demographics",
  "enrollments.csv": "file.enrollments",
  "orgs.csv": "file.orgs",
  "roles.csv": "file.roles",
  "users.csv": "file.users",
};

type SupportedFileName = (typeof SUPPORTED_FILES)[number];
export type OneRosterRole = "student" | "teacher";
export type OneRosterRoleType = "primary" | "secondary";
export type OneRosterClassType = "homeroom" | "scheduled" | `ext:${string}`;
export type OneRosterAcademicSessionType =
  | "gradingPeriod"
  | "semester"
  | "schoolYear"
  | "term"
  | `ext:${string}`;
export type OneRosterSex = "male" | "female" | "unspecified" | "other" | `ext:${string}`;

export interface OneRosterOrg {
  sourcedId: string;
  name: string;
  type: "school";
  identifier?: string;
  parentSourcedId?: string;
}

export interface OneRosterAcademicSession {
  sourcedId: string;
  title: string;
  type: OneRosterAcademicSessionType;
  startDate: string;
  endDate: string;
  parentSourcedId?: string;
  schoolYear: string;
}

export interface OneRosterCourse {
  sourcedId: string;
  schoolYearSourcedId?: string;
  title: string;
  courseCode?: string;
  grades?: string[];
  orgSourcedId: string;
  subjects?: string[];
  subjectCodes?: string[];
}

export interface OneRosterClass {
  sourcedId: string;
  title: string;
  grades?: string[];
  courseSourcedId: string;
  classCode?: string;
  classType: OneRosterClassType;
  location?: string;
  schoolSourcedId: string;
  termSourcedIds: string[];
  subjects?: string[];
  subjectCodes?: string[];
  periods?: string[];
}

export interface OneRosterUser {
  sourcedId: string;
  enabledUser: boolean;
  username: string;
  userIds?: string[];
  givenName: string;
  familyName: string;
  middleName?: string;
  identifier?: string;
  email?: string;
  sms?: string;
  phone?: string;
  agentSourcedIds?: string[];
  grades?: string[];
  userMasterIdentifier?: string;
  preferredGivenName?: string;
  preferredMiddleName?: string;
  preferredFamilyName?: string;
  primaryOrgSourcedId?: string;
  pronouns?: string;
}

export interface OneRosterRoleAssignment {
  sourcedId: string;
  userSourcedId: string;
  roleType: OneRosterRoleType;
  role: OneRosterRole;
  beginDate?: string;
  endDate?: string;
  orgSourcedId: string;
}

export interface OneRosterEnrollment {
  sourcedId: string;
  classSourcedId: string;
  schoolSourcedId: string;
  userSourcedId: string;
  role: OneRosterRole;
  primary?: boolean;
  beginDate?: string;
  endDate?: string;
}

export interface OneRosterDemographic {
  sourcedId: string;
  birthDate?: string;
  sex?: OneRosterSex;
  americanIndianOrAlaskaNative?: boolean;
  asian?: boolean;
  blackOrAfricanAmerican?: boolean;
  nativeHawaiianOrOtherPacificIslander?: boolean;
  white?: boolean;
  demographicRaceTwoOrMoreRaces?: boolean;
  hispanicOrLatinoEthnicity?: boolean;
  countryOfBirthCode?: string;
  stateOfBirthAbbreviation?: string;
  cityOfBirth?: string;
  publicSchoolResidenceStatus?: string;
}

export interface OneRosterExportData {
  orgs: OneRosterOrg[];
  academicSessions: OneRosterAcademicSession[];
  courses: OneRosterCourse[];
  classes: OneRosterClass[];
  users: OneRosterUser[];
  roles: OneRosterRoleAssignment[];
  enrollments: OneRosterEnrollment[];
  demographics?: OneRosterDemographic[];
  sourceSystemName?: string;
  sourceSystemCode?: string;
}

export interface OneRosterValidationIssue {
  code: string;
  message: string;
  file?: string;
  row?: number;
  field?: string;
}

export interface OneRosterParseResult {
  valid: boolean;
  rows: {
    orgs: OneRosterOrg[];
    academicSessions: OneRosterAcademicSession[];
    courses: OneRosterCourse[];
    classes: OneRosterClass[];
    users: OneRosterUser[];
    roles: OneRosterRoleAssignment[];
    enrollments: OneRosterEnrollment[];
    demographics: OneRosterDemographic[];
  };
  counts: {
    manifest: number;
    orgs: number;
    academicSessions: number;
    courses: number;
    classes: number;
    users: number;
    roles: number;
    enrollments: number;
    demographics: number;
  };
  errors: OneRosterValidationIssue[];
  warnings: OneRosterValidationIssue[];
}

type ParsedRows = OneRosterParseResult["rows"];

function emptyResult(): OneRosterParseResult {
  return {
    valid: false,
    rows: {
      orgs: [],
      academicSessions: [],
      courses: [],
      classes: [],
      users: [],
      roles: [],
      enrollments: [],
      demographics: [],
    },
    counts: {
      manifest: 0,
      orgs: 0,
      academicSessions: 0,
      courses: 0,
      classes: 0,
      users: 0,
      roles: 0,
      enrollments: 0,
      demographics: 0,
    },
    errors: [],
    warnings: [],
  };
}

export function deterministicOneRosterSourcedId(namespace: string, value: string): string {
  if (!namespace.trim() || !value.trim()) {
    throw new Error("OneRoster sourcedId namespace and value are required");
  }
  const normalizedNamespace = namespace
    .trim()
    .replace(/[^0-9A-Za-z._/@-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const safeNamespace = normalizedNamespace.slice(0, 160).replace(/-+$/g, "") || "entity";
  const digest = createHash("sha256")
    .update(`${namespace.trim()}\u0000${value.trim()}`, "utf8")
    .digest("hex");
  return `liberialearn.${safeNamespace}.${digest}`;
}

export const createDeterministicSourcedId = deterministicOneRosterSourcedId;

export function parseRfc4180Csv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  if (!text) return [];

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let quoteClosed = false;

  const finishField = () => {
    row.push(field);
    field = "";
    quoteClosed = false;
  };
  const finishRow = () => {
    finishField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          quoteClosed = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field || quoteClosed) throw new Error(`Unexpected quote at character ${index + 1}`);
      quoted = true;
    } else if (character === ",") {
      finishField();
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      finishRow();
    } else {
      if (quoteClosed) throw new Error(`Unexpected character after closing quote at character ${index + 1}`);
      field += character;
    }
  }

  if (quoted) throw new Error("Unclosed quoted CSV field");
  if (field || row.length || quoteClosed) finishRow();
  return rows;
}

export function serializeRfc4180Csv(rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  const encodedRows = rows.map((row) =>
    row
      .map((rawValue) => {
        const value = rawValue === undefined || rawValue === null ? "" : String(rawValue);
        return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
      })
      .join(","),
  );
  return `${encodedRows.join("\r\n")}\r\n`;
}

function list(value?: string[]): string {
  return value?.join(",") ?? "";
}

function splitList(value: string): string[] | undefined {
  return value === "" ? undefined : value.split(",");
}

function optional(value: string): string | undefined {
  return value === "" ? undefined : value;
}

function optionalBoolean(value: string): boolean | undefined {
  if (value === "") return undefined;
  return value === "true";
}

function booleanValue(value?: boolean): string {
  return value === undefined ? "" : String(value);
}

function issue(
  result: OneRosterParseResult,
  code: string,
  message: string,
  details: Partial<OneRosterValidationIssue> = {},
) {
  result.errors.push({ code, message, ...details });
}

function assertExactHeader(
  result: OneRosterParseResult,
  file: string,
  actual: string[] | undefined,
  expected: readonly string[],
): boolean {
  if (!actual || actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    issue(result, "INVALID_HEADER", `${file} header must exactly match the OneRoster 1.2.1 order`, {
      file,
      row: 1,
    });
    return false;
  }
  return true;
}

function rowRecord(headers: readonly string[], values: string[]): Record<string, string> {
  return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
}

function validateDataRows(
  result: OneRosterParseResult,
  file: string,
  rows: string[][],
  headers: readonly string[],
): Record<string, string>[] {
  if (!assertExactHeader(result, file, rows[0], headers)) return [];
  const dataRows = rows.slice(1);
  if (dataRows.length === 0 || dataRows.every((row) => row.every((value) => value === ""))) {
    issue(result, "EMPTY_DATA_FILE", `${file} must contain at least one data row`, { file });
    return [];
  }
  const records: Record<string, string>[] = [];
  dataRows.forEach((values, index) => {
    if (values.length !== headers.length) {
      issue(result, "INVALID_COLUMN_COUNT", `${file} row has ${values.length} columns; expected ${headers.length}`, {
        file,
        row: index + 2,
      });
      return;
    }
    if (values.every((value) => value === "")) {
      issue(result, "EMPTY_DATA_ROW", `${file} contains an empty data row`, { file, row: index + 2 });
      return;
    }
    const record = rowRecord(headers, values);
    if (record.status !== "" || record.dateLastModified !== "") {
      issue(result, "DELTA_FIELDS_IN_BULK", `${file} bulk rows require blank status and dateLastModified`, {
        file,
        row: index + 2,
      });
    }
    for (const [field, value] of Object.entries(record)) {
      if (value.includes("\r")) {
        issue(result, "CARRIAGE_RETURN_IN_FIELD", `${file} fields cannot contain carriage returns`, {
          file,
          row: index + 2,
          field,
        });
      }
    }
    records.push(record);
  });
  return records;
}

const GUID_PATTERN = /^[0-9A-Za-z._/@-]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_PATTERN = /^\d{4}$/;

function validateRequired(
  result: OneRosterParseResult,
  file: string,
  records: Record<string, string>[],
  fields: string[],
) {
  records.forEach((record, index) => {
    fields.forEach((field) => {
      if (!record[field]) {
        issue(result, "REQUIRED_FIELD", `${file}.${field} is required`, {
          file,
          row: index + 2,
          field,
        });
      }
    });
  });
}

function validateGuid(
  result: OneRosterParseResult,
  file: string,
  row: number,
  field: string,
  value: string,
) {
  if (!value) return;
  if (value.length >= 256 || !GUID_PATTERN.test(value)) {
    issue(result, "INVALID_GUID", `${file}.${field} contains characters not permitted in a OneRoster GUID`, {
      file,
      row,
      field,
    });
  }
}

function validateGuidFields(
  result: OneRosterParseResult,
  file: string,
  records: Record<string, string>[],
  scalarFields: string[],
  listFields: string[] = [],
) {
  records.forEach((record, index) => {
    scalarFields.forEach((field) => validateGuid(result, file, index + 2, field, record[field]));
    listFields.forEach((field) => {
      if (!record[field]) return;
      record[field].split(",").forEach((value) => validateGuid(result, file, index + 2, field, value));
    });
  });
}

function validateUniqueSourcedIds(
  result: OneRosterParseResult,
  file: string,
  records: Record<string, string>[],
) {
  const seen = new Set<string>();
  records.forEach((record, index) => {
    if (seen.has(record.sourcedId)) {
      issue(result, "DUPLICATE_SOURCED_ID", `${file} contains duplicate sourcedId ${record.sourcedId}`, {
        file,
        row: index + 2,
        field: "sourcedId",
      });
    }
    seen.add(record.sourcedId);
  });
}

function validateDate(
  result: OneRosterParseResult,
  file: string,
  row: number,
  field: string,
  value: string,
  required = false,
) {
  if (!value) {
    if (required) issue(result, "REQUIRED_FIELD", `${file}.${field} is required`, { file, row, field });
    return;
  }
  if (!DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    issue(result, "INVALID_DATE", `${file}.${field} must use YYYY-MM-DD`, { file, row, field });
  }
}

function parseSupportedFile(
  result: OneRosterParseResult,
  file: SupportedFileName,
  text: string,
): Record<string, string>[] {
  const key = file.slice(0, -4) as keyof typeof ONE_ROSTER_HEADERS;
  let rows: string[][];
  try {
    rows = parseRfc4180Csv(text);
  } catch (error) {
    issue(result, "INVALID_CSV", `${file} is not valid RFC 4180 CSV: ${(error as Error).message}`, { file });
    return [];
  }
  return validateDataRows(result, file, rows, ONE_ROSTER_HEADERS[key]);
}

function validateAndNormalize(
  result: OneRosterParseResult,
  raw: Record<SupportedFileName, Record<string, string>[]>,
) {
  const orgs = raw["orgs.csv"];
  validateRequired(result, "orgs.csv", orgs, ["sourcedId", "name", "type"]);
  validateGuidFields(result, "orgs.csv", orgs, ["sourcedId", "parentSourcedId"]);
  validateUniqueSourcedIds(result, "orgs.csv", orgs);
  if (orgs.length !== 1 || orgs[0]?.type !== "school") {
    issue(result, "SCHOOL_ORG_REQUIRED", "The package must contain exactly one org with type school", {
      file: "orgs.csv",
    });
  }

  const sessions = raw["academicSessions.csv"];
  validateRequired(result, "academicSessions.csv", sessions, [
    "sourcedId",
    "title",
    "type",
    "startDate",
    "endDate",
    "schoolYear",
  ]);
  validateGuidFields(result, "academicSessions.csv", sessions, ["sourcedId", "parentSourcedId"]);
  validateUniqueSourcedIds(result, "academicSessions.csv", sessions);
  sessions.forEach((record, index) => {
    validateDate(result, "academicSessions.csv", index + 2, "startDate", record.startDate);
    validateDate(result, "academicSessions.csv", index + 2, "endDate", record.endDate);
    if (record.schoolYear && !YEAR_PATTERN.test(record.schoolYear)) {
      issue(result, "INVALID_YEAR", "academicSessions.csv.schoolYear must use YYYY", {
        file: "academicSessions.csv",
        row: index + 2,
        field: "schoolYear",
      });
    }
    const validType = ["gradingPeriod", "semester", "schoolYear", "term"].includes(record.type) || record.type.startsWith("ext:");
    if (record.type && !validType) {
      issue(result, "UNSUPPORTED_ENUM", `Unsupported academic session type ${record.type}`, {
        file: "academicSessions.csv",
        row: index + 2,
        field: "type",
      });
    }
  });

  const courses = raw["courses.csv"];
  validateRequired(result, "courses.csv", courses, ["sourcedId", "title", "orgSourcedId"]);
  validateGuidFields(result, "courses.csv", courses, ["sourcedId", "schoolYearSourcedId", "orgSourcedId"]);
  validateUniqueSourcedIds(result, "courses.csv", courses);

  const classes = raw["classes.csv"];
  validateRequired(result, "classes.csv", classes, [
    "sourcedId",
    "title",
    "courseSourcedId",
    "classType",
    "schoolSourcedId",
    "termSourcedIds",
  ]);
  validateGuidFields(
    result,
    "classes.csv",
    classes,
    ["sourcedId", "courseSourcedId", "schoolSourcedId"],
    ["termSourcedIds"],
  );
  validateUniqueSourcedIds(result, "classes.csv", classes);
  classes.forEach((record, index) => {
    const validType = ["homeroom", "scheduled"].includes(record.classType) || record.classType.startsWith("ext:");
    if (record.classType && !validType) {
      issue(result, "UNSUPPORTED_ENUM", `Unsupported class type ${record.classType}`, {
        file: "classes.csv",
        row: index + 2,
        field: "classType",
      });
    }
    if (record.subjects && record.subjectCodes && record.subjects.split(",").length !== record.subjectCodes.split(",").length) {
      issue(result, "SUBJECT_LIST_MISMATCH", "classes.csv subjects and subjectCodes must have equal lengths", {
        file: "classes.csv",
        row: index + 2,
      });
    }
  });

  const users = raw["users.csv"];
  validateRequired(result, "users.csv", users, [
    "sourcedId",
    "enabledUser",
    "username",
    "givenName",
    "familyName",
  ]);
  validateGuidFields(result, "users.csv", users, ["sourcedId", "primaryOrgSourcedId"], ["agentSourcedIds"]);
  validateUniqueSourcedIds(result, "users.csv", users);
  users.forEach((record, index) => {
    if (record.enabledUser && !["true", "false"].includes(record.enabledUser)) {
      issue(result, "UNSUPPORTED_ENUM", "users.csv.enabledUser must be true or false", {
        file: "users.csv",
        row: index + 2,
        field: "enabledUser",
      });
    }
    if (record.password) {
      issue(result, "PASSWORD_NOT_ACCEPTED", "OneRoster password values are rejected and never returned", {
        file: "users.csv",
        row: index + 2,
        field: "password",
      });
      record.password = "";
    }
  });

  const roles = raw["roles.csv"];
  validateRequired(result, "roles.csv", roles, [
    "sourcedId",
    "userSourcedId",
    "roleType",
    "role",
    "orgSourcedId",
  ]);
  validateGuidFields(result, "roles.csv", roles, [
    "sourcedId",
    "userSourcedId",
    "orgSourcedId",
    "userProfileSourcedId",
  ]);
  validateUniqueSourcedIds(result, "roles.csv", roles);
  roles.forEach((record, index) => {
    if (record.role && !["student", "teacher"].includes(record.role)) {
      issue(result, "UNSUPPORTED_ROLE", `Only student and teacher roles are supported; received ${record.role}`, {
        file: "roles.csv",
        row: index + 2,
        field: "role",
      });
    }
    if (record.roleType && !["primary", "secondary"].includes(record.roleType)) {
      issue(result, "UNSUPPORTED_ENUM", "roles.csv.roleType must be primary or secondary", {
        file: "roles.csv",
        row: index + 2,
        field: "roleType",
      });
    }
    if (record.userProfileSourcedId) {
      issue(result, "UNSUPPORTED_USER_PROFILE", "userProfileSourcedId is not supported by this profile", {
        file: "roles.csv",
        row: index + 2,
        field: "userProfileSourcedId",
      });
    }
    validateDate(result, "roles.csv", index + 2, "beginDate", record.beginDate);
    validateDate(result, "roles.csv", index + 2, "endDate", record.endDate);
  });

  const enrollments = raw["enrollments.csv"];
  validateRequired(result, "enrollments.csv", enrollments, [
    "sourcedId",
    "classSourcedId",
    "schoolSourcedId",
    "userSourcedId",
    "role",
  ]);
  validateGuidFields(result, "enrollments.csv", enrollments, [
    "sourcedId",
    "classSourcedId",
    "schoolSourcedId",
    "userSourcedId",
  ]);
  validateUniqueSourcedIds(result, "enrollments.csv", enrollments);
  enrollments.forEach((record, index) => {
    if (record.role && !["student", "teacher"].includes(record.role)) {
      issue(result, "UNSUPPORTED_ROLE", `Only student and teacher enrollments are supported; received ${record.role}`, {
        file: "enrollments.csv",
        row: index + 2,
        field: "role",
      });
    }
    if (record.primary && !["true", "false"].includes(record.primary)) {
      issue(result, "UNSUPPORTED_ENUM", "enrollments.csv.primary must be true, false, or blank", {
        file: "enrollments.csv",
        row: index + 2,
        field: "primary",
      });
    }
    if (record.role === "student" && record.primary) {
      issue(result, "STUDENT_PRIMARY_NOT_ALLOWED", "enrollments.csv.primary applies only to teachers", {
        file: "enrollments.csv",
        row: index + 2,
        field: "primary",
      });
    }
    validateDate(result, "enrollments.csv", index + 2, "beginDate", record.beginDate);
    validateDate(result, "enrollments.csv", index + 2, "endDate", record.endDate);
  });

  const demographics = raw["demographics.csv"];
  validateRequired(result, "demographics.csv", demographics, ["sourcedId"]);
  validateGuidFields(result, "demographics.csv", demographics, ["sourcedId"]);
  validateUniqueSourcedIds(result, "demographics.csv", demographics);
  const demographicBooleanFields = [
    "americanIndianOrAlaskaNative",
    "asian",
    "blackOrAfricanAmerican",
    "nativeHawaiianOrOtherPacificIslander",
    "white",
    "demographicRaceTwoOrMoreRaces",
    "hispanicOrLatinoEthnicity",
  ];
  demographics.forEach((record, index) => {
    validateDate(result, "demographics.csv", index + 2, "birthDate", record.birthDate);
    if (record.sex && !["male", "female", "unspecified", "other"].includes(record.sex) && !record.sex.startsWith("ext:")) {
      issue(result, "UNSUPPORTED_ENUM", `Unsupported demographics sex ${record.sex}`, {
        file: "demographics.csv",
        row: index + 2,
        field: "sex",
      });
    }
    demographicBooleanFields.forEach((field) => {
      if (record[field] && !["true", "false"].includes(record[field])) {
        issue(result, "UNSUPPORTED_ENUM", `demographics.csv.${field} must be true, false, or blank`, {
          file: "demographics.csv",
          row: index + 2,
          field,
        });
      }
    });
  });

  const schoolId = orgs[0]?.sourcedId;
  const orgIds = new Set(orgs.map((record) => record.sourcedId));
  const sessionById = new Map(sessions.map((record) => [record.sourcedId, record]));
  const courseById = new Map(courses.map((record) => [record.sourcedId, record]));
  const classById = new Map(classes.map((record) => [record.sourcedId, record]));
  const userById = new Map(users.map((record) => [record.sourcedId, record]));
  const roleKeys = new Set(roles.map((record) => `${record.userSourcedId}\u0000${record.orgSourcedId}\u0000${record.role}`));

  orgs.forEach((record, index) => {
    if (record.parentSourcedId && !orgIds.has(record.parentSourcedId)) {
      issue(result, "MISSING_REFERENCE", `Unknown parent org ${record.parentSourcedId}`, {
        file: "orgs.csv",
        row: index + 2,
        field: "parentSourcedId",
      });
    }
  });
  sessions.forEach((record, index) => {
    if (record.parentSourcedId && !sessionById.has(record.parentSourcedId)) {
      issue(result, "MISSING_REFERENCE", `Unknown parent academic session ${record.parentSourcedId}`, {
        file: "academicSessions.csv",
        row: index + 2,
        field: "parentSourcedId",
      });
    }
  });
  courses.forEach((record, index) => {
    if (!orgIds.has(record.orgSourcedId) || record.orgSourcedId !== schoolId) {
      issue(result, "CROSS_SCHOOL_REFERENCE", `Course ${record.sourcedId} does not reference the package school`, {
        file: "courses.csv",
        row: index + 2,
        field: "orgSourcedId",
      });
    }
    if (record.schoolYearSourcedId) {
      const session = sessionById.get(record.schoolYearSourcedId);
      if (!session) {
        issue(result, "MISSING_REFERENCE", `Unknown school year ${record.schoolYearSourcedId}`, {
          file: "courses.csv",
          row: index + 2,
          field: "schoolYearSourcedId",
        });
      } else if (session.type !== "schoolYear") {
        issue(result, "INVALID_REFERENCE_TYPE", `${record.schoolYearSourcedId} is not a schoolYear session`, {
          file: "courses.csv",
          row: index + 2,
          field: "schoolYearSourcedId",
        });
      }
    }
  });
  classes.forEach((record, index) => {
    if (!courseById.has(record.courseSourcedId)) {
      issue(result, "MISSING_REFERENCE", `Unknown course ${record.courseSourcedId}`, {
        file: "classes.csv",
        row: index + 2,
        field: "courseSourcedId",
      });
    }
    if (record.schoolSourcedId !== schoolId) {
      issue(result, "CROSS_SCHOOL_REFERENCE", `Class ${record.sourcedId} does not reference the package school`, {
        file: "classes.csv",
        row: index + 2,
        field: "schoolSourcedId",
      });
    }
    record.termSourcedIds.split(",").forEach((termId) => {
      if (!sessionById.has(termId)) {
        issue(result, "MISSING_REFERENCE", `Unknown class term ${termId}`, {
          file: "classes.csv",
          row: index + 2,
          field: "termSourcedIds",
        });
      }
    });
  });
  users.forEach((record, index) => {
    if (record.primaryOrgSourcedId && record.primaryOrgSourcedId !== schoolId) {
      issue(result, "CROSS_SCHOOL_REFERENCE", `User ${record.sourcedId} has a primary org outside the package school`, {
        file: "users.csv",
        row: index + 2,
        field: "primaryOrgSourcedId",
      });
    }
    if (record.agentSourcedIds) record.agentSourcedIds.split(",").forEach((agentId) => {
      if (!userById.has(agentId)) {
        issue(result, "MISSING_REFERENCE", `Unknown user agent ${agentId}`, {
          file: "users.csv",
          row: index + 2,
          field: "agentSourcedIds",
        });
      }
    });
  });
  roles.forEach((record, index) => {
    if (!userById.has(record.userSourcedId)) {
      issue(result, "MISSING_REFERENCE", `Unknown role user ${record.userSourcedId}`, {
        file: "roles.csv",
        row: index + 2,
        field: "userSourcedId",
      });
    }
    if (record.orgSourcedId !== schoolId) {
      issue(result, "CROSS_SCHOOL_REFERENCE", `Role ${record.sourcedId} does not reference the package school`, {
        file: "roles.csv",
        row: index + 2,
        field: "orgSourcedId",
      });
    }
  });
  users.forEach((record, index) => {
    if (!roles.some((role) => role.userSourcedId === record.sourcedId)) {
      issue(result, "MISSING_USER_ROLE", `User ${record.sourcedId} has no role assignment`, {
        file: "users.csv",
        row: index + 2,
      });
    }
  });
  enrollments.forEach((record, index) => {
    const targetClass = classById.get(record.classSourcedId);
    if (!targetClass) {
      issue(result, "MISSING_REFERENCE", `Unknown enrollment class ${record.classSourcedId}`, {
        file: "enrollments.csv",
        row: index + 2,
        field: "classSourcedId",
      });
    }
    if (record.schoolSourcedId !== schoolId || targetClass?.schoolSourcedId !== record.schoolSourcedId) {
      issue(result, "CROSS_SCHOOL_REFERENCE", `Enrollment ${record.sourcedId} does not reference the package school`, {
        file: "enrollments.csv",
        row: index + 2,
        field: "schoolSourcedId",
      });
    }
    if (!userById.has(record.userSourcedId)) {
      issue(result, "MISSING_REFERENCE", `Unknown enrollment user ${record.userSourcedId}`, {
        file: "enrollments.csv",
        row: index + 2,
        field: "userSourcedId",
      });
    }
    if (!roleKeys.has(`${record.userSourcedId}\u0000${record.schoolSourcedId}\u0000${record.role}`)) {
      issue(result, "ROLE_MISMATCH", `Enrollment ${record.sourcedId} has no matching user role`, {
        file: "enrollments.csv",
        row: index + 2,
        field: "role",
      });
    }
  });
  demographics.forEach((record, index) => {
    if (!userById.has(record.sourcedId)) {
      issue(result, "MISSING_REFERENCE", `Demographics references unknown user ${record.sourcedId}`, {
        file: "demographics.csv",
        row: index + 2,
        field: "sourcedId",
      });
    }
  });

  result.rows.orgs = orgs.map((record) => ({
    sourcedId: record.sourcedId,
    name: record.name,
    type: "school",
    identifier: optional(record.identifier),
    parentSourcedId: optional(record.parentSourcedId),
  }));
  result.rows.academicSessions = sessions.map((record) => ({
    sourcedId: record.sourcedId,
    title: record.title,
    type: record.type as OneRosterAcademicSessionType,
    startDate: record.startDate,
    endDate: record.endDate,
    parentSourcedId: optional(record.parentSourcedId),
    schoolYear: record.schoolYear,
  }));
  result.rows.courses = courses.map((record) => ({
    sourcedId: record.sourcedId,
    schoolYearSourcedId: optional(record.schoolYearSourcedId),
    title: record.title,
    courseCode: optional(record.courseCode),
    grades: splitList(record.grades),
    orgSourcedId: record.orgSourcedId,
    subjects: splitList(record.subjects),
    subjectCodes: splitList(record.subjectCodes),
  }));
  result.rows.classes = classes.map((record) => ({
    sourcedId: record.sourcedId,
    title: record.title,
    grades: splitList(record.grades),
    courseSourcedId: record.courseSourcedId,
    classCode: optional(record.classCode),
    classType: record.classType as OneRosterClassType,
    location: optional(record.location),
    schoolSourcedId: record.schoolSourcedId,
    termSourcedIds: splitList(record.termSourcedIds) ?? [],
    subjects: splitList(record.subjects),
    subjectCodes: splitList(record.subjectCodes),
    periods: splitList(record.periods),
  }));
  result.rows.users = users.map((record) => ({
    sourcedId: record.sourcedId,
    enabledUser: record.enabledUser === "true",
    username: record.username,
    userIds: splitList(record.userIds),
    givenName: record.givenName,
    familyName: record.familyName,
    middleName: optional(record.middleName),
    identifier: optional(record.identifier),
    email: optional(record.email),
    sms: optional(record.sms),
    phone: optional(record.phone),
    agentSourcedIds: splitList(record.agentSourcedIds),
    grades: splitList(record.grades),
    userMasterIdentifier: optional(record.userMasterIdentifier),
    preferredGivenName: optional(record.preferredGivenName),
    preferredMiddleName: optional(record.preferredMiddleName),
    preferredFamilyName: optional(record.preferredFamilyName),
    primaryOrgSourcedId: optional(record.primaryOrgSourcedId),
    pronouns: optional(record.pronouns),
  }));
  result.rows.roles = roles.map((record) => ({
    sourcedId: record.sourcedId,
    userSourcedId: record.userSourcedId,
    roleType: record.roleType as OneRosterRoleType,
    role: record.role as OneRosterRole,
    beginDate: optional(record.beginDate),
    endDate: optional(record.endDate),
    orgSourcedId: record.orgSourcedId,
  }));
  result.rows.enrollments = enrollments.map((record) => ({
    sourcedId: record.sourcedId,
    classSourcedId: record.classSourcedId,
    schoolSourcedId: record.schoolSourcedId,
    userSourcedId: record.userSourcedId,
    role: record.role as OneRosterRole,
    primary: optionalBoolean(record.primary),
    beginDate: optional(record.beginDate),
    endDate: optional(record.endDate),
  }));
  result.rows.demographics = demographics.map((record) => ({
    sourcedId: record.sourcedId,
    birthDate: optional(record.birthDate),
    sex: optional(record.sex) as OneRosterSex | undefined,
    americanIndianOrAlaskaNative: optionalBoolean(record.americanIndianOrAlaskaNative),
    asian: optionalBoolean(record.asian),
    blackOrAfricanAmerican: optionalBoolean(record.blackOrAfricanAmerican),
    nativeHawaiianOrOtherPacificIslander: optionalBoolean(record.nativeHawaiianOrOtherPacificIslander),
    white: optionalBoolean(record.white),
    demographicRaceTwoOrMoreRaces: optionalBoolean(record.demographicRaceTwoOrMoreRaces),
    hispanicOrLatinoEthnicity: optionalBoolean(record.hispanicOrLatinoEthnicity),
    countryOfBirthCode: optional(record.countryOfBirthCode),
    stateOfBirthAbbreviation: optional(record.stateOfBirthAbbreviation),
    cityOfBirth: optional(record.cityOfBirth),
    publicSchoolResidenceStatus: optional(record.publicSchoolResidenceStatus),
  }));
}

function manifestRows(data: OneRosterExportData): string[][] {
  const present = new Set<string>([
    "file.academicSessions",
    "file.classes",
    "file.courses",
    "file.enrollments",
    "file.orgs",
    "file.roles",
    "file.users",
  ]);
  if (data.demographics?.length) present.add("file.demographics");

  return [
    [...ONE_ROSTER_HEADERS.manifest],
    ...ONE_ROSTER_MANIFEST_PROPERTIES.map((property) => {
      if (property === "manifest.version") return [property, ONE_ROSTER_MANIFEST_VERSION];
      if (property === "oneroster.version") return [property, ONE_ROSTER_VERSION];
      if (property === "source.systemName") return [property, data.sourceSystemName ?? "LiberiaLearn"];
      if (property === "source.systemCode") return [property, data.sourceSystemCode ?? "liberialearn"];
      return [property, present.has(property) ? "bulk" : "absent"];
    }),
  ];
}

function dataFileRows(data: OneRosterExportData): Record<SupportedFileName, unknown[][] | undefined> {
  return {
    "orgs.csv": [
      [...ONE_ROSTER_HEADERS.orgs],
      ...data.orgs.map((row) => [row.sourcedId, "", "", row.name, row.type, row.identifier, row.parentSourcedId]),
    ],
    "academicSessions.csv": [
      [...ONE_ROSTER_HEADERS.academicSessions],
      ...data.academicSessions.map((row) => [
        row.sourcedId,
        "",
        "",
        row.title,
        row.type,
        row.startDate,
        row.endDate,
        row.parentSourcedId,
        row.schoolYear,
      ]),
    ],
    "courses.csv": [
      [...ONE_ROSTER_HEADERS.courses],
      ...data.courses.map((row) => [
        row.sourcedId,
        "",
        "",
        row.schoolYearSourcedId,
        row.title,
        row.courseCode,
        list(row.grades),
        row.orgSourcedId,
        list(row.subjects),
        list(row.subjectCodes),
      ]),
    ],
    "classes.csv": [
      [...ONE_ROSTER_HEADERS.classes],
      ...data.classes.map((row) => [
        row.sourcedId,
        "",
        "",
        row.title,
        list(row.grades),
        row.courseSourcedId,
        row.classCode,
        row.classType,
        row.location,
        row.schoolSourcedId,
        list(row.termSourcedIds),
        list(row.subjects),
        list(row.subjectCodes),
        list(row.periods),
      ]),
    ],
    "users.csv": [
      [...ONE_ROSTER_HEADERS.users],
      ...data.users.map((row) => [
        row.sourcedId,
        "",
        "",
        String(row.enabledUser),
        row.username,
        list(row.userIds),
        row.givenName,
        row.familyName,
        row.middleName,
        row.identifier,
        row.email,
        row.sms,
        row.phone,
        list(row.agentSourcedIds),
        list(row.grades),
        "",
        row.userMasterIdentifier,
        row.preferredGivenName,
        row.preferredMiddleName,
        row.preferredFamilyName,
        row.primaryOrgSourcedId,
        row.pronouns,
      ]),
    ],
    "roles.csv": [
      [...ONE_ROSTER_HEADERS.roles],
      ...data.roles.map((row) => [
        row.sourcedId,
        "",
        "",
        row.userSourcedId,
        row.roleType,
        row.role,
        row.beginDate,
        row.endDate,
        row.orgSourcedId,
        "",
      ]),
    ],
    "enrollments.csv": [
      [...ONE_ROSTER_HEADERS.enrollments],
      ...data.enrollments.map((row) => [
        row.sourcedId,
        "",
        "",
        row.classSourcedId,
        row.schoolSourcedId,
        row.userSourcedId,
        row.role,
        booleanValue(row.primary),
        row.beginDate,
        row.endDate,
      ]),
    ],
    "demographics.csv": data.demographics?.length
      ? [
          [...ONE_ROSTER_HEADERS.demographics],
          ...data.demographics.map((row) => [
            row.sourcedId,
            "",
            "",
            row.birthDate,
            row.sex,
            booleanValue(row.americanIndianOrAlaskaNative),
            booleanValue(row.asian),
            booleanValue(row.blackOrAfricanAmerican),
            booleanValue(row.nativeHawaiianOrOtherPacificIslander),
            booleanValue(row.white),
            booleanValue(row.demographicRaceTwoOrMoreRaces),
            booleanValue(row.hispanicOrLatinoEthnicity),
            row.countryOfBirthCode,
            row.stateOfBirthAbbreviation,
            row.cityOfBirth,
            row.publicSchoolResidenceStatus,
          ]),
        ]
      : undefined,
  };
}

export async function buildOneRosterZip(data: OneRosterExportData): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("manifest.csv", serializeRfc4180Csv(manifestRows(data)));
  const files = dataFileRows(data);
  for (const file of SUPPORTED_FILES) {
    const rows = files[file];
    if (rows) zip.file(file, serializeRfc4180Csv(rows));
  }
  const output = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const validation = await parseOneRosterZip(output);
  if (!validation.valid) {
    throw new Error(`Cannot build invalid OneRoster ZIP: ${validation.errors.map((error) => error.message).join("; ")}`);
  }
  return output;
}

export const buildOneRoster12CsvZip = buildOneRosterZip;

export async function parseOneRosterZip(input: Uint8Array | ArrayBuffer): Promise<OneRosterParseResult> {
  const result = emptyResult();
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(input);
  } catch (error) {
    issue(result, "INVALID_ZIP", `Unable to read OneRoster ZIP: ${(error as Error).message}`);
    return result;
  }

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const entryNames = entries.map((entry) => entry.name);
  for (const name of entryNames) {
    if (name.includes("/") || name.includes("\\")) {
      issue(result, "NON_ROOT_ZIP_ENTRY", `OneRoster ZIP entries must be at the root: ${name}`, { file: name });
    }
    if (name !== "manifest.csv" && !SUPPORTED_FILES.includes(name as SupportedFileName)) {
      issue(result, "UNSUPPORTED_ZIP_ENTRY", `Unsupported OneRoster profile file ${name}`, { file: name });
    }
  }

  const manifestEntry = zip.file("manifest.csv");
  if (!manifestEntry) {
    issue(result, "MISSING_MANIFEST", "manifest.csv is required");
    return result;
  }

  let manifestCsv: string[][];
  try {
    manifestCsv = parseRfc4180Csv(await manifestEntry.async("string"));
  } catch (error) {
    issue(result, "INVALID_CSV", `manifest.csv is not valid RFC 4180 CSV: ${(error as Error).message}`, {
      file: "manifest.csv",
    });
    return result;
  }
  if (!assertExactHeader(result, "manifest.csv", manifestCsv[0], ONE_ROSTER_HEADERS.manifest)) return result;
  const manifestData = manifestCsv.slice(1);
  result.counts.manifest = manifestData.length;
  if (manifestData.some((row) => row.length !== 2)) {
    issue(result, "INVALID_COLUMN_COUNT", "manifest.csv rows must contain exactly two columns", {
      file: "manifest.csv",
    });
  }
  const actualProperties = manifestData.map((row) => row[0]);
  if (
    actualProperties.length !== ONE_ROSTER_MANIFEST_PROPERTIES.length ||
    actualProperties.some((property, index) => property !== ONE_ROSTER_MANIFEST_PROPERTIES[index])
  ) {
    issue(result, "INVALID_MANIFEST_PROPERTIES", "manifest.csv must include all OneRoster 1.2 properties in specification order", {
      file: "manifest.csv",
    });
  }
  const manifest = new Map(manifestData.map((row) => [row[0], row[1] ?? ""]));
  manifestData.forEach((row, index) => {
    if (row.some((value) => value.includes("\r"))) {
      issue(result, "CARRIAGE_RETURN_IN_FIELD", "manifest.csv fields cannot contain carriage returns", {
        file: "manifest.csv",
        row: index + 2,
      });
    }
  });
  if (manifest.get("manifest.version") !== ONE_ROSTER_MANIFEST_VERSION) {
    issue(result, "INVALID_MANIFEST_VERSION", "manifest.version must be 1.0", { file: "manifest.csv" });
  }
  if (manifest.get("oneroster.version") !== ONE_ROSTER_VERSION) {
    issue(result, "INVALID_ONEROSTER_VERSION", "oneroster.version must be 1.2", { file: "manifest.csv" });
  }

  ONE_ROSTER_MANIFEST_PROPERTIES.filter((property) => property.startsWith("file.")).forEach((property) => {
    const value = manifest.get(property);
    if (value !== "absent" && value !== "bulk") {
      issue(result, "BULK_MODE_REQUIRED", `${property} must be absent or bulk; delta mode is not supported`, {
        file: "manifest.csv",
      });
    }
    if (!Object.values(FILE_PROPERTY_BY_NAME).includes(property) && value !== "absent") {
      issue(result, "UNSUPPORTED_MANIFEST_FILE", `${property} must be absent for this rostering profile`, {
        file: "manifest.csv",
      });
    }
  });

  for (const file of SUPPORTED_FILES) {
    const declaration = manifest.get(FILE_PROPERTY_BY_NAME[file]);
    const present = entryNames.includes(file);
    if (declaration === "bulk" && !present) {
      issue(result, "MISSING_DECLARED_FILE", `${file} is declared bulk but missing from the ZIP`, { file });
    }
    if (declaration === "absent" && present) {
      issue(result, "UNDECLARED_FILE", `${file} is present but declared absent`, { file });
    }
  }
  for (const file of REQUIRED_ROSTER_FILES) {
    if (manifest.get(FILE_PROPERTY_BY_NAME[file]) !== "bulk") {
      issue(result, "MISSING_ROSTER_DEPENDENCY", `${file} is required for a semantically complete rostering package`, {
        file,
      });
    }
  }

  const raw = Object.fromEntries(SUPPORTED_FILES.map((file) => [file, []])) as Record<
    SupportedFileName,
    Record<string, string>[]
  >;
  for (const file of SUPPORTED_FILES) {
    const entry = zip.file(file);
    if (!entry) continue;
    raw[file] = parseSupportedFile(result, file, await entry.async("string"));
  }
  validateAndNormalize(result, raw);

  (Object.keys(result.rows) as Array<keyof ParsedRows>).forEach((key) => {
    result.counts[key] = result.rows[key].length;
  });
  result.valid = result.errors.length === 0;
  return result;
}

export const parseOneRoster12CsvZip = parseOneRosterZip;
