# CLAUDE.md — Contexto del proyecto para Claude Code

> Este archivo es leído automáticamente por Claude Code al iniciar cada sesión.
> Define el proyecto, las reglas de trabajo y dónde encontrar el contexto completo.

## Qué es este proyecto

App de finanzas personales (single-user) para iPhone vía **PWA**. Gestiona ingresos,
gastos, inversiones, reservas en dólares, y **fondos de amortización y mantenimiento
por bien** (Sinking Funds), con una base teórica financiera rigurosa y ajuste a la
realidad económica argentina.

## Estado actual del proyecto

Phase 2 completada + módulo de metas de ahorro implementado.
Commit `84c3a1a` (sobre `92e6277`): modelo de depreciación de dos tasas para autos
(5 segmentos, d1/d2, fuentes ACARA/CCA/Autozoom/comparaencasa, §3.3 fundamentos);
override manual del objetivo de ahorro por bien (savings_goal_mode/amount/months);
UI de auto en formularios de bienes (segmento + bought_used + preview reventa);
4 bugs críticos corregidos: editar saldo múltiple en CuentaActions; navegación post-
guardado de bien; closing_day/due_day no aparecía al crear tarjeta de crédito;
navegación lenta en /inversiones (FCI lazy-load via Suspense).
Commit `ad92169` (sobre `84c3a1a`): módulo Metas de Ahorro completo — migración 011
(savings_goals, savings_contributions, account_id en assets, RPC atómico);
motor savingsGoals.ts con SavingsTarget unificado (bienes + objetivos);
rutas /objetivos y /objetivos/nuevo; distribuidor rediseñado en 4 capas;
BottomNav Bienes→Metas.

Sesión "Plata Real" (pendiente de commit): migración 012 ejecutada en Supabase
(sin archivo en repo, igual que 002/003); saldos de cuentas se actualizan en tiempo
real vía 4 RPCs atómicos; formulario de gasto refactorizado a server action; pago de
cuotas con modal de cuenta cuando no hay cobertura; edición y eliminación de gastos
con reversión de saldo atómica; BottomNav reescrito con bottom sheet; dashboard con
accesos rápidos; /objetivos con botón + Bien y empty state mejorado.

Sesión D "Cuotas por tarjeta" (pendiente de commit): migración 013 ejecutada en
Supabase (archivo en repo: `013_pay_installments_batch.sql`); agrupamiento de cuotas
en /cuotas por account_id+mes (muestra nombre tarjeta + "Vence el día X"); advertencia
ámbar inline si la tarjeta no tiene closing_day/due_day; botón "Pagar todas (N)" con
modal de confirmación (total + selector de cuenta) cuando hay ≥2 cuotas en un grupo;
RPC atómico `pay_installments_batch`; banner de recordatorio en dashboard 3 días antes
de cierre o vencimiento de cualquier tarjeta activa.

## Sesiones pendientes (roadmap)

- **Sesión E — Suscripciones:** nueva migración con tablas `recurring_expenses` y
  `subscription_instances`; diseño a documentar en `docs/02-arquitectura.md` antes de
  implementar.
- **Sesión F — Housekeeping** (completada): memoria paralela migrada a CLAUDE.md;
  `MarkPaidButton.tsx` eliminado; cuatro skills de agentes creadas en `.claude/skills/`;
  `docs/lecciones-aprendidas.md` creado; sección TWR (§8) documentada en fundamentos;
  roadmap G–M documentado.
- **Sesión G — Cuentas editables** (completada): edición de nombre y tipo de cuenta
  (CuentaActions expandido: nombre + saldo + tipo con restricción si hay dependientes);
  conversión de cuenta simple a contenedor con bolsillos vía RPC atómica
  `convert_account_to_parent` (migración 014 — **PENDIENTE de ejecutar en Supabase**);
  cuentas padre con botones Editar/Eliminar inline; cuenta en USD bajo la misma
  institución verificado E2E; tarjetas de crédito con parent_id apuntando a banco
  (selector en form + agrupación visual en /cuentas; deuda excluida del total del banco);
  vista discriminada de saldos: Total / Cuotas crédito / Metas / Libre cuando hay earmarks.
