import { prisma } from "@/lib/db";

const DEFAULT_ITEMS = [
  { title: "School profile complete", description: "County, district, and contact details are filled", sortOrder: 1 },
  { title: "Branding set", description: "Primary color or logo configured", sortOrder: 2 },
  { title: "Teacher onboarded", description: "At least one teacher invited or active", sortOrder: 3 },
  { title: "Class created", description: "At least one class created", sortOrder: 4 },
  { title: "Students enrolled", description: "At least one class has enrolled students", sortOrder: 5 },
  { title: "Guardian links started", description: "At least 20% of students linked to guardians", sortOrder: 6 },
  { title: "Offline sync verified", description: "Offline completion and sync tested", sortOrder: 7 },
  { title: "Kiosk/shared device tested", description: "Shared device workflow verified", sortOrder: 8 },
];

export async function ensurePilotChecklistItems() {
  const count = await prisma.pilotChecklistItem.count();
  if (count > 0) return;

  await prisma.pilotChecklistItem.createMany({
    data: DEFAULT_ITEMS.map((item) => ({
      title: item.title,
      description: item.description,
      sortOrder: item.sortOrder,
      active: true,
    })),
  });
}
