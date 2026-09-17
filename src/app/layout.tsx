import type { Metadata } from "next";
import { OpenPencilConnector } from "@/components/openpencil-connector";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Design Canvas",
  description: "Design-first AI canvas with portable DESIGN.md contracts and an OpenPencil-ready structured design engine.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<OpenPencilConnector /></body></html>;
}