- **Sesión G.2 — Jerarquía 3 niveles** (completada — verificación y cierre):
  - ✅ `accountDisplayName` recursivo (camina cadena completa de ancestros).
  - ✅ `GoalForm` usa `getLeafAccounts + accountDisplayName` en el selector de cuenta.
  - ✅ `CuentaActions` tiene prop `isChild: boolean`; bolsillos muestran "Tipo no editable".
  - ✅ `deleteAccount` con pre-chequeo recursivo de hijos y dependencias; mensaje descriptivo.
  - ✅ `/cuentas` como árbol expandible `CuentasTree`: N niveles, expand/collapse, totales consolidados.
  - ✅ `AddChildInline` unificado: primer bolsillo → RPC `convert_account_to_parent`; subsiguientes → `createChildAccount`.
  - ✅ Fix stale state: `setMode("idle")` antes de `router.refresh()` en CuentaActions.
  - ✅ `/cuentas/nueva?parent=<id>` corregido: acepta cuentas de cualquier nivel como padre.
  - ✅ Migración 014 ejecutada (`convert_account_to_parent`) — confirmado vía REST API.
  - ✅ Migración 015 ejecutada (`safe_delete_account`) — confirmado vía REST API.
  - ✅ Fix `CuentasTree.useEffect`: auto-expande IDs nuevos cuando `accounts` prop cambia tras `router.refresh()`. Sin este fix, contenedores recién creados quedaban colapsados y sus hijos invisibles (ver lección §11).
  - ✅ **T3 DE FACTO**: `AddChildInline` no tiene selector de tipo → bolsillos siempre heredan el tipo del padre automáticamente. Restricción efectivo→efectivo funciona sin código adicional.
  - ✅ **T4 FK Audit**: FKs conocidas (de archivos SQL): `expenses.account_id`, `incomes.account_id`, `savings_goals.account_id`, `savings_contributions.account_id`, `assets.account_id` → todos `ON DELETE SET NULL`. FKs desconocidas (sin archivo): `accounts.parent_id`, `account_earmarks.account_id`, `expenses.covering_account_id`, `expenses.funding_account_id`. Mitigación: `deleteAccount` y RPC `safe_delete_account` hacen pre-chequeo en JS/Postgres antes de borrar → nunca hay orphaning por la UI.
  - ✅ **E2E Playwright 23/23**: árbol 3 niveles (BBVA→Pesos/Dólares→Viaje Europa), expand/collapse independiente, totales consolidados, T3 efectivo, T5 delete con/sin hijos — todos verdes.
  - ❌ **NO completado (Sesión J)**: restricción type='efectivo' admite hijos de cualquier tipo (solo de facto vía herencia). Si se quiere bloqueo explícito, agregar validación en `createChildAccount`.
- **Sesión G.3 — UX + Seguridad FK** (completada):
  - ✅ **T1 — AddChildInline unificado**: formulario idéntico para primer bolsillo y subsiguientes (nombre + selector ARS/USD + saldo). Para el primer bolsillo el saldo se pre-llena con el saldo del padre (informativo — la RPC lo mueve desde el padre) y aparece el aviso "⚠ Tu saldo se moverá...". La lógica de qué server action se llama sigue siendo invisible para el usuario.
  - ✅ **T2 — Delete accionable**: `deleteAccount` ahora devuelve `{ deps: DepItem[], overflowCount? }` con los primeros 5 gastos (merchant/monto/fecha) y links a `/gastos/{id}/editar`. Earmarks/ingresos/metas muestran resumen con link de navegación. Si hay más de 5 gastos, indica "y N más — andá a /gastos". `/gastos` no tiene filtro por cuenta (no se inventó).
  - ✅ **T3 — Migración 016**: `016_fix_cascade_fk.sql` creada con `accounts.parent_id` y `account_earmarks.account_id` cambiados de CASCADE a RESTRICT. `safe_delete_account` RPC actualizado: limpia earmarks liberados (`released=true`) antes del DELETE. `deleteAccount` JS también limpia released earmarks. **PENDIENTE de ejecutar en Supabase SQL Editor.**
  - ✅ **T4 — Saldo $0 investigado**: basura de fixture — 2 gastos + 1 earmark liberado referenciaban cuenta `8b480ef1-...` que no existe en accounts (borrada fuera del flujo de la app, posiblemente vía SQL directo en sesión anterior). Eliminados del test user. No hay bug de código. La cuenta referenciada habría sido borrada saltando el pre-chequeo de dependencias (debería haber fallado), lo que refuerza la necesidad de la migración 016.
  - ⚠️ **FK posiblemente faltante en producción**: los gastos orphaned tenían `account_id` poblado con UUID inexistente (no NULL), lo que sugiere que la FK `expenses.account_id ON DELETE SET NULL` podría no estar activa en el DB real (migración 001 la define pero la columna pudo haberse agregado después en 002/003 sin FK). Verificar en Supabase corriendo `SELECT conname, confdeltype FROM pg_constraint WHERE conname LIKE 'expenses%'`.
