import { PrismaClient, Weekday } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const cha = await prisma.school.findFirst({ where: { code: 'CHA' } })
  if (!cha) { console.log('CHA school not found'); return }

  const grade7Class = await prisma.class.findFirst({
    where: { schoolId: cha.id, gradeLevel: 7 }
  })
  if (!grade7Class) { console.log('Grade 7 class not found'); return }

  // Get the existing FRIDAY entries to use the same teacherId
  const fridayEntries = await prisma.timetable.findMany({
    where: { schoolId: cha.id, classId: grade7Class.id, dayOfWeek: 'FRIDAY' }
  })
  if (fridayEntries.length === 0) { console.log('No Friday entries found to clone'); return }

  const teacherId = fridayEntries[0].teacherId
  const missingDays: Weekday[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY']

  for (const day of missingDays) {
    const existing = await prisma.timetable.findMany({
      where: { schoolId: cha.id, classId: grade7Class.id, dayOfWeek: day }
    })
    if (existing.length > 0) {
      console.log(`Day ${day} already has ${existing.length} entries, skipping`)
      continue
    }
    for (const friday of fridayEntries) {
      await prisma.timetable.create({
        data: {
          schoolId: cha.id,
          classId: grade7Class.id,
          subject: friday.subject,
          teacherId,
          dayOfWeek: day,
          periodLabel: friday.periodLabel,
          startTime: friday.startTime,
          endTime: friday.endTime,
          room: friday.room,
        }
      })
    }
    console.log(`Created ${fridayEntries.length} entries for ${day}`)
  }

  const total = await prisma.timetable.count({ where: { schoolId: cha.id, classId: grade7Class.id } })
  console.log(`Done. Total timetable records for Grade 7 CHA: ${total}`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e.message); await prisma.$disconnect() })
