import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

// Sesión J.1.15, TAREA 7c: tipografía con carácter propio, no la opción por
// defecto de un generador de IA (Inter/Manrope). Antes se cargaba Geist pero
// `globals.css` pisaba el font-family del body con "Arial, Helvetica,
// sans-serif" — la fuente cargada nunca se aplicaba realmente. Space Grotesk
// (geométrica, con detalles distintivos en la "G" y "S", buena legibilidad de
// números tabulares) reemplaza esto — ver "Sistema de diseño" en CLAUDE.md.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

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
    <html lang="es" className={`${spaceGrotesk.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-50" suppressHydrationWarning>{children}</body>
    </html>
  );
}
