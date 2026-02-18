import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const validIds = ["school_mca", "school_pcs", "school_krs"];

const schools = await p.school.findMany({ select: { id: true, name: true, county: true }, orderBy: { name: "asc" } });
console.log("ALL_SCHOOLS:");
for (const s of schools) console.log("  " + s.id + " | " + s.name + " | " + (s.county || "null"));

const junkSchools = schools.filter(s => !validIds.includes(s.id));
console.log("\nJUNK_SCHOOLS:");
for (const s of junkSchools) {
  const userCount = await p.user.count({ where: { schoolId: s.id } });
  const classCount = await p.class.count({ where: { schoolId: s.id } });
  console.log("  " + s.id + " -> users:" + userCount + " classes:" + classCount);
}

await p.$disconnect();
