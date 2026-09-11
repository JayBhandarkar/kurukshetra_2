import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Caveat } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-handwriting",
  display: "swap",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Pramaan — Understand Government Documents. Without the paperwork.",
  description:
    "Search, summarize, compare and understand government circulars, notifications, orders, guidelines and policy documents with accurate answers and trusted source references.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${caveat.variable}`}>
      <body className="font-sans antialiased bg-[#FAF8F5] text-[#1E1A17] min-h-screen selection:bg-[#5D2A18] selection:text-white">
        {children}
      </body>
    </html>
  );
}
