import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const lessons = [
  {
    contentId: "math-g5-fractions",
    grade: 5,
    subject: "MATH",
    contentType: "lesson",
    status: "published",
    version: "1.0",
    payload: {
      title: "Introduction to Fractions",
      objectives: [
        "Understand numerator and denominator",
        "Compare simple fractions",
        "Relate fractions to everyday market prices in Liberia",
      ],
      body: "A fraction represents a part of a whole. When you cut a cassava into 4 equal pieces and take 1 piece, you have one-fourth (1/4) of the cassava. The top number (numerator) tells how many parts you have. The bottom number (denominator) tells how many equal parts the whole is divided into. Fractions help us share things fairly and understand prices at the market.",
      activities: [
        "Draw a circle and divide it into 4 equal parts. Shade 3 parts — what fraction is shaded?",
        "If a bag of rice costs $10, what is 1/2 the price? What is 1/4 the price?",
      ],
    },
  },
  {
    contentId: "english-g5-reading",
    grade: 5,
    subject: "ENGLISH",
    contentType: "lesson",
    status: "published",
    version: "1.0",
    payload: {
      title: "Reading Comprehension: The River",
      objectives: [
        "Identify the main idea of a passage",
        "Find supporting details in a text",
      ],
      body: "The St. Paul River flows through the heart of Liberia, winding past villages and dense forests before reaching the Atlantic Ocean near Monrovia. For centuries, families along its banks have depended on the river for fishing, washing, and transportation. During the rainy season, the water rises high and the current grows strong, making canoe travel a true skill. Children learn early to respect the river and the life it sustains.",
      activities: [
        "What is the main idea of this passage?",
        "List 2 supporting details that tell how people use the river.",
      ],
    },
  },
  {
    contentId: "science-g5-plants",
    grade: 5,
    subject: "SCIENCE",
    contentType: "lesson",
    status: "published",
    version: "1.0",
    payload: {
      title: "How Plants Make Food",
      objectives: [
        "Understand the process of photosynthesis",
        "Name what plants need to grow",
      ],
      body: "Plants use sunlight, water, and carbon dioxide from the air to make their own food through a process called photosynthesis. This happens mostly in the leaves, which contain a green substance called chlorophyll. Chlorophyll captures sunlight energy and uses it to turn water and air into sugar that the plant uses for growth. Oxygen is released as a byproduct — this is the air we breathe!",
      activities: [
        "Name 3 plants found near your school and describe their leaves.",
        "Draw a plant and label the roots, stem, and leaves. Add arrows showing where water, sunlight, and air enter.",
      ],
    },
  },
];

async function main() {
  for (const lesson of lessons) {
    await prisma.curriculumContent.upsert({
      where: { contentId: lesson.contentId },
      update: {
        grade: lesson.grade,
        subject: lesson.subject,
        contentType: lesson.contentType,
        status: lesson.status,
        version: lesson.version,
        payload: lesson.payload,
      },
      create: lesson,
    });
    console.log(`Upserted: ${lesson.contentId}`);
  }
  console.log(`Done — ${lessons.length} lessons upserted.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
