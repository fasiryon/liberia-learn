import { notFound } from "next/navigation";
import { TextbookReader } from "@/components/textbooks/TextbookReader";
import { demoBook } from "@/components/textbooks/demoBook";

export const dynamic = "force-dynamic";
export const metadata = { title: "Synthetic textbook showcase | LiberiaLearn" };

export default function TextbookDemoPage({ searchParams = {} }: { searchParams?: { case?: string } } = {}) {
  if (process.env.NODE_ENV === "production") notFound();
  const book = searchParams.case === "unavailable" ? { ...demoBook, id: "synthetic-unavailable", pages: [] } : searchParams.case === "missing-asset" ? { ...demoBook, id: "synthetic-missing-asset", pages: demoBook.pages.map((page,i) => i ? page : { ...page, image: { src: "/textbooks/synthetic-missing-illustration.png", alt: "Synthetic missing illustration: two equal halves of one whole." } }) } : demoBook;
  const reader = <TextbookReader key={book.id} book={book} backHref="/pilot-preview" />;
  return searchParams.case === "narrow-frame" ? <div style={{ maxWidth: 900, margin: "auto" }}>{reader}</div> : reader;
}
