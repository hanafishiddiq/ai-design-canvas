import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Design Canvas",
  description: "Design-first AI canvas with portable DESIGN.md contracts and an OpenPencil-ready document model.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
