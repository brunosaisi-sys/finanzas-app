# Historial de sesiones

> Detalle completo de sesiones cerradas.
> Para el roadmap activo, estado actual del proyecto y reglas de trabajo, ver CLAUDE.md.

---

## Sesión F — Housekeeping (sin commit propio)

- ✅ Memoria paralela migrada a CLAUDE.md (reemplaza archivo de memoria paralela anterior)
- ✅ `MarkPaidButton.tsx` marcado para eliminar (reemplazado por `PayInstallmentButton`)
- ✅ Cuatro skills de agentes creadas en `.claude/skills/` (`agente-teoria-financiera`, `agente-seguridad`, `agente-ux`, `agente-calidad-codigo`)
- ✅ `docs/lecciones-aprendidas.md` creado
- ✅ Sección TWR (§8) documentada en `docs/01-fundamentos-teoricos.md`
- ✅ Roadmap G–M documentado en CLAUDE.md

---

## Sesión G — Cuentas editables (sin commit propio)

- ✅ Edición de nombre y tipo de cuenta (`CuentaActions` expandido: nombre + saldo + tipo con restricción si hay dependientes)
- ✅ Conversión de cuenta simple a contenedor con bolsillos vía RPC atómica `convert_account_to_parent` (migración 014)
- ✅ Cuentas padre con botones Editar/Eliminar inline
- ✅ Cuenta en USD bajo la misma institución verificado E2E
- ✅ Tarjetas de crédito con `parent_id` apuntando a banco (selector en form + agrupación visual en `/cuentas`; deuda excluida del total del banco)
- ✅ Vista discriminada de saldos: Total / Cuotas crédito / Metas / Libre cuando hay earmarks

---

## Sesión G.2 — Jerarquía 3 niveles (sin commit propio — verificación y cierre)

- ✅ `accountDisplayName` recursivo (camina cadena completa de ancestros)
- ✅ `GoalForm` usa `getLeafAccounts + accountDisplayName` en el selector de cuenta
- ✅ `CuentaActions` tiene prop `isChild: boolean`; bolsillos muestran "Tipo no editable"
- ✅ `deleteAccount` con pre-chequeo recursivo de hijos y dependencias; mensaje descriptivo
- ✅ `/cuentas` como árbol expandible `CuentasTree`: N niveles, expand/collapse, totales consolidados
- ✅ `AddChildInline` unificado: primer bolsillo → RPC `convert_account_to_parent`; subsiguientes → `createChildAccount`
- ✅ Fix stale state: `setMode("idle")` antes de `router.refresh()` en CuentaActions
- ✅ `/cuentas/nueva?parent=<id>` corregido: acepta cuentas de cualquier nivel como padre
- ✅ Migración 014 ejecutada (`convert_account_to_parent`) — confirmado vía REST API
- ✅ Migración 015 ejecutada (`safe_delete_account`) — confirmado vía REST API
- ✅ Fix `CuentasTree.useEffect`: auto-expande IDs nuevos cuando `accounts` prop cambia tras `router.refresh()`. Sin este fix, contenedores recién creados quedaban colapsados y sus hijos invisibles (ver lección §11)
- ✅ **T3 DE FACTO**: `AddChildInline` no tiene selector de tipo → bolsillos siempre heredan el tipo del padre automáticamente. Restricción efectivo→efectivo funciona sin código adicional
- ✅ **T4 FK Audit**: FKs conocidas (de archivos SQL): `expenses.account_id`, `incomes.account_id`, `savings_goals.account_id`, `savings_contributions.account_id`, `assets.account_id` → todos `ON DELETE SET NULL`. FKs desconocidas (sin archivo): `accounts.parent_id`, `account_earmarks.account_id`, `expenses.covering_account_id`, `expenses.funding_account_id`. Mitigación: `deleteAccount` y RPC `safe_delete_account` hacen pre-chequeo en JS/Postgres antes de borrar → nunca hay orphaning por la UI
- ✅ **E2E Playwright 23/23**: árbol 3 niveles (BBVA→Pesos/Dólares→Viaje Europa), expand/collapse independiente, totales consolidados, T3 efectivo, T5 delete con/sin hijos — todos verdes
- ❌ **NO completado**: restricción `type='efectivo'` admite hijos de cualquier tipo (solo de facto vía herencia). Si se quiere bloqueo explícito, agregar validación en `createChildAccount`. (Apuntado al backlog de Sesión J)

---

## Sesión G.3 — UX + Seguridad FK (sin commit propio)

