import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudentAccessibilityControl } from "@/components/student/StudentAccessibilityControl";

describe("student accessibility control", () => {
  it("exposes the existing native keyboard-operable toggle with screen-reader labels on mobile layouts", () => {
    const html = renderToStaticMarkup(<StudentAccessibilityControl />);
    expect(html).toContain("<button");
    expect(html).toContain('aria-label="Accessibility mode off');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Student accessibility controls");
    expect(html).toContain("bottom-24");
  });
});