- **Sesión H — Earmark a transferencia real** (completada — pendiente commit):
  - ✅ **TAREA 1 confirmada con Playwright:** `create_expense_with_balance` con `covering_account_id` set y `funding_account_id=""` → **NO mueve plata** (earmark simbólico). Balances verificados antes/después con Playwright y REST directo. El usuario tenía razón: "no se movió nada".
  - ✅ **TAREA 1 confirmada:** iOS Safari no valida `required` en `<select>` → así se creaban earmarks sin funding en iPhone. Chrome sí lo bloqueaba. Comportamiento explicado y diseño ajustado para ser consistente cross-browser.
  - ✅ **Migración 017** (`017_confirm_earmark_funding.sql`): RPC PL/pgSQL atómica `confirm_earmark_funding(p_earmark_id, p_funding_account_id)`. Validaciones: earmark no liberado, gasto sin funding previo, origen ≠ destino, mismo user, misma moneda. Movimiento: `funding -amount, covering +amount, expense.funding_account_id = funding`. FOR UPDATE para evitar race conditions. **PENDIENTE de ejecutar en Supabase SQL Editor.**
  - ✅ **ExpenseForm.tsx:** `fundingAccountId` ahora opcional en todos los browsers. Primera opción: "Confirmar más tarde". Hint dinámico: "La plata se mueve ahora" vs "Podés confirmar desde Cuotas". Label marcado `(opcional)`.
  - ✅ **`cuotas/actions.ts`:** Server Action `confirmEarmarkFunding(earmarkId, fundingAccountId)` → llama RPC `confirm_earmark_funding`.
  - ✅ **`ConfirmFundingButton.tsx`** (nuevo): Modal bottom-sheet z-[60] (sobre BottomNav z-50 + `pb-24` para no quedar tapado). Muestra nombre gasto + monto + cuenta cobertura. Select con cuentas de misma moneda + saldo actual. Advertencia ámbar si saldo insuficiente (no bloquea). On success: `router.refresh()`.
  - ✅ **`cuotas/page.tsx`:** Sección "Transferencias pendientes" con fondo ámbar, visible solo cuando `pendingFunding.length > 0`. Query: `account_earmarks` join `expenses` filtrando `released=false AND expense_id IS NOT NULL`, luego JS-filter por `expenses.funding_account_id IS NULL`. Compatible con PostgREST (no puede filtrar joined columns directamente).
  - ✅ **E2E Playwright 7/7:** crear sin funding → balances sin cambio → sección visible → gasto en lista → Confirmar visible → modal abre → Cancelar clickeable (z-index fix).
  - ⚠️ **Migración 016** todavía PENDIENTE de ejecutar (`016_fix_cascade_fk.sql`).
  - ⚠️ **Build local:** `npm run build` falla por Turbopack + Google Fonts offline (red sin acceso a fonts.gstatic.com). Pre-existente. `npx tsc --noEmit` pasa limpio. En Vercel pasa.
  - **TAREA 4 (semántica earmarks):** ver sección abajo "Conceptos financieros clave".
- **Sesión I — Distribución de sueldo rediseñada:** opcional y salteable; cuatro capas
  unificadas en una sola vista editable; editable por monto o porcentaje; bienes como
  destino; desplegable con justificación teórica y fuente; distribución parcial con saldo
  pendiente; recordatorio a fin de mes si quedó sin distribuir.
  **Backlog G.2 T6:** cuando el usuario asigna una cuenta Level-2 como `account_id` de una
  meta de ahorro, ofrecer auto-crear una subcuenta Level-3 con el nombre de la meta.
  Implementar en `GoalForm` al guardar (o en un paso de confirmación post-creación).
  Requiere migración o RPC atómica — no hacer sin diseño previo.
- **Sesión J — Inversiones:** implementar TWR (§8 fundamentos); precio promedio derivado
  de monto/cantidad (no campo obligatorio); rendimiento de fondos en billeteras/bancos;
  rediseño de orden de campos en formulario (Precio antes de Cantidad — ver
  `docs/lecciones-aprendidas.md §6`). INVESTIGAR feed de precios BYMA/CEDEARs.
  **PENDIENTE DE DECISIÓN HUMANA:** cotización con retraso (gratis) vs. romper costo cero.
- **Sesión K — Gráficos:** inversiones, gastos e ingresos con Recharts; carrusel
  navegable en dashboard; gráfico propio dentro de cada sección.
- **Sesión L — PWA:** manifest, service worker, íconos, instalable en iPhone; atajo de
  iOS Shortcuts sobre `/nuevo-gasto`.
- **Sesión M — Investigación bot de WhatsApp (NO implementación):** verificar qué es
  viable con costo cero para (a) transcripción de audio, (b) lectura de comprobantes.
  Evaluar primero Tesseract.js con reglas de parseo por emisor. Documentar hallazgos con
  fuentes antes de comprometer arquitectura. NO asumir modelo propio entrenable (sin
  dataset público de comprobantes argentinos).
- **Después:** rediseño visual y UX completo (invocar `agente-ux`).

### Skills locales disponibles (`.claude/skills/`)

| Skill | Cuándo invocar |
|---|---|
| `agente-teoria-financiera` | Cualquier sesión con cálculos financieros |
| `agente-seguridad` | Sesiones con DB, endpoints, auth o secrets |
| `agente-ux` | Sesiones con pantallas o componentes |
| `agente-calidad-codigo` | **Siempre**, antes del commit final |

