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

export const metadata: Metadata = {
  title: {
    default: "Talaia — vigilancia de l'Horta Sud i la Ribera",
    template: "%s",
  },
  description:
    "Semáforo de riesgo de inundación, sensores del SAIH Júcar y comparativa de modelos para Albal, Benetússer, el Mareny de Barraquetes y Benaguasil.",
  applicationName: "Talaia",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Talaia" },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
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
            </nav>
          </div>
        </header>
        <main className="layout">{children}</main>
        <PwaRegister />
      </body>
    </html>
  );
}
