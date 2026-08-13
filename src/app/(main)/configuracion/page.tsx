import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import SettingsToggles from "./_components/SettingsToggles";

// TAREA 1e (Sesión J.1.16): pantalla nueva /configuracion, layout tomado del
// prototipo de Claude Design. Solo incluye controles respaldados por una
// funcionalidad real de la app (modo claro/oscuro, ocultar saldos, cerrar
// sesión) — se omiten a propósito "Moneda principal" y "Notificaciones de
// vencimientos" del mock: no existe ninguna lógica real detrás de esos
// controles hoy (moneda principal no es un concepto en el modelo de datos;
// notificaciones push no están implementadas), y agregar un toggle sin efecto
// real violaría la regla del proyecto de no inventar funcionalidad.
export default function ConfiguracionPage() {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-6 pb-24 bg-fz-bg min-h-screen -mt-[1px]">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/" className="text-fz-text" aria-label="Volver">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="font-display font-extrabold text-2xl text-fz-text uppercase tracking-wide">
          Configuración
        </h1>
      </div>

      <SettingsToggles />

      <div className="text-center pt-2">
        <LogoutButton variant="block" />
      </div>
    </div>
  );
}
