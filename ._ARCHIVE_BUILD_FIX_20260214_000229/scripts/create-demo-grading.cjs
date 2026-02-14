/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function readSchema(schemaPath) {
  return fs.readFileSync(schemaPath, "utf8");
}

function extractModelBlock(schemaText, modelName) {
  const re = new RegExp(String.raw`model\s+${modelName}\s*\{([\s\S]*?)\n\}`, "m");
  const m = schemaText.match(re);
  if (!m) throw new Error(`Model block not found in schema.prisma: ${modelName}`);
  return m[1];
}

function extractEnumValues(schemaText, enumName) {
  const re = new RegExp(String.raw`enum\s+${enumName}\s*\{([\s\S]*?)\n\}`, "m");
  const m = schemaText.match(re);
  if (!m) return null;

  const body = m[1]
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//"));

  const values = body.filter((l) => /^[A-Z0-9_]+$/.test(l)).map((v) => v);
  return values.length ? values : null;
}

function isEnumType(schemaText, typeName) {
  return extractEnumValues(schemaText, typeName) !== null;
}

function defaultForEnum(schemaText, enumName) {
  const values = extractEnumValues(schemaText, enumName);
  if (!values || !values.length) return null;

  // Prefer common sensible defaults if they exist
  const preferred = [
    "MATH",
    "MATHEMATICS",
    "GRADE_1",
    "G1",
    "PRIMARY",
    "CLASS_1",
    "ACTIVE",
    "ENABLED",
  ];
  for (const p of preferred) {
    if (values.includes(p)) return p;
  }
  return values[0];
}

function parseModelFields(blockText) {
  const lines = blockText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//"));

  const fields = [];

  for (const line of lines) {
    if (line.startsWith("@@")) continue; // model attributes
    if (line.startsWith("}")) continue;

    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z0-9_]+)(\??)(\[\])?\s*(.*)$/);
    if (!m) continue;

    const [, name, type, optionalMark, listMark, rest] = m;
    fields.push({
      name,
      type,
      isOptional: optionalMark === "?",
      isList: !!listMark,
      rest,
      raw: line,
    });
  }

  return fields;
}

function findRelationForFk(fields, fkName) {
  const rel = fields.find((f) => f.rest.includes("@relation") && f.rest.includes(`fields: [${fkName}]`));
  return rel ? rel.type : null;
}

function isScalarOrEnum(schemaText, t) {
  const scalars = ["String", "Int", "Float", "Boolean", "DateTime", "Json", "Decimal", "BigInt", "Bytes"];
  return scalars.includes(t) || isEnumType(schemaText, t);
}

function defaultForScalar(type, fieldName) {
  if (type === "String") {
    const n = fieldName.toLowerCase();
    if (n.includes("name")) return "Demo";
    if (n.includes("title")) return "Demo Title";
    if (n.includes("code")) return "DEMO-CODE";
    if (n.includes("slug")) return "demo-slug";
    if (n.includes("descriptor")) return "DEMO";
    if (n.includes("county")) return "Montserrado";
    if (n.includes("city")) return "Monrovia";
    if (n.includes("country")) return "Liberia";
    return "DEMO";
  }
  if (type === "Int") return 1;
  if (type === "Float") return 0.75;
  if (type === "Boolean") return false;
  if (type === "DateTime") return new Date();
  if (type === "Json") return {};
  if (type === "Decimal") return "0.0";
  if (type === "BigInt") return BigInt(0);
  return null;
}

async function firstId(modelKey) {
  const row = await prisma[modelKey].findFirst({ select: { id: true } });
  return row?.id || null;
}

