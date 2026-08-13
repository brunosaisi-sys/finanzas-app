"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

// TAREA 1c (Sesión J.1.16): toggle claro/oscuro real, persistido y aplicado a
// toda la app. `next-themes` setea la clase `dark` en <html> e inyecta un
// script bloqueante antes de la hidratación (evita flash del tema incorrecto
// al cargar). `attribute="class"` es lo que activa los tokens `.dark { ... }`
// de globals.css — no depende de `prefers-color-scheme` del sistema, es un
// toggle explícito con default "light" (mismo default visual que tenía la app
// hasta ahora, para no romper la percepción de las 25 rutas no tocadas por
// esta sesión, que siguen usando colores claros hardcodeados sin reaccionar
// al modo oscuro).
export default function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
    </NextThemesProvider>
  );
}
