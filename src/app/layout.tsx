// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Providers } from "@/components/providers";
import "@/app/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "OliveHaus PPMA - Project Management",
    template: "%s | OliveHaus PPMA",
  },
  description: "Private Project Management Web Application for OliveHaus Interior - Streamline communication between super admins, project managers, and clients.",
  keywords: [
    "project management",
    "interior design",
    "olivehaus",
    "task management",
    "client communication",
    "project tracking",
  ],
  authors: [
    {
      name: "Ighoshemu John Rhunor",
      url: "https://github.com/rhunor",
    },
  ],
  creator: "Ighoshemu John Rhunor",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_APP_URL,
    title: "OliveHaus PPMA - Project Management",
    description: "Private Project Management Web Application for OliveHaus Interior",
    siteName: "OliveHaus PPMA",
  },
  twitter: {
    card: "summary_large_image",
    title: "OliveHaus PPMA - Project Management",
    description: "Private Project Management Web Application for OliveHaus Interior",
    creator: "@olivehaus",
  },
  robots: {
    index: false, // Private application
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <div className="flex-1">
              {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}