## Qué existe hoy

### Motor financiero (`src/lib/finance/`)
- `sinkingFund.ts` — Motor puro de cálculo: `calcSinkingFund`, `calcMaintenance`,
  `calcCurrentValue` (depreciación 16%/año §1.3), `calcAssetFunds`, tabla
  `ASSET_DEFAULTS` con 12 categorías y fuentes. **36 tests unitarios** en
  `sinkingFund.test.ts`, todos verdes. `calcAssetFunds` acepta `replacement_horizon_months`
  (override L, IAS 16.51), `car_segment` y `bought_used` para modelo de dos tasas (§3.3).
  `AssetFundResult` incluye `goalAmount` y `residualValue`. Nuevos: tipo `CarSegment`
  (5 valores), constante `CAR_DEPRECIATION_SEGMENTS` (d1/d2/source por segmento),
  función `calcCarResidualValue({currentValue, monthsToReplacement, segment, boughtUsed})`
  — autos usados aplican solo d2 desde el valor actual (d1 ya fue del dueño anterior).
- `savingsGoals.ts` — `SavingsTarget` unificado (`kind: "asset"|"goal"`); `buildAssetTarget`
  (modo calculado via `calcAssetFunds`, modo manual usa `savings_goal_amount/months`);
  `buildGoalTarget` (`monthlyContribution = (target−accumulated)/monthsRemaining` dinámico,
  sube si está atrasado); `getAllSavingsTargets` (filtra vivienda con goal=0 y sinking=0;
  ordena por progressPct asc). **13 tests unitarios** en `savingsGoals.test.ts`, verdes.
- `monthlyObligations.ts` — `calculateMonthlyObligations(assets, installments)`
  agrega sinking + maintenance + cuotas del mes; alimenta la pantalla de
  distribución de sueldo. Pasa `replacement_horizon_months` al motor.
  Nuevos campos `maintenance_only_usd/ars` (solo maintenance + cuotas, sin sinking)
  para separar Capa 1 de Capa 2 en el distribuidor — backwards-compatible.

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
- `010` — `car_segment` (text, CHECK 5 valores), `bought_used` (boolean DEFAULT true),
  `savings_goal_mode` (text, CHECK 'calculated'|'manual', DEFAULT 'calculated'),
  `savings_goal_amount` (numeric), `savings_goal_months` (integer) en tabla `assets`.
  **Ejecutada en Supabase.**
- `011` — Tabla `savings_goals` (name, target_amount, currency, target_months, start_date,
  account_id, archived; RLS); tabla `savings_contributions` (CHECK: asset_id XOR goal_id,
  RLS, indexes); `ALTER TABLE assets ADD COLUMN account_id uuid REFERENCES accounts(id)
  ON DELETE SET NULL`; RPC `confirm_distribution_with_contributions(p_income_id, p_lines,
  p_contributions, p_emergency_amount, p_emergency_fund_id)` — SECURITY INVOKER, 4 capas en
  una transacción PL/pgSQL atómica. Earmarks de metas: `release_date = NULL` (liberación
  manual, distinto de cuotas de tarjeta que tienen fecha fija). **Ejecutada en Supabase.**
- `012` — (ejecutada en Supabase, sin archivo en repo) `funding_account_id uuid` en
  `expenses`; `expense_id uuid` en `account_earmarks`; RPC `create_expense_with_balance`
  (inserta gasto + mueve saldo + crea cuotas + earmark atómicamente); RPC `pay_installment`
  (marca pagada + descuenta de cuenta cubriente/elegida + reduce/libera earmark por
  expense_id); RPC `delete_expense_with_balance` (revierte saldo: porción impaga para
  crédito+cobertura, total para efectivo/débito; elimina earmarks e installments); RPC
  `update_expense_with_balance` (ajusta diff de saldo para efectivo/débito/transferencia;
  monto inmutable para crédito). Todos SECURITY INVOKER.
- `014` — (archivo en repo: `014_convert_account_to_parent.sql`; **ejecutada en Supabase**,
  confirmada via REST API Sesión G.2) RPC `convert_account_to_parent(p_account_id UUID, p_bolsillo_name TEXT) RETURNS UUID`:
  en una sola transacción PL/pgSQL SECURITY INVOKER: crea bolsillo hijo con el saldo del padre;
  vacía el padre; reasigna expenses, earmarks, incomes, savings_goals, savings_contributions,
  income_distribution_lines al nuevo hijo. Rollback total si falla.
- `013` — (archivo en repo: `013_pay_installments_batch.sql`; ejecutada en Supabase) RPC
  `pay_installments_batch(p_installment_ids UUID[], p_account_id UUID)` — llama
  `pay_installment` en loop dentro de una sola transacción PL/pgSQL atómica; rollback
  total si cualquier cuota falla. SECURITY INVOKER.

