import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "GPS Track Finder — Поиск треков автопутешествий",
  description:
    "Поиск GPS-треков на форумах и сайтах автопутешественников. Найдите GPX, KMZ, KML треки для вашего маршрута.",
  keywords: ["GPS", "GPX", "автопутешествие", "трек", "маршрут", "навигация"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-stone-950 text-stone-100">
        {children}
      </body>
    </html>
  );
}
