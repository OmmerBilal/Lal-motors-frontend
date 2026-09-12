import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lal Motors AI Business OS",
  description: "AI-powered automotive business operating system for Lal Motors."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
