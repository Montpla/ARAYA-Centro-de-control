import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Centro de Control ARAYA",
  description:
    "Avance, planificación, edificios, viviendas, proveedores y agente de datos de la obra ARAYA.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

