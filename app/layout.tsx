import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zancada · Tu plan de running",
  description: "Entrena con un plan personal, registra tus carreras y revisa cada ajuste.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
