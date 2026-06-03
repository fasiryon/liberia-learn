import { describe, it, expect } from 'vitest';
import { CurriculumPayloadSchema } from '@/lib/schemas/curriculumPayload';
import { parseToSlides } from '@/lib/lessons/parseToSlides';

describe('CurriculumPayloadSchema v2 fields', () => {
  it('accepts problemSets', () => {
    const result = CurriculumPayloadSchema.safeParse({
      title: 'Test',
      grade: 5,
      subject: 'MATH',
      objectives: ['obj1'],
      body: 'x'.repeat(60),
      problemSets: [{ id: 'ps1', sectionId: 'gp1', studentPrompt: 'What is 2+2?', answerKey: '4' }],
      takeawaySummary: '- Key point 1\n- Key point 2',
      demoReady: true,
    });
    expect(result.success).toBe(true);
  });

  it('defaults problemSets to []', () => {
    const result = CurriculumPayloadSchema.safeParse({
      title: 'Test', grade: 5, subject: 'MATH', objectives: ['obj1'], body: 'x'.repeat(60),
    });
    expect(result.success).toBe(true);
    expect(result.data?.problemSets).toEqual([]);
  });
});

describe('parseToSlides Key Takeaways fix', () => {
  it('extracts Key Takeaways from mixed assessment section', () => {
    const body = `## 1. Hook
Opening story here.

## 17. Assessment, Exit Ticket, and Lesson Summary
Exit ticket: What is 2+2?

Key Takeaways:
- Addition combines numbers
- Always check your work
- Liberian currency uses LD`;
    const slides = parseToSlides({ title: 'Test', content: body });
    const lastSlide = slides[slides.length - 1];
    expect(lastSlide.title).toBe('Key Takeaways');
    expect(lastSlide.content).toContain('Addition combines numbers');
    expect(lastSlide.content).not.toContain('Exit ticket');
  });

  it('uses takeawaySummary when provided', () => {
    const body = `## 1. Hook\nsome text`;
    const slides = parseToSlides({
      title: 'Test',
      content: body,
      takeawaySummary: '- Custom summary point 1\n- Custom summary point 2',
    });
    const last = slides[slides.length - 1];
    expect(last.content).toContain('Custom summary point 1');
  });

  it('does not produce Review-the-full-lesson-text fallback for non-empty content', () => {
    const body = `Some lesson content here. This is a test lesson about mathematics.\n\nAnother paragraph about adding numbers together in Liberia.`;
    const slides = parseToSlides({ title: 'Test', content: body });
    const last = slides[slides.length - 1];
    expect(last.content).not.toContain('Review the full lesson text');
  });
});
