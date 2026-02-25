import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transparent Agentic IDE",
  description: "Logic shell for stitching Figma UI with agent workflows."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