function toClientKey(modelName) {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

async function buildCreateData(schemaText, modelName, overrides = {}) {
  const block = extractModelBlock(schemaText, modelName);
  const fields = parseModelFields(block);

  const required = fields.filter((f) => {
    if (f.isOptional) return false;
    if (f.isList) return false;
    if (["id", "createdAt", "updatedAt"].includes(f.name)) return false;

    if (!isScalarOrEnum(schemaText, f.type)) return false;

    if (f.rest.includes("@default(")) return false;
    if (f.rest.includes("@updatedAt")) return false;

    return true;
  });

  const data = {};

  for (const f of required) {
    if (Object.prototype.hasOwnProperty.call(overrides, f.name)) {
      data[f.name] = overrides[f.name];
      continue;
    }

    // required FK
    if (f.name.toLowerCase().endsWith("id") && f.type === "String") {
      const relatedModel = findRelationForFk(fields, f.name);
      if (relatedModel) {
        const relatedKey = toClientKey(relatedModel);
        if (!prisma[relatedKey]) {
          throw new Error(
            `BLOCKER: ${modelName}.${f.name} relates to ${relatedModel} but Prisma client has no "${relatedKey}" model key.`
          );
        }
        const id = await firstId(relatedKey);
        if (!id) {
          throw new Error(
            `BLOCKER: ${modelName}.${f.name} requires an existing ${relatedModel} row, but none exist. Create 1 ${relatedModel} first.`
          );
        }
        data[f.name] = id;
        continue;
      }

      throw new Error(
        `BLOCKER: ${modelName}.${f.name} is a required Id field but relation could not be inferred. Paste model ${modelName} block.`
      );
    }

    // enum
    if (isEnumType(schemaText, f.type)) {
      const enumVal = defaultForEnum(schemaText, f.type);
      if (enumVal === null) throw new Error(`BLOCKER: Cannot choose enum value for ${modelName}.${f.name} enum=${f.type}`);
      data[f.name] = enumVal;
      continue;
    }

    const def = defaultForScalar(f.type, f.name);
    if (def === null) throw new Error(`BLOCKER: No default for required field ${modelName}.${f.name} type=${f.type}`);
    data[f.name] = def;
  }

  return data;
}

// Ensurers (create if missing)
async function ensureSchool(schemaText) {
  let row = await prisma.school.findFirst({ select: { id: true } });
  if (row) return row.id;

  console.log("ℹ️ No School rows found. Creating DEMO School...");
  const data = await buildCreateData(schemaText, "School", {
    name: "Demo School",
    code: "DEMO-SCHOOL",
  });
  row = await prisma.school.create({ data, select: { id: true } });
  console.log("✅ Created School:", row);
  return row.id;
}

async function ensureClass(schemaText) {
  let row = await prisma.class.findFirst({ select: { id: true } });
  if (row) return row.id;

  console.log("ℹ️ No Class rows found. Creating DEMO Class...");

  // If Class requires schoolId, ensure School exists first.
  const schoolId = await ensureSchool(schemaText);

  const data = await buildCreateData(schemaText, "Class", {
    name: "Demo Class A",
    code: "DEMO-CLASS-A",
    schoolId, // if the model has it required, this helps; if not required, it will be ignored by our builder
  });

  row = await prisma.class.create({ data, select: { id: true } });
  console.log("✅ Created Class:", row);
  return row.id;
}

async function main() {
  const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
  const schemaText = readSchema(schemaPath);

  // Student
  const student = await prisma.student.findFirst({ select: { id: true } });
  if (!student) throw new Error("No Student rows found. Seed students first.");
  console.log("✅ Using studentId:", student.id);

  // Skill
  let skill = await prisma.skill.findFirst({ select: { id: true } });
  if (!skill) {
    console.log("ℹ️ No Skill rows found. Creating DEMO Skill...");
    const skillData = await buildCreateData(schemaText, "Skill", {
      name: "Demo Skill: Fractions",
      code: "DEMO-FRACTIONS",
      description: "Demo skill for mastery snapshots",
    });
    skill = await prisma.skill.create({ data: skillData, select: { id: true } });
    console.log("✅ Created Skill:", skill);
  } else {
    console.log("✅ Found existing Skill:", skill);
  }

  // Ensure Class (because Grade requires classId)
  const classId = await ensureClass(schemaText);

  // Grade
  let grade = await prisma.grade.findFirst({ select: { id: true } });
  if (!grade) {
    console.log("ℹ️ No Grade rows found. Creating DEMO Grade...");

    const gradeData = await buildCreateData(schemaText, "Grade", {
      studentId: student.id,
      classId,
      percent: 75,
      score: 75,
      pointsEarned: 75,
      pointsPossible: 100,
      notes: "Demo grade to generate mastery snapshot",
    });

    grade = await prisma.grade.create({ data: gradeData, select: { id: true } });
    console.log("✅ Created Grade:", grade);
  } else {
    console.log("✅ Found existing Grade:", grade);
  }

  console.log("\nCOPY THESE INTO .env:");
  console.log("DEMO_STUDENT_ID=" + student.id);
  console.log("DEMO_SKILL_ID=" + skill.id);
  console.log("DEMO_GRADE_ID=" + grade.id);
  console.log("DEMO_CLASS_ID=" + classId);
}

main()
  .catch((e) => {
    console.error("\n❌ ERROR:", e.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
