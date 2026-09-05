// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { ConsentGate } from "@/components/ConsentGate";
import { CookieNotice } from "@/components/CookieNotice";
import { PwaLifecycleStatus } from "@/components/PwaLifecycleStatus";
import { LowBandwidthModeScript } from "@/components/LowBandwidthModeScript";

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
        <LowBandwidthModeScript />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--ll-yellow)] focus:text-black focus:rounded"
        >
          Skip to main content
        </a>
        {children}
        <ConsentGate />
        <CookieNotice />
        <ServiceWorkerRegistration />
        <PwaLifecycleStatus />
      </body>
    </html>
  );
}
