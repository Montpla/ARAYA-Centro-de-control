import type { Metadata, Viewport } from "next";
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
    applicationName: "Bricket Control",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: "/bricket-mark.png", type: "image/png", sizes: "225x225" }],
      apple: [{ url: "/bricket-mark.png", type: "image/png", sizes: "225x225" }],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Bricket Control",
    },
    formatDetection: {
      telephone: false,
    },
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#232420",
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

