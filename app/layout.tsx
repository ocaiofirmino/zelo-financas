import type { Metadata } from "next";
import "./finance.css";

export const metadata: Metadata = {
  title: "Zelo · Finanças pessoais",
  description: "Seus gastos, seu mês e espaço para economizar.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/zelo-favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/zelo-icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/favicon.ico",
    apple: { url: "/zelo-apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
