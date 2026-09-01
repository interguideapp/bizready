import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { PwaSetup } from "@/components/pwa-setup";
import { MotionProvider } from "@/components/motion";
import { Toaster } from "@/components/toaster";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
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

// applied before paint so the saved theme never flashes
const themeInit = `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full`} suppressHydrationWarning>
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
