// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { ConsentGate } from "@/components/ConsentGate";
import { CookieNotice } from "@/components/CookieNotice";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LiberiaLearn",
  description: "AI-powered learning platform for Liberia",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[var(--ll-bg)] text-[var(--ll-text)]`}>
        {children}
        <ConsentGate />
        <CookieNotice />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
