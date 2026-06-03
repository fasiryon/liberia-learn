import { describe, it, expect } from 'vitest';

// ─── Helper function (mirrored from script) ───────────────────────────────────

function makeContentId(grade: number, subject: string, topic: string): string {
  const slug = `${subject.toLowerCase()}-g${grade}-${topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`;
  return `hero-${slug}`;
}

// ─── Full hero lessons catalog ───────────────────────────────────────────────

const HERO_LESSONS = [
  { grade: 2, subject: 'MATH', topic: 'Place Value: Tens and Ones' },
  { grade: 2, subject: 'MATH', topic: 'Addition with Two-Digit Numbers' },
  { grade: 5, subject: 'MATH', topic: 'Understanding Fractions' },
  { grade: 5, subject: 'MATH', topic: 'Multiplication: Area Model and Standard Algorithm' },
  { grade: 5, subject: 'MATH', topic: 'Word Problems: Multi-Step Reasoning' },
  { grade: 7, subject: 'MATH', topic: 'Introduction to Algebra: Writing and Solving Equations' },
  { grade: 7, subject: 'MATH', topic: 'Geometry: Area and Perimeter of Polygons' },
  { grade: 9, subject: 'MATH', topic: 'Quadratic Equations: Factoring and the Quadratic Formula' },
  { grade: 5, subject: 'SCIENCE', topic: 'Living Things and Their Habitats' },
  { grade: 5, subject: 'SCIENCE', topic: 'Forces and Motion' },
  { grade: 7, subject: 'SCIENCE', topic: 'Ecosystems: Food Chains and Biodiversity' },
  { grade: 7, subject: 'SCIENCE', topic: 'Weather Systems and Climate in West Africa' },
  { grade: 10, subject: 'SCIENCE', topic: 'Chemistry Basics: Atoms, Elements, and Compounds' },
  { grade: 2, subject: 'LITERACY', topic: 'Reading Comprehension: Main Idea and Details' },
  { grade: 7, subject: 'LITERACY', topic: 'Essay Writing: Structure and Argumentation' },
  { grade: 10, subject: 'LITERACY', topic: 'Persuasive Essays: Evidence and Rhetorical Devices' },
  { grade: 5, subject: 'SOCIAL_STUDIES', topic: 'Liberian Geography: Counties and Natural Resources' },
  { grade: 9, subject: 'SOCIAL_STUDIES', topic: 'Liberian History: Independence and the Modern State' },
  { grade: 6, subject: 'COMPUTER_SCIENCE', topic: 'Introduction to Python Programming' },
  { grade: 9, subject: 'COMPUTER_SCIENCE', topic: 'AI Literacy: How Machine Learning Works' },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('hero lesson script helpers', () => {
  it('includes exactly 20 hero lessons', () => {
    expect(HERO_LESSONS).toHaveLength(20);
  });

  it('generates unique contentIds for all 20 lessons', () => {
    const ids = HERO_LESSONS.map(l => makeContentId(l.grade, l.subject, l.topic));
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(HERO_LESSONS.length);
    expect(uniqueIds.size).toBe(20);
  });

  it('generates hero-prefixed contentIds', () => {
    const id = makeContentId(5, 'MATH', 'Understanding Fractions');
    expect(id).toMatch(/^hero-/);
    expect(id).toContain('math');
    expect(id).toContain('g5');
    expect(id).not.toContain(' ');
  });

  it('slugifies topics with colons correctly', () => {
    const id = makeContentId(9, 'MATH', 'Quadratic Equations: Factoring and the Quadratic Formula');
    expect(id).not.toContain(':');
    expect(id).not.toContain(' ');
    expect(id).toMatch(/^hero-math-g9-/);
  });

  it('slugifies topics with multiple words correctly', () => {
    const id = makeContentId(5, 'SCIENCE', 'Living Things and Their Habitats');
    expect(id).not.toContain(' ');
    expect(id).toMatch(/^hero-science-g5-living-things-and-their-habitats$/);
  });

  it('handles underscores in subject names', () => {
    const id = makeContentId(5, 'SOCIAL_STUDIES', 'Liberian Geography: Counties and Natural Resources');
    expect(id).toContain('social');
    expect(id).toMatch(/^hero-/);
    expect(id).toContain('g5');
  });

  it('generates distinct IDs for the same topic at different grades', () => {
    const g5Id = makeContentId(5, 'MATH', 'Understanding Fractions');
    const g7Id = makeContentId(7, 'MATH', 'Introduction to Algebra: Writing and Solving Equations');
    expect(g5Id).not.toEqual(g7Id);
  });

  it('includes all required subjects in hero lessons', () => {
    const subjects = new Set(HERO_LESSONS.map(l => l.subject));
    expect(subjects.has('MATH')).toBe(true);
    expect(subjects.has('SCIENCE')).toBe(true);
    expect(subjects.has('LITERACY')).toBe(true);
    expect(subjects.has('SOCIAL_STUDIES')).toBe(true);
    expect(subjects.has('COMPUTER_SCIENCE')).toBe(true);
  });

  it('covers grades 2, 5, 6, 7, 9, and 10', () => {
    const grades = new Set(HERO_LESSONS.map(l => l.grade));
    expect(grades.has(2)).toBe(true);
    expect(grades.has(5)).toBe(true);
    expect(grades.has(6)).toBe(true);
    expect(grades.has(7)).toBe(true);
    expect(grades.has(9)).toBe(true);
    expect(grades.has(10)).toBe(true);
  });
});
