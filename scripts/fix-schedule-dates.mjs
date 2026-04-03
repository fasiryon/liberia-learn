import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

// Reset all scheduled work dates to yesterday/today/tomorrow relative to now
const now = new Date();
const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const yesterday = new Date(today.getTime() - 86400000);
const tomorrow = new Date(today.getTime() + 86400000);

console.log("Today (UTC):", today.toISOString());
console.log("Yesterday:", yesterday.toISOString());
console.log("Tomorrow:", tomorrow.toISOString());

// The seed creates these IDs with specific date intentions:
// sw_mca_1 -> yesterday
// sw_mca_2 -> today      (student should see this!)
// sw_mca_3 -> tomorrow
// sw_pcs_1 -> yesterday
// sw_pcs_2 -> today
// sw_krs_1 -> yesterday

const updates = [
  { id: "sw_mca_1", date: yesterday },
  { id: "sw_mca_2", date: today },
  { id: "sw_mca_3", date: tomorrow },
  { id: "sw_pcs_1", date: yesterday },
  { id: "sw_pcs_2", date: today },
  { id: "sw_krs_1", date: yesterday },
];

let updated = 0;
for (const u of updates) {
  try {
    await p.scheduledWork.update({
      where: { id: u.id },
      data: { scheduledDate: u.date },
    });
    console.log("  Updated " + u.id + " -> " + u.date.toISOString());
    updated++;
  } catch (e) {
    console.log("  SKIP " + u.id + " (not found)");
  }
}

// Also reset student progress dates for sw_mca_1 to yesterday
const prog = await p.studentProgress.updateMany({
  where: { scheduledWorkId: "sw_mca_1" },
  data: { startedAt: yesterday, completedAt: yesterday },
});
console.log("  Reset " + prog.count + " progress records to yesterday");

// Verify: what does today look like for seeded demo students?
const todayWork = await p.scheduledWork.findMany({
  where: {
    scheduledDate: { gte: today, lt: tomorrow },
  },
  select: { id: true, scheduledDate: true, classId: true, content: { select: { contentId: true, status: true } } },
});
console.log("\n=== TODAY'S WORK ===");
for (const w of todayWork) {
  console.log("  " + w.id + " | " + w.content.contentId + " | status=" + w.content.status + " | class=" + w.classId);
}

console.log("\nUpdated " + updated + " schedule entries. Done!");
await p.$disconnect();
