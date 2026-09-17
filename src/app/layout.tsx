import type { Metadata } from "next";
import { AiEditPanel } from "@/components/ai-edit-panel";
import { CodeExportPanel } from "@/components/code-export-panel";
import { OpenPencilConnector } from "@/components/openpencil-connector";
import { ReferenceLibrary } from "@/components/reference-library";
import { ResponsivePreview } from "@/components/responsive-preview";
import { ReviewPanel } from "@/components/review-panel";
import { RoundtripPanel } from "@/components/roundtrip-panel";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Design Canvas",
  description: "Design-first AI canvas with portable DESIGN.md contracts and an OpenPencil-ready structured design engine.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<ReviewPanel /><RoundtripPanel /><AiEditPanel /><ReferenceLibrary /><CodeExportPanel /><ResponsivePreview /><OpenPencilConnector /></body></html>;
}
