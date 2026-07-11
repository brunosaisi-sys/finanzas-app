# CLAUDE.md — Contexto del proyecto para Claude Code

> Este archivo es leído automáticamente por Claude Code al iniciar cada sesión.
> Define el proyecto, las reglas de trabajo y dónde encontrar el contexto completo.

## Qué es este proyecto

App de finanzas personales (single-user) para iPhone vía **PWA**. Gestiona ingresos,
gastos, inversiones, reservas en dólares, y **fondos de amortización y mantenimiento
por bien** (Sinking Funds), con una base teórica financiera rigurosa y ajuste a la
realidad económica argentina.

## Estado actual del proyecto

Phase 2 completada. Motor financiero testeado, pantallas principales implementadas.
Commit `92e6277` (sobre `67748e4`): inversiones con TNA en tiempo real para FCI vía
ArgentinaDatos (4 categorías, match fuzzy por nombre) + `HoldingPriceEdit` para precio
manual en acciones/CEDEARs; tarjeta de crédito como `AccountType` con `closing_day`/
`due_day` en `accounts` + cálculo real de due_date por ciclo de facturación; `AmountInput`
con separador de miles (es-AR) al blur para todos los inputs ARS.

## Qué existe hoy

### Motor financiero (`src/lib/finance/`)
- `sinkingFund.ts` — Motor puro de cálculo: `calcSinkingFund`, `calcMaintenance`,
  `calcCurrentValue` (depreciación 16%/año §1.3), `calcAssetFunds`, tabla
  `ASSET_DEFAULTS` con 12 categorías y fuentes. **27 tests unitarios** en
  `sinkingFund.test.ts`, todos verdes. `calcAssetFunds` acepta parámetro opcional
  `replacement_horizon_months` que sobreescribe L (meses restantes), principio IAS 16.51.
- `monthlyObligations.ts` — `calculateMonthlyObligations(assets, installments)`
  agrega sinking + maintenance + cuotas del mes; alimenta la pantalla de
  distribución de sueldo. Pasa `replacement_horizon_months` al motor.

### Base de datos (Supabase)
Migraciones ejecutadas:
- `001` — Schema inicial: accounts, categories, expenses, incomes, assets,
  funds, fund_transactions. RLS en todas.
- `002/003` — (corridas directamente, sin archivo) Agrega: payment_method,
  installments_total, covering_account_id a expenses; tablas installments,
  account_earmarks, income_distribution_rules, income_distribution_lines.
- `004` — `current_value` en assets (override de depreciación calculada).
- `005` — `replacement_cost` en assets (C₀ para sinking fund).
- `006` — `type`, `note`, `distributed` en incomes.
- `007` — Función RPC `confirm_income_distribution(p_income_id, p_lines JSONB)`:
  actualiza balances y marca el ingreso como distribuido en una sola transacción
  PL/pgSQL atómica. `SECURITY INVOKER` — RLS aplica normalmente.
- `008` — Tabla `account_transfers` (RLS: users manage own) + función RPC
  `execute_account_transfer(p_from, p_to, p_amount, p_currency, p_date, p_note)`
  en PL/pgSQL `SECURITY INVOKER`: debita origen, acredita destino, inserta registro
  en una sola transacción atómica. **Ejecutada en Supabase.**
- `009` — `closing_day`/`due_day` (`smallint`, CHECK 1–28) en tabla `accounts`;
  guía comentada para actualizar constraint CHECK en columna `type` para incluir
  `'credito'`. **Ejecutada en Supabase.**

