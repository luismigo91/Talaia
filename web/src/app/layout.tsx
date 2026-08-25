import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Talaia — vigilancia de l'Horta Sud i la Ribera",
    template: "%s",
  },
  description:
    "Semáforo de riesgo de inundación, sensores del SAIH Júcar y comparativa de modelos para Albal, Benetússer, el Mareny de Barraquetes y Benaguasil.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="site">
          <div className="inner">
            <Link href="/" className="brand">
              Talaia
              <small>l&apos;Horta Sud i la Ribera</small>
            </Link>
            <nav>
              <Link href="/">Semáforo</Link>
              <Link href="/mapa">Mapa</Link>
              <Link href="/comparativa">Comparativa</Link>
            </nav>
          </div>
        </header>
        <main className="layout">{children}</main>
      </body>
    </html>
  );
}
