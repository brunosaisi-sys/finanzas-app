import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ResetPasswordForm from "./_components/ResetPasswordForm";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sin sesión de recuperación activa (link vencido, ya usado, o acceso directo
  // a la ruta sin pasar por el email) — no hay forma de cambiar la contraseña
  // acá. Mandar a pedir un link nuevo en vez de mostrar un formulario que va a
  // fallar. Sesión J.1.12, TAREA 3.
  if (!user) redirect("/forgot-password");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Nueva contraseña
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Elegí una contraseña nueva para tu cuenta.
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