### Rutas implementadas
| Ruta | Descripción |
|------|-------------|
| `/` | Dashboard: gastos del mes, saldos, últimos gastos, botón "+ Ingreso" |
| `/login` | Auth email + password (Supabase Auth) |
| `/cuentas` | Lista de cuentas agrupada; editar saldo y eliminar cuenta inline (CuentaActions) |
| `/cuentas/nueva` | Formulario nueva cuenta (tipo, moneda, saldo inicial, cuenta padre) |
| `/cuentas/transferencia` | Transferencia entre cuentas vía RPC atómico; aviso si monedas distintas |
| `/gastos` | Lista de gastos con filtros (FK disambiguation corregida: `!account_id`) |
| `/gastos/nuevo` | Formulario gasto: medio de pago, cuotas, cuenta de cobertura, autocomplete comercio |
| `/nuevo-gasto` | Alias rápido para iOS Shortcuts |
| `/categorias` | Onboarding de categorías con defaults |
| `/cuotas` | Cuotas pendientes agrupadas por mes, con botón "Marcar pagada" |
| `/inversiones` | Holdings con P&L (absoluto + %); TNA en tiempo real para FCI (4 categorías ArgentinaDatos: mercadoDinero/rentaFija/rentaVariable/rentaMixta, revalidate 6 h, match fuzzy); `HoldingPriceEdit` para precio manual en acciones/CEDEARs (sin feed gratuito); banner informativo |
| `/inversiones/nueva` | Formulario nueva posición |
| `/bienes` | Lista de bienes con sinking + maintenance por bien; botones Editar y Eliminar |
| `/bienes/nuevo` | Formulario con defaults precargados por categoría, preview en tiempo real |
| `/bienes/[id]/editar` | Editar bien: todos los campos + `replacement_horizon_months` (override L) |
| `/ingresos/nuevo` | Formulario ingreso: tipo (sueldo→distribuir, freelance/otro→inicio) |
| `/ingresos/distribuir` | 3 capas: obligaciones del mes (otras monedas = informativo) / fondo emergencia ARS (target 3×promedio, barra progreso, aporte editable) / 50-30-20 del remanente (líneas editables con cuenta y monto) → RPC |

### Componentes y libs
- `BottomNav` — Inicio · Gastos · [+] · Cuentas · Bienes
- `LogoutButton`, `MarkPaidButton` (Server Actions)
- `ExpenseForm` — Autocomplete de comercio vía `<datalist>` nativo; `AmountInput` para ARS,
  `<input type="number">` para USD; helper `getInstallmentDueDates` calcula fechas reales de
  cuotas desde `closing_day`/`due_day` de la cuenta (fallback +30 días si no configurada);
  muestra "Cierre día X · Vencimiento día Y" bajo el selector de cuenta cuando es crédito
- `bienes/_components/DeleteAssetButton.tsx` — Ciclo idle→confirming→deleting, llama
  `deleteAsset` server action y luego `router.refresh()`
- `bienes/[id]/editar/_components/EditAssetForm.tsx` — Pre-llena todos los campos;
  campo `replacement_horizon_months` con nota "sobreescribe vida útil restante"
- `cuentas/_components/CuentaActions.tsx` — Editar saldo / eliminar cuenta inline
  (3 estados: idle, edit, delete); llama server actions de `cuentas/actions.ts`
- `cuentas/transferencia/_components/TransferenciaForm.tsx` — Selectores origen/destino
  con display name + saldo; aviso ámbar si monedas distintas
- `src/lib/accounts.ts` — `getLeafAccounts()` (cuentas sin hijos), `accountDisplayName()`
  ("Institución — Bolsillo" para hijos, nombre plano para raíces)
- `src/lib/format.ts` — `formatARS`, `formatUSD`, `formatCurrency`, `formatInputAmount`
  (preview es-AR para inputs numéricos de formularios)
- `src/lib/categories-defaults.ts` — Categorías de gasto por defecto
- `ingresos/distribuir/_components/DistribuirForm.tsx` — Capa 1 obligaciones (otras
  monedas opacity-55 "informativo"), Capa 2 fondo emergencia ARS (barra progreso, aporte
  editable con `AmountInput` que recalcula Capa 3), Capa 3 50/30/20 (flag "editado" por
  línea, "Restablecer"; montos ARS usan `AmountInput`, USD usan `<input type="number">`)
- `ingresos/actions.ts` — `createIncome`, `confirmDistribution`, `updateEmergencyFund`
  (read-then-write seguro single-user sobre tabla `funds`), `redirectToDistribute`
- `AmountInput` (`src/components/AmountInput.tsx`) — `type="text" inputMode="numeric"`;
  dígitos crudos mientras escribe (evita conflicto de cursor); `Intl.NumberFormat("es-AR",
  { maximumFractionDigits: 0 })` al blur; solo enteros ARS
- `inversiones/_components/HoldingPriceEdit.tsx` — Ciclo idle→edit→saving; llama
  `updateHoldingPrice` server action + `router.refresh()`
- `inversiones/actions.ts` — `updateHoldingPrice(holdingId, price)` server action con RLS
  (`eq("user_id", user.id)`)
- `src/lib/institutions.ts` — grupo `"credito"` + 4 instituciones (Visa, Mastercard, Amex,
  Naranja), `dbType: "credito"`, `defaultCurrency: "ARS"`
