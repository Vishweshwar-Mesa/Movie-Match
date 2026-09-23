import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Movie Match — tonight, decided",
  description: "Two people, one pick. Swipe your way to tonight's movie or show, and exactly where to watch it.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Movie Match",
  },
};

export const viewport: Viewport = {
  themeColor: "#161221",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
