import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skychat — Private local AI",
  description: "A private chat interface for AI models running locally with Ollama.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