- `src/types/index.ts` — `AccountType` incluye `"credito"`; `Account` tiene
  `closing_day: number | null` y `due_day: number | null`

### Testing
- 27 tests unitarios en `src/lib/finance/sinkingFund.test.ts` (Jest + ts-jest)
- `docs/test-cases.md` — 9 casos funcionales documentados con valores esperados
- `test-credentials.txt` — Credenciales test user (en `.gitignore`, nunca commitear)
- `screenshot.mjs` — Script Playwright para capturas autenticadas

## Documentos de contexto (LEER ANTES DE CODEAR)

- `docs/01-fundamentos-teoricos.md` — **La biblia financiera.** Toda fórmula y default
  de cálculo sale de acá. Ante cualquier duda sobre cómo calcular un fondo, esta es la
  fuente de verdad. No inventar fórmulas que no estén respaldadas acá.
- `docs/02-arquitectura.md` — Stack, modelo de datos, módulos, fases, restricciones de costo.

## Stack (no cambiar sin discutir)

- Next.js 14+ (App Router) + React + Tailwind CSS
- Supabase (PostgreSQL + Auth + RLS)
- Vercel (hosting + serverless functions)
- Tesseract.js (OCR local, sin API paga)
- WhatsApp Cloud API (bot, solo mensajes self-initiated)
- Recharts (gráficos)
- PWA: next-pwa/Serwist (instalable, offline)

## Restricción dura: COSTO CERO

Ninguna dependencia, servicio o decisión puede introducir un costo recurrente.
- NO usar APIs de visión pagas (Gemini/Claude Vision) en runtime.
- NO requerir Apple Developer account.
- NO usar BSP pago de WhatsApp.
- Antes de agregar cualquier servicio externo, verificar que su free tier alcance
  para un único usuario y dejarlo documentado.

## Reglas de colaboración (preferencias del dueño del proyecto)

1. **Proponer antes de ejecutar.** Para cambios en documentos o código, explicar el
   plan y esperar aprobación antes de aplicar cambios grandes.
2. **No inventar datos.** Si falta un dato (una tasa, una fuente, un valor), decirlo
   explícitamente en vez de rellenar con un número plausible.
3. **Reescrituras completas sobre parches.** Cuando se acumulan varios cambios en un
   archivo, preferir reescribir el archivo completo antes que múltiples snippets sueltos.
4. **Trazabilidad financiera.** Cualquier cálculo de fondos debe poder rastrearse a una
   fuente del documento de fundamentos. Si se agrega una fórmula nueva, agregar también
   su fuente al documento teórico.
5. **El usuario siempre puede hacer override.** Los defaults teóricos son puntos de
   partida; la UI siempre debe permitir editarlos (principio IAS 16.51).

## Principios de cálculo (resumen — detalle en fundamentos)

- 4 tipos de fondos distintos: Sinking (amortización), Maintenance (mantenimiento),
  Goal (objetivo), Emergency (emergencia). No confundirlos.
- Sinking Fund: `d = (C0−CL)·i / ((1+i)^L − 1)`; si `i=0`, `d = (C0−CL)/L`.
- Maintenance: `m = Valor_actual × (%anual/12)`.
- Argentina: denominar fondos en USD, `i` default 0, residuales ajustados al alza.

## Seguridad (no-negociable)

- RLS activado en TODAS las tablas de Supabase.
- Nunca exponer claves de servicio en el cliente.
- Validar y sanitizar todo input (incluido texto del bot y OCR).
- Secrets solo en variables de entorno, nunca en el repo.

## Estructura del repo (objetivo)

```
/src/app                → rutas Next.js (App Router)
/src/app/api            → serverless functions (incl. webhook de WhatsApp)
/src/app/nuevo-gasto    → ruta para Action Button de iPhone (iOS Shortcuts)
/src/components         → componentes React reutilizables
/src/lib                → lógica de negocio
  /finance              → motor de cálculo de fondos (corazón teórico)
  /ocr                  → Tesseract.js + parsing de tickets
  /supabase             → cliente y queries
/src/types              → TypeScript types
/docs                   → documentos de contexto
/public                 → manifest PWA, íconos, service worker
```

## Cómo empezar una sesión

1. Leer `docs/01-fundamentos-teoricos.md` y `docs/02-arquitectura.md`.
2. Confirmar en qué fase del roadmap estamos (ver arquitectura §5).
3. Proponer el plan de la sesión y esperar OK antes de ejecutar.