### Rutas implementadas
| Ruta | Descripción |
|------|-------------|
| `/` | Dashboard: gastos del mes, saldos, últimos gastos, botón "+ Ingreso"; grid de accesos rápidos Cuotas/Bienes/Inversiones |
| `/login` | Auth email + password (Supabase Auth) |
| `/cuentas` | Lista de cuentas agrupada; editar nombre/saldo/tipo + eliminar inline (CuentaActions); cuentas padre con Editar/Eliminar; tarjetas de crédito con parent_id bajo banco; vista discriminada Total/Cuotas/Metas/Libre |
| `/cuentas/nueva` | Formulario nueva cuenta (tipo, moneda, saldo inicial, cuenta padre); tarjeta de crédito: selector opcional de banco padre |
| `/cuentas/transferencia` | Transferencia entre cuentas vía RPC atómico; aviso si monedas distintas |
| `/gastos` | Lista de gastos con filtros (FK disambiguation corregida: `!account_id`) |
| `/gastos/nuevo` | Formulario gasto: medio de pago, cuotas, cuenta de cobertura, autocomplete comercio |
| `/nuevo-gasto` | Alias rápido para iOS Shortcuts |
| `/categorias` | Onboarding de categorías con defaults |
| `/cuotas` | Cuotas pendientes agrupadas por tarjeta+mes; nombre tarjeta, "Vence el día X", "Pagar todas (N)", advertencia si sin closing/due |
| `/inversiones` | Holdings con P&L; FCI lazy-load: TNA via `FciRateCell` (async SC en Suspense, sin bloquear render inicial); `HoldingPriceEdit` para precio manual en acciones/CEDEARs |
| `/inversiones/nueva` | Formulario nueva posición |
| `/bienes` | Lista de bienes con sinking + maintenance + Meta por bien; modo manual muestra badge "manual" |
| `/bienes/nuevo` | Formulario con defaults por categoría; sección "Detalles del auto" (segmento/bought_used/tasas+fuente); sección "Objetivo de ahorro" (toggle calculado/manual) |
| `/bienes/[id]/editar` | Igual que nuevo + pre-llena todos los campos incluyendo car_segment/savings_goal |
| `/ingresos/nuevo` | Formulario ingreso: tipo (sueldo→distribuir, freelance/otro→inicio) |
| `/ingresos/distribuir` | 4 capas: Capa 1 maintenance+cuotas sin sinking (otras monedas = informativo) / Capa 2 metas con checkboxes y montos editables + mini progress bars (other-currency informativo abajo) / Capa 3 fondo emergencia ARS / Capa 4 50-30-20 del remanente → RPC `confirm_distribution_with_contributions` |
| `/objetivos` | Lista de SavingsTargets (bienes+objetivos): progress bars, badges Bien/Objetivo, AportarButton; resumen total mensual arriba; link a /bienes para detalles de mantenimiento |
| `/objetivos/nuevo` | Formulario nueva meta: nombre, monto+moneda (toggle ARS/USD), plazo en meses, cuenta opcional; preview live "necesitás aportar X/mes" |
| `/gastos/[id]/editar` | Editar gasto: monto (read-only para crédito con badge), merchant, descripción, categoría, fecha; eliminar con reversión de saldo atómica |
| `/categorias/nueva` | Formulario nueva categoría |

### Componentes y libs
- `BottomNav` — Inicio · Gastos · [+] · Cuentas · Metas; botón [+] abre bottom sheet con overlay (z-40) + 3 acciones rápidas: Nuevo gasto / Nuevo ingreso / Transferencia
- `LogoutButton` (Server Action)
- Dashboard (`(main)/page.tsx`) — banner recordatorio N=3 días antes de closing_day o
  due_day de cualquier tarjeta de crédito activa; `daysUntil(targetDay, today)` maneja
  wrap de mes.
- `ExpenseForm` — Autocomplete de comercio vía `<datalist>` nativo; `AmountInput` para ARS,
  `<input type="number">` para USD; muestra "Cierre día X · Vencimiento día Y" bajo el
  selector de cuenta cuando es crédito; campo `fundingAccountId` (visible solo cuando
  crédito+cobertura: cuenta de donde sale la plata que se aparta); llama `createExpense`
  server action de `gastos/actions.ts` (no Supabase client directo); `getInstallmentDueDates`
  movido a `gastos/actions.ts`
- `gastos/actions.ts` — Server Actions: `createExpense` (construye p_expense/p_installments/
  p_earmark y llama RPC `create_expense_with_balance`), `deleteExpense` (RPC
  `delete_expense_with_balance`), `updateExpense` (RPC `update_expense_with_balance`);
  incluye helper `getInstallmentDueDates`.
