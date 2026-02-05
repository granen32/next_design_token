import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Next Design Tokens",
  description: "Next.js + Tailwind + Design Tokens (Tokens Studio)",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-primary text-primary">{children}</body>
    </html>
  );
}
