import type { Metadata } from "next";
import ThemeProvider from "@/components/ThemeProvider";
import "./globals.css";

// Sesión J.1.17, TAREA 2: reemplaza las 3 fuentes de next/font/google (Big
// Shoulders, IBM Plex Sans, IBM Plex Mono — Sesión J.1.16) por el stack de
// fuente nativa del sistema (ver --font-system en globals.css). En iPhone
// esto renderiza con SF Pro (la fuente real de iOS) sin descargar ningún
// archivo de fuente — cero flash de fuente, cero request extra. La
// jerarquía visual (títulos, números hero) se logra con peso/tamaño, no con
// una familia tipográfica separada.

export const metadata: Metadata = {
  title: "Finanzas",
  description: "App de finanzas personales",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full bg-fz-bg text-fz-text" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
