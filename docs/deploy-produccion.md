# Cómo poner la app online (Vercel) — guía paso a paso

> Esta guía es para que la ejecutes vos mismo. Claude Code no tiene acceso a
> tu cuenta de GitHub, Vercel ni Supabase — solo puede dejar el código listo
> y explicarte los clicks exactos. Ninguno de estos pasos tiene costo (plan
> gratuito de Vercel alcanza de sobra para un solo usuario).

## Antes de empezar: subir el código a GitHub

El repo local tiene commits que todavía no están en GitHub (Vercel se
conecta a GitHub, no a tu computadora). Desde la carpeta del proyecto:

```bash
git push origin main
```

Esto puede pedirte iniciar sesión en GitHub la primera vez (se abre el
navegador). Una vez que termine, confirmá en https://github.com/brunosaisi-sys/finanzas-app
que ves tus últimos commits.

## Paso 1 — Crear cuenta en Vercel y conectar el repo

1. Entrá a **https://vercel.com** y hacé clic en **"Sign Up"**.
2. Elegí **"Continue with GitHub"** — así Vercel se conecta directo a tu
   cuenta de GitHub, sin crear una contraseña nueva.
3. Autorizá el acceso cuando GitHub te lo pida.
4. En el dashboard de Vercel, hacé clic en **"Add New..." → "Project"**.
5. Vas a ver una lista de tus repos de GitHub. Buscá **`finanzas-app`** y
   hacé clic en **"Import"**.
   - Si no aparece: Vercel te va a ofrecer "Adjust GitHub App Permissions" —
     hacé clic ahí y dale acceso al repo `finanzas-app` específicamente (o a
     todos tus repos, como prefieras).
6. Vercel detecta automáticamente que es un proyecto Next.js — no hace falta
   tocar nada en "Build and Output Settings", los valores por defecto
   (`next build`) ya son correctos.
7. **Antes de tocar "Deploy"**, seguí el Paso 2 (las variables de entorno) —
   Vercel te deja cargarlas en esta misma pantalla, antes del primer deploy.

## Paso 2 — Variables de entorno de producción

La app necesita las mismas dos variables que ya tenés en tu archivo
`.env.local` local. En la pantalla de "Configure Project" de Vercel, buscá
la sección **"Environment Variables"** y cargá:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | (el mismo valor que tenés en `.env.local`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (el mismo valor que tenés en `.env.local`) |

Podés abrir tu `.env.local` local (en la raíz de `finanzas-app/`) para
copiar los valores exactos — son las mismas dos variables, sin cambios.

> Estas dos claves son seguras para exponer públicamente — son las
> claves "anon" pensadas para el navegador, protegidas por Row Level
> Security en Supabase (cada usuario solo puede ver sus propios datos).
> La clave `service_role` (la que SÍ sería peligroso exponer) no la usa
> esta app en ningún lado — confirmado en esta sesión revisando todo el
> código fuente.

Con las variables cargadas, hacé clic en **"Deploy"**. Vercel va a instalar
dependencias, correr el build y publicarlo — tarda 1-2 minutos. Al terminar
te da una URL del tipo `https://finanzas-app-tu-usuario.vercel.app`.

## Paso 3 — Actualizar la Redirect URL en Supabase

Esto es imprescindible: sin este paso, el login funciona pero el link de
"¿Olvidaste tu contraseña?" y la confirmación de cuenta van a redirigir a
`localhost` (que no existe en tu celular) en vez de a tu URL real. Es el
mismo concepto que ya se resolvió para que funcionara en localhost, ahora
hay que agregar la URL de producción además (no en reemplazo).

1. Entrá a **https://supabase.com/dashboard**, abrí tu proyecto de esta app.
2. En el menú lateral: **Authentication → URL Configuration**.
3. En **"Site URL"**, dejá la URL de producción como principal:
   `https://finanzas-app-tu-usuario.vercel.app` (la que te dio Vercel en el
   Paso 2 — copiala exacta, sin `/` al final).
4. En **"Redirect URLs"**, agregá (sin borrar la de localhost, por si seguís
   probando en tu computadora):
   ```
   https://finanzas-app-tu-usuario.vercel.app/auth/callback
   http://localhost:3000/auth/callback
   ```
5. Guardá los cambios.

## Paso 4 — Confirmar que quedó bien (desde tu celular)

1. Abrí la URL de Vercel desde Safari en tu iPhone (podés mandártela por
   WhatsApp/Notas y tocarla ahí).
2. Iniciá sesión con tu usuario real.
3. Cargá un gasto de prueba chico (podés borrarlo después desde
   `/gastos`) para confirmar que guarda de verdad contra Supabase, no solo
   que la pantalla carga.
4. Opcional pero recomendado: probá también "¿Olvidaste tu contraseña?"
   una vez, para confirmar que el mail de recuperación te lleva a la URL
   de producción y no a localhost (podés cancelar el cambio de contraseña
   si solo querés confirmar que el link funciona).

Si los 4 puntos funcionan, la app ya está online y usable desde tu celular.

## Después del primer deploy

Cada vez que Claude Code haga un commit nuevo y vos hagas `git push`, Vercel
redeploya automáticamente — no hay que repetir el Paso 1 ni el Paso 2 (las
variables de entorno quedan guardadas en el proyecto de Vercel). El Paso 3
tampoco se repite salvo que cambies de dominio.

## Si algo falla

- **Build falla en Vercel pero funciona local:** confirmá que las dos
  variables de entorno están cargadas exactamente igual que en
  `.env.local` (sin comillas extra, sin espacios).
- **Login funciona pero "olvidé mi contraseña" lleva a una URL que no
  carga:** revisá el Paso 3 — la Redirect URL de producción no quedó
  bien cargada en Supabase.
- **La app carga pero no ves tus datos:** confirmá que estás logueado con
  el mismo usuario de siempre (Supabase es el mismo proyecto/base en local
  y en producción, los datos son los mismos).
