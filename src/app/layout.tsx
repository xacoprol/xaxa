import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces } from "next/font/google";
import { AppSplash } from "@/components/brand/app-splash";
import { PwaRegister } from "@/components/pwa/register";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://xx.xacoprol.com";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "X — Gestión del hogar",
    template: "%s · X",
  },
  description: "Aplicación familiar de gastos, menús e hipoteca",
  applicationName: "X",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "X",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#102038" },
    { media: "(prefers-color-scheme: dark)", color: "#102038" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${figtree.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh font-sans antialiased overscroll-none">
        <AppSplash />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
