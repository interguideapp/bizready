import type { Metadata, Viewport } from "next";
import { Heebo, JetBrains_Mono } from "next/font/google";
import { PwaSetup } from "@/components/pwa-setup";
import { MotionProvider } from "@/components/motion";
import { Toaster } from "@/components/toaster";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

// Mono for data readouts (scores, counts, dates, money) — the "instrument panel"
// numerals that give the deck its precise, systems-grade feel.
const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "BizReady — העסק שלך, מוכן באמת",
  description:
    "כל מה שעסק חדש בישראל צריך — רישום, מיסים, ביטוחים, דיגיטל — בתכנית אישית אחת עם מעקב וציון מוכנות",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "BizReady",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

// Command Deck is the identity of the product — the app is locked to the dark
// deck so every user gets the futuristic look (no light "same as before" theme).
const themeInit = `document.documentElement.classList.add("dark")`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${mono.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <MotionProvider>{children}</MotionProvider>
        <Toaster />
        <PwaSetup />
      </body>
    </html>
  );
}
