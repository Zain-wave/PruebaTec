import "./globals.css";
import type { Metadata } from "next";
import { Manrope } from "next/font/google";

const font = Manrope({ subsets: ["latin"], variable: "--font" });

export const metadata: Metadata = {
  title: "Bandeja · Operaciones",
  description: "Reportes recibidos por correo, consolidados y verificados automáticamente",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={font.variable}>
      <body>{children}</body>
    </html>
  );
}
