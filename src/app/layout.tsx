import type { Metadata } from "next";
import { Big_Shoulders, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import ThemeProvider from "@/components/ThemeProvider";
import "./globals.css";

// Sesión J.1.16, TAREA 1b: tipografías del sistema de diseño traducido del
// prototipo de Claude Design (función helmet del .dc.html) — reemplaza Space
// Grotesk de la Sesión J.1.15. Big Shoulders Display para títulos/números
// grandes (font-display), IBM Plex Sans como tipografía base de toda la app,
// IBM Plex Mono para valores monetarios. Las 3 cargan vía next/font/google
// (self-hosted, sin request a Google en runtime — mismo patrón que Space
// Grotesk antes). Verificado con Playwright que el font-family real llega al
// DOM renderizado, no solo al CSS (bug de la sesión anterior con Geist).
// Nota: el catálogo de next/font/google (Sesión J.1.16) no expone "Big
// Shoulders Display" como familia separada — Google Fonts la fusionó dentro
// de "Big Shoulders" a secas (confirmado en font-data.json del paquete, no
// asumido); `Big_Shoulders` es el export correcto para lo que el prototipo
// llama "Big Shoulders Display".
const bigShoulders = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});
const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
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
    <html
      lang="es"
      className={`${bigShoulders.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-fz-bg text-fz-text" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
