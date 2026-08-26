import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Logo } from "@/components/Logo";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "900"],
  variable: "--talaia-display",
  display: "swap",
});
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--talaia-sans",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--talaia-mono",
  display: "swap",
});

const SITE_URL = process.env.SITE_URL ?? "https://talaia.luismi.dev";
const DESCRIPTION =
  "Semáforo de riesgo de inundación, sensores del SAIH Júcar y comparativa de modelos para Albal, Benetússer, el Mareny de Barraquetes y Benaguasil.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Talaia — vigilancia de l'Horta Sud i la Ribera",
    template: "%s",
  },
  description: DESCRIPTION,
  applicationName: "Talaia",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Talaia" },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "Talaia",
    title: "Talaia — vigilancia de l'Horta Sud i la Ribera",
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "es_ES",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Talaia" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Talaia — vigilancia de l'Horta Sud i la Ribera",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f6e7a" },
    { media: "(prefers-color-scheme: dark)", color: "#0b191f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <header className="site">
          <div className="inner">
            <Link href="/" className="brand">
              <Logo size={30} />
              <span>
                <span className="word">Talaia</span>
                <small>l&apos;Horta Sud i la Ribera</small>
              </span>
            </Link>
            <nav>
              <Link href="/">Semáforo</Link>
              <Link href="/mapa">Mapa</Link>
              <Link href="/avisos">Avisos</Link>
              <Link href="/comparativa">Comparativa</Link>
              <Link href="/verificacion">Verificación</Link>
              <Link href="/embalses">Embalses</Link>
              <Link href="/como-funciona">Método</Link>
            </nav>
          </div>
        </header>
        <main className="layout">{children}</main>
        <PwaRegister />
      </body>
    </html>
  );
}
