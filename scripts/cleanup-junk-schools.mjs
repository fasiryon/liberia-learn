import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const validIds = ["school_mca", "school_pcs", "school_krs"];

const schools = await p.school.findMany({ select: { id: true, name: true } });
const junkSchools = schools.filter(s => !validIds.includes(s.id));

console.log("Junk schools to remove:", junkSchools.length);

for (const s of junkSchools) {
  console.log("\n--- Cleaning: " + s.name + " (" + s.id + ") ---");

  // Find all classes in this school
  const classes = await p.class.findMany({ where: { schoolId: s.id }, select: { id: true } });
  const classIds = classes.map(c => c.id);

  if (classIds.length > 0) {
    // Delete enrollments
    await p.enrollment.deleteMany({ where: { classId: { in: classIds } } });

    // Delete scheduled work progress -> scheduled work
    const sw = await p.scheduledWork.findMany({ where: { classId: { in: classIds } }, select: { id: true } });
    if (sw.length > 0) {
      await p.studentProgress.deleteMany({ where: { scheduledWorkId: { in: sw.map(w => w.id) } } });
    }
    await p.scheduledWork.deleteMany({ where: { classId: { in: classIds } } });

    // Delete homework submissions -> homework
    const homework = await p.homework.findMany({ where: { classId: { in: classIds } }, select: { id: true } });
    if (homework.length > 0) {
      await p.homeworkSubmission.deleteMany({ where: { homeworkId: { in: homework.map(h => h.id) } } });
      await p.homework.deleteMany({ where: { id: { in: homework.map(h => h.id) } } });
    }

    // Delete meetings + attendance
    const meetings = await p.meeting.findMany({ where: { classId: { in: classIds } }, select: { id: true } });
    if (meetings.length > 0) {
      await p.attendanceRecord.deleteMany({ where: { meetingId: { in: meetings.map(m => m.id) } } });
      await p.meeting.deleteMany({ where: { classId: { in: classIds } } });
    }

    // Delete grades
    try { await p.grade.deleteMany({ where: { classId: { in: classIds } } }); } catch {}

    // Delete classes
    await p.class.deleteMany({ where: { schoolId: s.id } });
    console.log("  Deleted " + classIds.length + " classes and related data");
  }

  // Find users in this school
  const users = await p.user.findMany({ where: { schoolId: s.id }, select: { id: true, role: true } });
  const userIds = users.map(u => u.id);
  const studentUserIds = users.filter(u => u.role === "STUDENT").map(u => u.id);

  // Delete student-related data
  if (studentUserIds.length > 0) {
    const students = await p.student.findMany({ where: { userId: { in: studentUserIds } }, select: { id: true } });
    const studentIds = students.map(s => s.id);
    if (studentIds.length > 0) {
      await p.studentGuardian.deleteMany({ where: { studentId: { in: studentIds } } });
      await p.studentProgress.deleteMany({ where: { studentId: { in: studentUserIds } } });
      // Delete chat messages referencing these students
      try { await p.chatMessage.deleteMany({ where: { studentId: { in: studentIds } } }); } catch {}
      // Delete placement tests
      try { await p.placementTest.deleteMany({ where: { studentId: { in: studentIds } } }); } catch {}
      // Delete student records
      await p.student.deleteMany({ where: { id: { in: studentIds } } });
      console.log("  Deleted " + studentIds.length + " student records");
    }
  }

  // Delete audit/notification logs, chat messages for these users
  if (userIds.length > 0) {
    try { await p.auditLog.deleteMany({ where: { userId: { in: userIds } } }); } catch {}
    try { await p.notificationLog.deleteMany({ where: { userId: { in: userIds } } }); } catch {}
    try { await p.chatMessage.deleteMany({ where: { userId: { in: userIds } } }); } catch {}
  }

  // Delete invite tokens, password reset tokens
  try { await p.inviteToken.deleteMany({ where: { schoolId: s.id } }); } catch {}

  // Delete users
  if (userIds.length > 0) {
    await p.user.deleteMany({ where: { schoolId: s.id } });
    console.log("  Deleted " + userIds.length + " users");
  }

  // Delete the school
  await p.school.delete({ where: { id: s.id } });
  console.log("  SCHOOL DELETED: " + s.name);
}

// Verify
const remaining = await p.school.findMany({ select: { id: true, name: true, county: true }, orderBy: { name: "asc" } });
console.log("\n=== REMAINING SCHOOLS ===");
for (const s of remaining) console.log("  " + s.name + " (" + s.id + ") | county: " + (s.county || "null"));

await p.$disconnect();