- `cuotas/actions.ts` — Server Actions: `payInstallment(installmentId, accountId | null)`
  llama RPC `pay_installment`; `payInstallmentsBatch(installmentIds[], accountId | null)`
  llama RPC `pay_installments_batch`.
- `cuotas/_components/PayInstallmentButton.tsx` — Reemplaza `MarkPaidButton`. Si
  `covering_account_id`: botón directo (accountId = null). Si no: abre modal con
  `<select>` de leaf accounts → confirma → `payInstallment(id, selectedAccount)`.
  Nota: `MarkPaidButton.tsx` sigue en el repo pero ya no se importa (candidato a borrar).
- `cuotas/_components/BatchPayButton.tsx` — Modal de confirmación para pago en lote:
  muestra total por moneda; selector de cuenta solo si alguna cuota no tiene
  `covering_account_id`; llama `payInstallmentsBatch`. Visible cuando el grupo tiene ≥2 cuotas.
- `gastos/[id]/editar/_components/EditExpenseForm.tsx` — Client Component. Editable:
  merchant, descripción, categoría, fecha; monto read-only para crédito. Delete:
  idle → confirmDelete → deleting, llama `deleteExpense` y redirige a /gastos.
- `bienes/_components/DeleteAssetButton.tsx` — Ciclo idle→confirming→deleting, llama
  `deleteAsset` server action y luego `router.refresh()`
- `bienes/[id]/editar/_components/EditAssetForm.tsx` — Pre-llena todos los campos;
  `replacement_horizon_months`; sección "Detalles del auto" (segmento, bought_used,
  tasas + fuente inline); sección "Objetivo de ahorro" (toggle calculado/manual;
  manual: inputs goal_amount + goal_months); bug B2 corregido: sin `router.refresh()`
  tras `router.push()` para evitar race condition en App Router
- `bienes/nuevo/_components/AssetForm.tsx` — Mismas features que EditAssetForm (sin pre-llenado)
- `cuentas/_components/CuentaActions.tsx` — Editar nombre+saldo+tipo / convertir a padre /
  eliminar cuenta inline (4 estados: idle, edit, convert, delete). Props: accountType, canChangeType
  (si false → tipo deshabilitado con mensaje), hasChildren (si true → oculta "+ bolsillo" en idle).
  Tipo: bloqueado si la cuenta tiene gastos o earmarks activos (verificado en server action).
  Convert: llama RPC `convert_account_to_parent` vía `convertAccountToParent` server action.
- `cuentas/transferencia/_components/TransferenciaForm.tsx` — Selectores origen/destino
  con display name + saldo; aviso ámbar si monedas distintas
- `src/lib/accounts.ts` — `getLeafAccounts()` (cuentas sin hijos), `accountDisplayName()`
  ("Institución — Bolsillo" para hijos, nombre plano para raíces)
- `src/lib/format.ts` — `formatARS`, `formatUSD`, `formatCurrency`, `formatInputAmount`
  (preview es-AR para inputs numéricos de formularios)
- `src/lib/categories-defaults.ts` — Categorías de gasto por defecto
- `ingresos/distribuir/_components/DistribuirForm.tsx` — 4 capas rediseñadas: Capa 1
  solo maintenance+cuotas (items tipo "sinking" filtrados); Capa 2 metas con checkboxes,
  montos editables, mini progress bars (`metaChecks` state), other-currency informativo;
  Capa 3 fondo emergencia ARS; Capa 4 50/30/20 (flag "editado", "Restablecer");
  remanente = ingreso − capa1 − totalMetasSameCurrency − emergencyContrib
- `objetivos/actions.ts` — `createGoal` (INSERT savings_goals), `addContribution`
  (INSERT savings_contributions + earmark con `release_date = null`, liberación manual),
  `deleteGoal` (soft delete: `archived = true`)
- `objetivos/_components/AportarModal.tsx` / `AportarButton.tsx` — Modal client-side:
  campos amount, cuenta origen, date, nota; llama `addContribution` + `router.refresh()`
- `objetivos/_components/DeleteGoalButton.tsx` — idle→confirming→deleting
- `objetivos/nuevo/_components/GoalForm.tsx` — form con preview live de aporte mensual;
  on submit: `createGoal` → `router.push("/objetivos")`
- `ingresos/actions.ts` — `createIncome`, `confirmDistribution`, `updateEmergencyFund`,
  `confirmDistributionWithContributions` (llama RPC migración 011), `redirectToDistribute`
- `AmountInput` (`src/components/AmountInput.tsx`) — `type="text" inputMode="numeric"`;
  dígitos crudos mientras escribe (evita conflicto de cursor); `Intl.NumberFormat("es-AR",
  { maximumFractionDigits: 0 })` al blur; solo enteros ARS
- `inversiones/_components/HoldingPriceEdit.tsx` — Ciclo idle→edit→saving; llama
  `updateHoldingPrice` server action + `router.refresh()`
