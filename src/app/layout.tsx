import type { Metadata } from "next";
import { Montserrat, Source_Sans_3 } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-montserrat",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-source-sans",
});

export const metadata: Metadata = {
  title: "Cursor Analytics — Gran",
  description: "Métricas de uso do Cursor pela engenharia",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${montserrat.variable} ${sourceSans.variable}`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
