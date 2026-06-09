import { prisma } from "@/lib/db";

async function main() {
  const del = await prisma.curriculumContent.deleteMany({
    where: { title: "Quick Demo Lesson", teacherCreated: true, editedById: null },
  });
  console.log("Deleted orphan lessons:", del.count);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
