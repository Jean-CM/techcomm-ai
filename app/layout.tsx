import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Techcomm AI",
  description: "Plataforma empresarial para iniciativas, operaciones e inteligencia artificial."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