- ✅ **T1 — AddChildInline unificado**: formulario idéntico para primer bolsillo y subsiguientes (nombre + selector ARS/USD + saldo). Para el primer bolsillo el saldo se pre-llena con el saldo del padre (informativo — la RPC lo mueve desde el padre) y aparece el aviso "⚠ Tu saldo se moverá...". La lógica de qué server action se llama sigue siendo invisible para el usuario.
- ✅ **T2 — Delete accionable**: `deleteAccount` ahora devuelve `{ deps: DepItem[], overflowCount? }` con los primeros 5 gastos (merchant/monto/fecha) y links a `/gastos/{id}/editar`. Earmarks/ingresos/metas muestran resumen con link de navegación. Si hay más de 5 gastos, indica "y N más — andá a /gastos". `/gastos` no tiene filtro por cuenta (no se inventó).
- ✅ **T3 — Migración 016**: `016_fix_cascade_fk.sql` creada con `accounts.parent_id` y `account_earmarks.account_id` cambiados de CASCADE a RESTRICT. `safe_delete_account` RPC actualizado: limpia earmarks liberados (`released=true`) antes del DELETE. `deleteAccount` JS también limpia released earmarks. **EJECUTADA en Supabase (sesión housekeeping post-I.1).**
- ✅ **T4 — Saldo $0 investigado**: basura de fixture — 2 gastos + 1 earmark liberado referenciaban cuenta `8b480ef1-...` que no existe en accounts (borrada fuera del flujo de la app, posiblemente vía SQL directo en sesión anterior). Eliminados del test user. No hay bug de código. La cuenta referenciada habría sido borrada saltando el pre-chequeo de dependencias (debería haber fallado), lo que refuerza la necesidad de la migración 016.
- ⚠️ **FK expenses.account_id posiblemente no activa en producción**: los gastos huérfanos de T4 tenían `account_id` poblado con UUID inexistente (no NULL), lo que sugiere que la FK `expenses.account_id ON DELETE SET NULL` definida en migración 001 puede no estar activa en el DB real (columna `account_id` pudo haberse agregado en 002/003 sin FK). Verificar: `SELECT conname, confdeltype FROM pg_constraint WHERE conname LIKE 'expenses%'`. (Ver también nota en sección de migraciones de CLAUDE.md.)

---

## Sesión H — Earmark a transferencia real (commit bd4f632)

- ✅ **Confirmado con Playwright:** `create_expense_with_balance` con `covering_account_id` set y `funding_account_id=""` → **NO mueve plata** (earmark simbólico). Balances verificados antes/después con Playwright y REST directo. El flujo iOS Safari (no valida `required` en `<select>`) quedó formalizado como camino opcional en todos los browsers.
- ✅ **Migración 017** (`017_confirm_earmark_funding.sql`): RPC PL/pgSQL atómica `confirm_earmark_funding(p_earmark_id, p_funding_account_id)`. Validaciones: earmark no liberado, gasto sin funding previo, origen ≠ destino, mismo user, misma moneda. Movimiento: `funding -amount, covering +amount, expense.funding_account_id = funding`. FOR UPDATE para evitar race conditions. **EJECUTADA en Supabase.**
- ✅ **ExpenseForm.tsx:** `fundingAccountId` explícitamente opcional en todos los browsers. Primera opción: "Confirmar más tarde". Hint dinámico: "La plata se mueve ahora" vs "Podés confirmar desde Cuotas". Label marcado `(opcional)`.
- ✅ **`cuotas/actions.ts`:** Server Action `confirmEarmarkFunding(earmarkId, fundingAccountId)` → llama RPC `confirm_earmark_funding`.
- ✅ **`ConfirmFundingButton.tsx`** (nuevo): Modal bottom-sheet z-[60] (sobre BottomNav z-50 + `pb-24` para no quedar tapado). Muestra nombre gasto + monto + cuenta cobertura. Select con cuentas de misma moneda + saldo actual. Advertencia ámbar si saldo insuficiente (no bloquea). On success: `router.refresh()`.
- ✅ **`cuotas/page.tsx`:** Sección "Transferencias pendientes" con fondo ámbar, visible solo cuando `pendingFunding.length > 0`. Query: `account_earmarks` join `expenses` filtrando `released=false AND expense_id IS NOT NULL`, luego JS-filter por `expenses.funding_account_id IS NULL`. Compatible con PostgREST (no puede filtrar joined columns directamente).
- ✅ **E2E Playwright 7/7:** crear sin funding → balances sin cambio → sección visible → gasto en lista → Confirmar visible → modal abre → Cancelar clickeable (z-index fix).
- ✅ **Migración 017 EJECUTADA** en Supabase (confirmada con llamada de prueba a la RPC).
- ⚠️ **Build local:** `npm run build` falla por Turbopack + Google Fonts offline (red sin acceso a `fonts.gstatic.com`). Pre-existente. `npx tsc --noEmit` pasa limpio. En Vercel pasa. (Ver nota de build en sección Testing de CLAUDE.md.)

---

