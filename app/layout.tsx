import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "araya-centro-control.enriquemontesplaza.chatgpt.site";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const imageUrl = new URL("/og.png", `${protocol}://${host}`).toString();
  const description =
    "Avance, implantación, edificios, apartamentos, urbanismo y agente de datos de la obra ARAYA.";

  return {
    title: "Centro de Control ARAYA",
    description,
    openGraph: {
      title: "Centro de Control ARAYA",
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: "Centro de Control ARAYA" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Centro de Control ARAYA",
      description,
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

