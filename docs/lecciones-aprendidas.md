# Lecciones aprendidas

> Registro de errores y sorpresas para no repetirlos.
> Formato: qué pasó → por qué → qué hacer la próxima vez.

---

## 1. PowerShell vs. Bash — herramientas incompatibles

**Qué pasó:** `Start-Process -FilePath "npx"` falló en PowerShell al intentar levantar el
dev server en background, porque `npx` es un archivo `.cmd`, no un ejecutable nativo.

**Por qué:** PowerShell no resuelve `.cmd` automáticamente con `Start-Process`. Necesita
`cmd.exe` como intermediario.

**Qué hacer:** Para levantar el dev server en background, usar la herramienta `Bash`:
```bash
cd "d:/Documents/App finanzas/finanzas-app" && npm run dev > /tmp/nextdev.log 2>&1 &
```
Elegir una sola herramienta por tarea y ser consistente. Comandos de PowerShell
(`New-Item`, `Copy-Item`, `Remove-Item`) no funcionan en Bash y viceversa.

---

## 2. Scripts de QA — resolución de módulos

**Qué pasó:** Script `qa-session.mjs` falló con `ERR_MODULE_NOT_FOUND` para `@playwright/test`
al ejecutarse desde el directorio scratchpad temporal.

**Por qué:** Node.js con ESM resuelve módulos desde el directorio de trabajo. `@playwright/test`
está instalado en `finanzas-app/node_modules/`, no en el scratchpad.

**Qué hacer:** Siempre ejecutar scripts de QA desde el directorio `finanzas-app/`. Copiar
el script ahí temporalmente si es necesario, y eliminarlo después del commit.

---

## 3. Acentos en Playwright — selectores de texto

**Qué pasó:** `page.locator("button[type='button']").filter({ hasText: /^Credito$/ })`
agotó su timeout sin encontrar el botón "Crédito".

**Por qué:** La regex `/^Credito$/` no matchea "Crédito" porque `é` (U+00E9) ≠ `e`.
Playwright es exacto con caracteres Unicode.

**Qué hacer:** Iterar sobre los botones y comparar `textContent()` con regex que tolere el acento:
```javascript
var btns = page.locator("button[type='button']");
for (var i = 0; i < await btns.count(); i++) {
  if (/cr.dito/i.test(await btns.nth(i).textContent())) {
    await btns.nth(i).click(); break;
  }
}
```

---

## 4. Redirects intencionales — no declarar bug sin verificar

**Qué pasó:** El script reportó como bug que `/nuevo-gasto` no redirigía a `/gastos`
después de guardar.

**Por qué:** `/nuevo-gasto` redirige intencionalmente a `/` (Dashboard). Es la ruta de
acción rápida para iOS Shortcuts, y llevar al usuario al Dashboard es el comportamiento
correcto.

**Qué hacer:** Antes de declarar que "no redirigió", verificar en el código cuál es el
`redirectTo` esperado. Los redirects intencionales están documentados en CLAUDE.md
(sección "QA — Selectores correctos").

---

## 5. Hardcodeo de credenciales en scripts — prohibido

**Qué pasó:** Se hardcodearon la URL y la anon key de Supabase directamente dentro de
un script de QA temporal.

**Por qué:** Era más rápido que leer `.env.local`. El script fue eliminado sin commitear,
pero el riesgo de exponerlo era real.

**Qué hacer:** Nunca hardcodear credenciales. Leerlas siempre de `.env.local`:
```javascript
import { readFileSync } from "fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").trim().split("\n")
    .filter(l => l.includes("="))
    .map(l => l.split("="))
);
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
```

---

## 6. Formulario de inversiones — orden de campos contraintuitivo

**Qué pasó:** Se creó una posición AAPL con 150 unidades @ PA $10 cuando la intención era
10 unidades @ $150. Los valores se invirtieron al completar los campos.

**Por qué:** El formulario muestra Cantidad antes que Precio Promedio, lo opuesto al orden
mental habitual ("tengo X acciones a $Y"). El script (o el usuario) completó en el orden
mental, no en el orden del formulario.

**Qué hacer:** Al usar `/inversiones/nueva`, recordar: primero Cantidad, luego Precio.
En Sesión J, rediseñar el orden a Precio → Cantidad. La posición AAPL incorrecta queda
como fixture roto hasta que exista UI de eliminación en `/inversiones`.

---

## 7. Falso positivo de timing — badge en páginas con fetch remoto

**Qué pasó:** El script reportó "Badge Objetivo ausente" en `/objetivos` después de crear
un objetivo exitosamente.

**Por qué:** La página usa Server Components con fetch a Supabase free tier, que puede
tardar >20s al despertar del plan dormido. El `loading.tsx` es un skeleton puro sin texto,
así que `page.content()` durante la carga no contenía el badge. El objetivo SÍ se creó
(confirmado porque el cleanup lo archivó exitosamente).

**Qué hacer:** Al verificar texto en páginas con fetch remoto: esperar que la URL esté
estabilizada Y agregar un `waitForTimeout` adicional (≥1-2 segundos) antes de `page.content()`.
Confirmar que el dato se creó vía API antes de declarar el badge como bug.

---

## 8. Cuentas padre (contenedores) — sin botón Eliminar propio

**Qué pasó:** En el script de QA de Sesión G, el cleanup de "Multi Test QA" falló porque
la cuenta tenía bolsillos hijos y el contenedor padre no tenía botón "Eliminar" propio en la UI.

**Por qué:** En `/cuentas`, los contenedores padres se renderizan como un header sin
`CuentaActions`. Para eliminar un contenedor, primero hay que borrar todos sus hijos
(o el DELETE de postgres falla por FK violation).

**Qué hacer en scripts de QA:** Al borrar cuentas con bolsillos, borrar hijos primero
vía supabase client, luego el padre. Ver `qa-cleanup.mjs` como patrón.
En la UI: la Sesión G corrigió esto — los contenedores padre ahora tienen `CuentaActions`
con Editar y Eliminar. Eliminar devuelve error FK si aún tiene hijos, lo que es la
restricción correcta.

---

## 9. Migración sin service_role key — ejecución manual en Supabase

**Qué pasó:** La migración 014 (`convert_account_to_parent`) no pudo ejecutarse
programáticamente porque solo está disponible la `anon_key` en `.env.local`.

**Por qué:** DDL (CREATE FUNCTION) requiere el rol `postgres` o la `service_role_key`.
La `anon_key` solo puede ejecutar queries con RLS. El Supabase CLI tampoco estaba
autenticado (sin access token).

**Qué hacer:** Ejecutar el SQL directamente en el SQL Editor del dashboard de Supabase.
El archivo está en `supabase/migrations/014_convert_account_to_parent.sql`.
Pendiente de ejecución antes de habilitar el botón "+ bolsillo" en cuentas existentes.
