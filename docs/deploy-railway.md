# Deploy en Railway — guía paso a paso

> Misma app, mismo Supabase. Railway solo hostea el frontend/Next.js.
> Las dos variables públicas de Supabase son las únicas que necesitás.

## Qué ya está listo en el repo

- `railway.toml` — build (`npm ci && npm run build`) y start
- `package.json` → `start` escucha `0.0.0.0` y el puerto `$PORT` (lo exige Railway)

## Opción A — Desde la web (recomendado)

1. Subí el código a GitHub (tu branch, ej. `pancho` o `main`):
   ```bash
   git add -A && git commit -m "…"   # si tenés cambios sin commitear
   git push -u origin HEAD
   ```
2. Entrá a [railway.app](https://railway.app) → **Login** (GitHub).
3. **New Project** → **Deploy from GitHub repo** → elegí `finanzas-app`.
4. Si te pide branch, elegí la que pusheaste.
5. En el servicio → **Variables**, agregá:

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | el de tu `.env.local` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | el de tu `.env.local` |

6. **Settings → Networking → Generate Domain** (te da algo como
   `https://finanzas-app-production-xxxx.up.railway.app`).
7. Redeploy si hace falta (Variables nuevas a veces piden un redeploy).

## Opción B — Desde la terminal (CLI)

```bash
# 1. Login (abre el navegador)
railway login

# 2. Crear o vincular proyecto
railway init          # proyecto nuevo
# o: railway link     # si ya existe en el dashboard

# 3. Variables (mismas que .env.local)
railway variables set NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
railway variables set NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_…"

# 4. Dominio público
railway domain

# 5. Deploy
railway up
```

## Supabase Auth (imprescindible)

En [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto →
**Authentication → URL Configuration**:

1. **Site URL**: tu URL de Railway (sin `/` al final).
2. **Redirect URLs** (agregar, no borrar localhost):
   ```
   https://TU-APP.up.railway.app/auth/callback
   http://localhost:3000/auth/callback
   ```

Sin esto, el login con Google / “olvidé contraseña” vuelven a `localhost`.

## Checklist rápido

- [ ] Build verde en Railway
- [ ] Variables `NEXT_PUBLIC_SUPABASE_*` cargadas
- [ ] Dominio público generado
- [ ] Redirect URL de Supabase apunta a Railway
- [ ] Abrís la URL → `/login` → Google / email funciona
- [ ] Ves tus datos (mismo proyecto Supabase que en local)

## Si falla el build

- **Node viejo:** el repo pide Node ≥ 20 (`engines` en `package.json`).
- **Faltan env vars en build:** `NEXT_PUBLIC_*` se inyectan en el build de
  Next; tienen que existir **antes** del deploy, no solo en runtime.
- **Puerto:** no hardcodees `3000`; Railway setea `PORT` solo.

## Migraciones de DB

Railway **no** corre el SQL de `supabase/migrations/`. Eso sigue en el
SQL Editor de Supabase (ej. `030_share_groups.sql` si todavía no lo
ejecutaste).
