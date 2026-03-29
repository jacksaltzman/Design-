import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Design Taste",
  description: "Discover your design preferences through swipes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