- `inversiones/actions.ts` — `updateHoldingPrice(holdingId, price)` server action con RLS
  (`eq("user_id", user.id)`)
- `src/lib/institutions.ts` — grupo `"credito"` + 4 instituciones (Visa, Mastercard, Amex,
  Naranja), `dbType: "credito"`, `defaultCurrency: "ARS"`. Bug B3 corregido en
  `NuevaCuentaForm.tsx`: crédito salta el step "mode" y va directo al form, así
  closing_day/due_day siempre se muestran (el step "bolsillos" no tenía esos campos)
- `inversiones/_components/FciRatesSection.tsx` — `FciRateCell` (async SC: fetch TNA por
  holding, fallback HoldingPriceEdit) + `FciPortfolioSummary` (totales portfolio); ambos
  envueltos en `<Suspense>` desde la page; elimina bloqueo de 4 fetches externos al render
- `src/types/index.ts` — `AccountType` incluye `"credito"`; `Account` tiene
  `closing_day/due_day: number | null`; `Asset` tiene `car_segment: CarSegment | null`,
  `bought_used: boolean | null`, `savings_goal_mode: SavingsGoalMode | null`,
  `savings_goal_amount: number | null`, `savings_goal_months: number | null`,
  `account_id: string | null`; `Expense` incluye `funding_account_id: string | null`;
  `AccountEarmark` incluye `expense_id: string | null`; tipos `CarSegment`,
  `SavingsGoalMode`, `SavingsGoal`, `SavingsContribution`

### Testing
- **49 tests totales** (Jest + ts-jest):
  - 36 en `sinkingFund.test.ts` (9 nuevos en `84c3a1a`: calcCarResidualValue por segmento,
    0 meses, sanity check 65%-90%; calcAssetFunds modelo auto; CAR_DEPRECIATION_SEGMENTS.popular)
  - 13 en `savingsGoals.test.ts` (asset calculado/manual, goal con progreso/atrasado/completado/
    expirado, filtrado vivienda, ordenamiento, maintenance excluido de sinking)
- `docs/test-cases.md` — 9 casos funcionales documentados con valores esperados
- `test-credentials.txt` — Credenciales test user (en `.gitignore`, nunca commitear)
- `screenshot.mjs` — Script Playwright para capturas autenticadas

### QA — Selectores correctos para scripts de Playwright

```javascript
// Monto gasto ARS (AmountInput — type='text' inputMode='numeric')
page.locator("input[inputMode='numeric']").first()

// Monto ingreso IncomeForm (type='number', NO AmountInput)
page.locator("input[type='number'][placeholder='0']")

// Botón con acento (ej. "Crédito") — iterar, no usar filter hasText con regex sin acento
var btns = page.locator("button[type='button']");
for (var i = 0; i < await btns.count(); i++) {
  if (/cr.dito/i.test(await btns.nth(i).textContent())) { await btns.nth(i).click(); break; }
}

// Covering account select (identificar por option única)
page.locator("select").filter({ has: page.locator("option", { hasText: "Sin cuenta de cobertura" }) })

// Funding account select (primera opción es "Confirmar más tarde" desde Sesión H)
page.locator("select").filter({ has: page.locator("option", { hasText: "Confirmar más tarde" }) })

// Cuotas input
page.locator("input[type='number'][min='1'][max='48']")
```

**Redirects intencionales (no son bugs):**
- `/nuevo-gasto` → `"/"` (Dashboard) — ruta rápida para iOS Shortcuts
- `/ingresos/nuevo` tipo sueldo → `/ingresos/distribuir?ingreso_id=UUID`
- `/objetivos/nuevo` → `/objetivos`

**Fixtures permanentes en DB (NO borrar):**
- Cocos Capital (ARS, tipo=inversion)
- Visa Test SD (ARS, tipo=credito)

**Garbage conocido en DB:**
- Posición AAPL: 150u @ PA $10 (incorrecto; debería ser 10u @ $150). Sin UI de delete
  en `/inversiones`. Queda hasta Sesión J. Ver `docs/lecciones-aprendidas.md §6`.

**Migraciones pendientes de ejecución en Supabase dashboard:**
- `016_fix_cascade_fk.sql` — FK CASCADE → RESTRICT en `accounts.parent_id` y `account_earmarks.account_id`; incluye CREATE OR REPLACE de `safe_delete_account` con limpieza de earmarks liberados. Ejecutar en SQL Editor antes de confiar en la red de seguridad FK.
- `017_confirm_earmark_funding.sql` — RPC `confirm_earmark_funding(p_earmark_id, p_funding_account_id)`. Completa el movimiento de plata para earmarks creados sin funding. SECURITY INVOKER. Ejecutar antes de usar el botón "Confirmar" en /cuotas.

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
6. **Un solo commit al final de cada sesión.** No hacer commits intermedios. Todo va en
   un único commit al cerrar la sesión.