## Sesión I — earns_yield + selector jerárquico (commit 2c2b52a)

- ✅ Migración 017 confirmada ejecutada en Supabase (llamada de prueba exitosa).
- ✅ **Migración 018 EJECUTADA** en Supabase por el usuario. Columna `earns_yield BOOLEAN NOT NULL DEFAULT false` existe y es funcional.
- ✅ **`earns_yield` en Account type** (`src/types/index.ts`): campo `earns_yield?: boolean`.
- ✅ **Server actions** actualizados: `updateAccount` acepta `earns_yield`; `createChildAccount` acepta `earns_yield`.
- ✅ **NuevaCuentaForm**: toggle "¿Esta cuenta genera rendimiento?" (Sí/No) visible para todos los tipos no-crédito. Componente reutilizable `YieldToggle`. Nota: primer bolsillo vía `convertAccountToParent` usa default false (limitación RPC existente).
- ✅ **CuentaActions**: toggle checkbox `earns_yield` en modo edición para no-crédito. Prop `earnsYield: boolean` requerido.
- ✅ **CuentasTree**: `AccountNode` tiene `earns_yield: boolean`; todos los `CuentaActions` reciben el prop.
- ✅ **ExpenseForm refactorizado** (TAREA 2): selector jerárquico como interacción primaria; `paymentMethod` derivado del tipo; sección crédito con cuotas + cobertura (`earns_yield=true`) + timing Ahora/Después.
- **Decisión de diseño**: El medio de pago se deriva del tipo de cuenta, nunca editable manualmente. efectivo=efectivo, crédito=crédito, otros=débito.

---

## Sesión I.1 — Verificación E2E TAREA 3 y TAREA 4 (commit 558edc5)

> Esta sesión es continuación directa de Sesión I (verificación E2E de las tareas 3/4/5 que quedaron
> pendientes). No es una sesión nueva del roadmap principal — se numeró I.1 para no colisionar con
> Sesión J (Distribución de sueldo), que siempre fue el nombre del roadmap para esa funcionalidad.

- ✅ **TAREA 3 — Tarjeta de crédito asociada a banco** (verificada E2E con Playwright):
  - Flujo completo funciona: crear institución banco → crear tarjeta (Visa) → selector "Banco asociado" aparece → visa se agrupa bajo el banco en `/cuentas`.
  - `parent_id` correcto en DB confirmado vía REST.
  - Crédito salta el step "mode" y va directo al formulario ✅.
  - Deuda de tarjeta NO suma al saldo del banco: `getConsolidatedTotals` excluye `type='credito'` ✅.
  - **Nota UX**: si un banco tiene SOLO una tarjeta de crédito como hijo (sin bolsillos ARS/USD), el árbol muestra $0 para el banco porque el total consolidado de hijos no-crédito es vacío. Flujo correcto: crear banco + bolsillo(s) + tarjeta, no banco + solo tarjeta.
- ✅ **TAREA 4A — Camino "Después"** (earmark simbólico + confirmación desde /cuotas):
  - Gasto $1000 ARS con Visa Test SD, cobertura Cocos Capital, timing "Después" → saldo Cocos NO cambia al crear.
  - Sección "Transferencias pendientes" aparece en `/cuotas`.
  - Click "Confirmar" → modal abre → selector muestra cuentas compatibles ARS.
  - Confirmar con QA Origen ARS → Cocos +$1000, QA Origen -$1000 (verificado vía REST).
  - `expenses.funding_account_id` seteado correctamente en DB.
- ✅ **TAREA 4B — Camino "Ahora"** (transferencia inmediata al crear el gasto):
  - Gasto $2000 ARS con timing "Ahora" → selector de cuenta origen visible en el formulario.
  - Al guardar: Cocos +$2000, QA Origen -$2000 **inmediatamente**, sin pasar por `/cuotas`.
  - `expenses.funding_account_id` seteado desde la creación ✅.
- ✅ **TAREA 5 — Consistencia visual selector jerárquico** (390px mobile):
  - Sin cuenta → sección crédito oculta ✅.
  - No-crédito → sección crédito oculta, hint (efectivo/débito) visible ✅.
  - Visa → sección crédito visible, hint "Tarjeta de crédito" ✅.
  - Sin overflow horizontal (scrollWidth=375) ✅.
  - Cuentas de crédito marcadas "(Crédito)" en opciones del selector ✅.
  - Al volver a no-crédito: cuotas/cobertura/timing desaparecen limpiamente ✅.
- ⚠️ `delete_expense_with_balance` con 3 cuotas ($1000÷3=333.33...) puede dejar residuo de $0.01 al revertir el earmark. No afecta flujo de producción. Ver lección §13.
- ✅ Solo cambios de documentación commiteados (CLAUDE.md + lecciones-aprendidas.md). Sin cambios de código.
