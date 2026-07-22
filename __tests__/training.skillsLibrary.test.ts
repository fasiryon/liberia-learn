import { describe, expect, it } from "vitest";
import { SKILL_ARTICLES, SKILL_CATEGORIES, getSkillsByCategory, getSkillById } from "@/lib/training/skillsLibrary";

describe("skills library content", () => {
  it("every article belongs to a real category", () => {
    const categoryIds = new Set(SKILL_CATEGORIES.map((c) => c.id));
    for (const article of SKILL_ARTICLES) {
      expect(categoryIds.has(article.category)).toBe(true);
    }
  });

  it("every category has at least one real article, not an empty placeholder", () => {
    for (const category of SKILL_CATEGORIES) {
      const articles = getSkillsByCategory(category.id);
      expect(articles.length).toBeGreaterThan(0);
    }
  });

  it("every article has genuine multi-paragraph body content, not placeholder text", () => {
    for (const article of SKILL_ARTICLES) {
      expect(article.body.length).toBeGreaterThanOrEqual(2);
      for (const paragraph of article.body) {
        expect(paragraph.length).toBeGreaterThan(80);
      }
    }
  });

  it("article ids are unique", () => {
    const ids = SKILL_ARTICLES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getSkillById finds a real article by id and returns undefined for unknown ids", () => {
    const first = SKILL_ARTICLES[0];
    expect(getSkillById(first.id)).toEqual(first);
    expect(getSkillById("does-not-exist")).toBeUndefined();
  });

  it("does not duplicate or corrupt the certification training modules array", async () => {
    const { TRAINING_MODULES } = await import("@/lib/training/modules");
    const skillIds = new Set(SKILL_ARTICLES.map((a) => a.id));
    for (const module of TRAINING_MODULES) {
      expect(skillIds.has(module.id)).toBe(false);
    }
  });
});
