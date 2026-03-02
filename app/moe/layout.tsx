// app/moe/layout.tsx
// Layout for all /moe/* pages.
// No shared navigation with the school portal.
// MOE portal operates at national scope — no school context, no tenant switcher.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MOE Portal — LiberiaLearn",
  description: "Ministry of Education — National Education Platform",
};

export default function MoeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