7. **Sin push sin mostrar el diff primero.** Siempre mostrar `git diff --cached` antes
   de commitear. El push lo hace el usuario, nunca Claude.
8. **Build limpio y tests verdes antes del commit.** `npm run build` + `npm test`
   deben pasar. Si falla algo, no commitear.
9. **No mostrar archivos completos — solo resúmenes.** Describir cambios con referencia
   al archivo y las líneas modificadas.
10. **Autonomía alta en sesiones de implementación.** No preguntar decisiones menores;
    decidirlas, documentarlas, continuar. Pausar solo si: (a) cálculo financiero no
    cubierto por fundamentos, (b) cambio irreversible en datos de producción.
11. **Saldo TOTAL vs. DISPONIBLE:** el earmark reduce el disponible, no el total. No
    confundir estos dos conceptos al implementar ni al documentar.

## Conceptos financieros clave (TAREA 4 Sesión H)

### Saldo Total vs. Saldo Disponible

- **Total** = suma de `accounts.balance` para todas las cuentas hoja. No cambia cuando se crea un earmark.
- **Disponible** = Total − earmarks activos (`account_earmarks WHERE released = false`). El earmark reserva pero no mueve plata.
- La UI en `/cuentas` muestra "Total / Cuotas crédito / Metas / Libre" cuando hay earmarks. "Libre" = disponible neto.
- **Regla crítica:** nunca reducir `balance` por un earmark. Solo reducirlo cuando el dinero realmente se mueve (pago, transferencia, RPC).

### Modelo de earmark para gastos de crédito

El ciclo de vida completo de un gasto en cuotas con cobertura:

**Fase 1 — Creación** (`create_expense_with_balance`):
- Si `funding_account_id` presente: `funding.balance -= amount`, `covering.balance += amount`, earmark creado con `expense_id`.
- Si `funding_account_id` vacío: earmark creado puramente simbólico, **ningún balance cambia**. El gasto existe pero la plata no se movió.

**Fase 2 — Confirmación de origen** (`confirm_earmark_funding`) — NUEVO en Sesión H:
- Solo aplica a earmarks con `expense_id` y cuyo expense tiene `funding_account_id IS NULL`.
- Mueve: `funding.balance -= amount`, `covering.balance += amount`.
- Actualiza: `expense.funding_account_id = p_funding_account_id`.
- Idempotencia: si el expense ya tiene `funding_account_id`, el RPC lanza excepción.

**Fase 3 — Pago de cuota** (`pay_installment`):
- Descuenta de la cuenta cubriente (o de la cuenta elegida si no hay cobertura).
- Reduce/libera el earmark proporcionalmente.

**Fase 4 — Earmark liberado:**
- `released = true` cuando todas las cuotas están pagadas.
- El saldo disponible sube porque el earmark ya no cuenta.

### ¿Por qué "Confirmar más tarde"?

iOS Safari no valida `required` en `<select>` (bug conocido del browser). Antes de Sesión H, usuarios de iPhone podían crear earmarks sin funding aunque el form tenía `required`. En Sesión H se formalizó este flujo: el campo de funding es explícitamente opcional en todos los browsers, y la UI en `/cuotas` permite completarlo después. Esto es consistente con el modelo real: el earmark existe desde el momento del gasto, el movimiento de plata puede ocurrir después.

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

## Protocolo de sesión

### Al iniciar
1. Leer `CLAUDE.md`, `docs/01-fundamentos-teoricos.md` y `docs/lecciones-aprendidas.md`.
2. Identificar qué sesión del roadmap corresponde y proponer el plan.
3. Invocar los skills que apliquen según el tipo de trabajo (ver tabla en "Skills locales").

### Durante la sesión
- **Cálculo financiero** → invocar `agente-teoria-financiera`.
- **Toca DB, endpoints o secrets** → invocar `agente-seguridad`.
- **Toca pantallas o componentes** → invocar `agente-ux`.
- **Ante un error propio:** registrarlo en `docs/lecciones-aprendidas.md` antes de cerrar.

### Al cerrar (antes del commit)
1. Invocar `agente-calidad-codigo` (build + tests + archivos huérfanos).
2. Actualizar CLAUDE.md: pasar la sesión de "pendiente" a "completada" con resumen de
   qué se hizo y qué quedó pendiente.
3. Commit local único con mensaje descriptivo. Sin push.

### Modo QA (sesiones de prueba funcional)
- Playwright: `headless: false, slowMo: 300`.
- Solo encontrar y reportar bugs; no arreglar código de producto en la misma sesión.
- Cleanup al final: borrar todos los datos creados (gastos, bienes, objetivos, cuentas,
  ingresos). Dejar fixtures intactos: Cocos Capital y Visa Test SD.
