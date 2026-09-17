import "./globals.css";
import type { Metadata } from "next";

import { QueryProvider } from "@/components/QueryProvider";

export const metadata: Metadata = {
  title: "Lal Motors AI Business OS",
  description: "AI-powered automotive business operating system for Lal Motors."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
