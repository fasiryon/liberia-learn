"use client";

import { useMemo, useState } from "react";
import type { SkillArticle, SkillCategory } from "@/lib/training/skillsLibrary";

export function TeacherSkillsLibrary({
  categories,
  articles,
}: {
  categories: SkillCategory[];
  articles: SkillArticle[];
}) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);

  const filteredArticles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles
      .filter((a) => a.category === activeCategory)
      .filter(
        (a) =>
          !q ||
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.body.some((p) => p.toLowerCase().includes(q))
      );
  }, [articles, activeCategory, query]);

  const activeCategoryDef = categories.find((c) => c.id === activeCategory) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teaching Skills Library</h1>
        <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
          Practical, Liberia-context teaching techniques organized by topic. Reference material
          you can apply immediately in your classroom. This is separate from Training Center
          certification modules under Your Training.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--ll-border)] pb-4">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => {
              setActiveCategory(category.id);
              setOpenArticleId(null);
            }}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              activeCategory === category.id
                ? "bg-[var(--ll-surface-muted)] text-[var(--ll-text-faint)]"
                : "border border-[var(--ll-border)] bg-[var(--ll-bg)] text-[var(--ll-text)] hover:bg-[var(--ll-surface)]"
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {activeCategoryDef ? (
        <p className="text-sm text-[var(--ll-text-muted)]">{activeCategoryDef.description}</p>
      ) : null}

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search this category"
        className="w-full max-w-md rounded-md border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
      />

      <div className="space-y-3">
        {filteredArticles.length === 0 ? (
          <p className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm text-[var(--ll-text-muted)]">
            No articles match your search in this category.
          </p>
        ) : (
          filteredArticles.map((article) => {
            const open = openArticleId === article.id;
            return (
              <div
                key={article.id}
                className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"
              >
                <button
                  type="button"
                  onClick={() => setOpenArticleId(open ? null : article.id)}
                  className="flex w-full items-start justify-between gap-4 text-left"
                >
                  <div>
                    <h2 className="text-base font-semibold">{article.title}</h2>
                    <p className="mt-1 text-sm text-[var(--ll-text-muted)]">{article.summary}</p>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--ll-text-faint)]">
                    {article.estimatedMinutes} min read
                  </span>
                </button>
                {open ? (
                  <div className="mt-4 space-y-3 border-t border-[var(--ll-border)] pt-4 text-sm leading-relaxed">
                    {article.body.map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
