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

- **Próxima sesión — Gastos compartidos (TAREA 9, Sesión J.1.14):** diseño
  completo ya decidido (modelo de datos, UI, dashboard, flujo de cobro) — ver
  entrada de Sesión J.1.14 más abajo, sección T9. Implementar directo sin
  repreguntar decisiones.

- **Sesión E — Suscripciones:** nueva migración con tablas `recurring_expenses` y
  `subscription_instances`; diseño a documentar en `docs/02-arquitectura.md` antes de
  implementar.

- **Sesión N — Motor de recomendación basado en historial:** analizar gastos reales
  registrados por categoría a lo largo del tiempo para sugerir montos de distribución
  (incluyendo fondo de emergencia) en vez de usar únicamente el 50/30/20 genérico.
  **Requiere diseño previo antes de implementar:** (a) cuántos meses mínimos de historial,
  (b) cómo tratar gastos irregulares vs. recurrentes, (c) fuente teórica del método de
  cálculo — NO inventar fórmula de "recomendación" sin research previo con fuentes.

- **Sesión O — Vista unificada de Movimientos:** ✅ IMPLEMENTADA como Sesión N (ver abajo).

### Sesiones cerradas

Ver [docs/historial-sesiones.md](docs/historial-sesiones.md) para el detalle completo de cada sesión.

- **Sesión F** (sin commit): housekeeping — skills de agentes, lecciones-aprendidas.md, roadmap G–M, TWR §8 en fundamentos.
- **Sesión G** (sin commit): cuentas editables — CuentaActions, conversión a contenedor (migración 014), tarjetas con parent_id.
- **Sesión G.2** (sin commit): árbol 3 niveles — E2E 23/23, migraciones 014+015 ejecutadas, useEffect auto-expand.
- **Sesión G.3** (sin commit): UX + seguridad FK — AddChildInline unificado, delete accionable, migración 016 creada.
- **Sesión H** (commit bd4f632): earmark → transferencia real — RPC confirm_earmark_funding, ConfirmFundingButton, migración 017.
- **Sesión I** (commit 2c2b52a): earns_yield + selector jerárquico — ExpenseForm refactorizado, timing Ahora/Después, migración 018.
- **Sesión I.1** (commit 558edc5): verificación E2E — tarjeta-banco, earmark caminos Ahora/Después con saldos reales confirmados, UX 390px.
- **Sesión J** (commit 44a4019): distribución rediseñada — vista unificada, toggle `$/%` en 50/30/20, sinAsignar live en header, distribución parcial válida, botón "Saltear", "Solo registrar" en IncomeForm, sección teórica colapsable, banner dashboard N=7d.
- **Sesión K** (commit pendiente): borrado forzado de cuentas (migración 019), /ingresos list + /ingresos/[id]/editar, fix redondeo sinAsignar (-$1 bug), metas en otra moneda interactuables, toggle $/% + saldo manual en fondo emergencia, categorías custom en 50/30/20, sesiones N+O documentadas.
- **Sesión L** (commit pendiente — agrupa K+L): T1: root cause force_delete FK en account_transfers (NOT NULL, no se puede NULLear; FIX: DELETE en migración 019 — **PENDIENTE re-ejecución en Supabase**); T2: reversión distribuida incompleta — income_distribution_lines es tabla de reglas (no historial), Capa 4 no almacena por ingreso → stop, no se implementa reversión parcial; T3: delete de ingresos funcionaba, bug era timing de compilación dev; T4: toggle $/% en metas de ahorro (base = incomeAmount; pct se inicializa desde monto al cambiar de modo); T5: conversión MEP para metas en otra moneda (tipo MEP manual editable, toggle {otherCurrency}|{incomeCurrency} por meta, importe derivado calculado en tiempo de submit — no almacenado en estado); `src/lib/finance/mep.ts` creado (convertViaMep pura, sin hardcode de tasa).
- **Sesión M** (commit pendiente): rediseño wizard de alta de cuentas — tarjetas de crédito salen del nivel 1; bancos tienen nuevo paso `bank_config` ("¿Qué tenés en [Banco]?") con chips opcionales para sub-cuentas (Pesos/Dólares) y tarjetas (Visa/MC/Amex/Naranja); al confirmar se crea el banco como contenedor padre con los hijos seleccionados usando `parent_id`; `AccountsOnboarding` (primera carga, solo visible con 0 cuentas) también actualizado con sub-panel expandible por banco seleccionado; billeteras/brokers/efectivo/USD siguen igual (sin bank_config); 15/15 tests Playwright verdes; tsc limpio; 49/49 tests unitarios verdes.
- **Sesión J.1 + J.1.5 — FCI vinculado + auto-sync (commit pendiente):** B-sync completo —
  migración 021 ejecutada en Supabase (accounts.holding_id + 3 RPCs SECURITY INVOKER:
  `sync_holding_balance`, `link_and_sync_holding`, `unlink_holding_from_account`);
  `src/lib/fciRates.ts` con `fetchAllFCIRates`/`matchFCIRate` (usa VCP, no TNA — fix bug);
  `FciRatesSection.tsx` corregido (mostraba TNA inexistente, ahora muestra VCP);
  `inversiones/actions.ts` → `updateHoldingPrice` usa RPC atómica;
  `cuentas/actions.ts` → `linkHoldingToAccount` + `unlinkHoldingFromAccount`;
  `CuentaActions.tsx` → UI de vinculación holding en modo edición (earns_yield=true);
  `CuentasTree.tsx` + `cuentas/page.tsx` → pasan `fciHoldings` y `holding_id` al árbol.
  tsc limpio, 49/49 tests verdes. Sin push. PENDIENTE: auto-sync VCN en page load (ver
  "Sesión J.1.5") y tests E2E del flujo completo. Earmark RPCs: ninguno tocado.

- **Sesión N** (commit pendiente — agrupa M+N): T1: RPC atómica `create_account_with_children` (migración 020, ✅ ejecutada en Supabase) — reemplaza los 2 inserts sueltos en `handleSubmitFromBankConfig`, `handleSubmitBolsillos`, y `AccountsOnboarding`; rollback total si falla cualquier hijo, earns_yield=false explícito en todos los hijos del wizard; T2: Vista `/movimientos` nueva — lista unificada gastos+ingresos cronológica con filtro por mes, cards de resumen, signos +/−, indicadores de color; BottomNav tab "Gastos" reemplazado por "Movimientos" (href=/movimientos); `/gastos` e `/ingresos` siguen accesibles via links internos y acciones rápidas; tsc limpio, 49/49 tests verdes. **QA verificado con evidencia real** (Sesión N.2, 23/23 Playwright): T1-RPC-a BBVA+Pesos+Visa creados en DB vía RPC; T1-RPC-b earns_yield=false confirmado en DB; T1-RPC-c rollback confirmado (HTTP 400, padre AtomicTest99 no quedó en DB); T2 /movimientos completo — gasto/ingreso aparecen, signos +/−, filtro mes, links edición funcionan. Token obtenido via POST /auth/v1/token (no cookies — ver lección 16).

- **Sesión J.1.5 — Auto-sync VCN en page load (✅ COMPLETA):**
  `src/lib/fciAutoSync.ts` → `autoSyncFciHoldings(supabase, holdings)`: compara VCP del
  feed de ArgentinaDatos con `holdings.current_price`; si difieren, llama RPC
  `sync_holding_balance` (atómica: actualiza holding + account.balance en una transacción).
  Integrado en `/cuentas/page.tsx` y `/inversiones/page.tsx` (server-side, antes del render).
  Corrección en memoria: si el sync actúa durante el page load, el `AccountNode.balance`
  ya refleja el nuevo valor (sin requerir un segundo load).
  Throttle: la caché de 6h de `fetchAllFCIRates` (`next: { revalidate: 21600 }`) más la
  condición `vcp !== current_price` evitan RPCs innecesarios — suficiente para single-user.
  E2E confirmado en Supabase: `holding.current_price = 2298.873`, `account.balance = 22,988,730`
  (= 10,000 cuotapartes × VCP real del feed). Earmark sobre cuenta vinculada: mismo mecanismo
  que sin holding (balance no cambia, solo el disponible) — ✅ confirmado.
  tsc limpio, 49/49 tests verdes.

- **Sesión J.1.6 — Fix vinculación FCI real + UX (commit pendiente):**
  T1: "Cocos Rendimiento FCI" (ticker COCORMA) SÍ está en el feed de ArgentinaDatos, categoría
  `rentaMixta`, con 4 clases: `Cocos Rendimiento - Clase A/B/C/D` (nombre exacto tal como
  aparece en el feed). Para vincular sin ambigüedad, nombrar el holding igual al nombre
  exacto del feed (con la clase) — así pega el match exacto en `matchFCIRate` sin pasar
  por el fuzzy match.
  Bug encontrado y corregido en el camino: `matchFCIRate` usaba `.some()` en el fuzzy match
  de palabras — como la gestora Cocos tiene ~20 fondos distintos que comparten la palabra
  "cocos" ("Ahorro", "Acciones", "Dólares Plus", "Dólar Money Market", "Renta Dólar",
  "Rendimiento"...), un holding mal nombrado podía sincronizarse con el VCP de un fondo
  totalmente distinto. Cambiado a `.every()` (todas las palabras deben matchear). Ver
  `docs/lecciones-aprendidas.md §19`.
  T2: decisión de UX — **no se permite guardar posiciones con cantidad=0.** El modelo de
  holdings computa `balance = quantity × precio`; una posición en 0 nunca aporta información
  y contradice el flujo correcto (cargar la inversión real primero). Se mantiene el bloqueo,
  pero se detectó que el atributo HTML `min` en los inputs de Cantidad/Precio interceptaba
  el submit ANTES de que corriera la validación JS, mostrando solo el tooltip nativo del
  navegador sin explicación. Se sacó `min` de ambos inputs en `HoldingForm.tsx` y se
  reescribieron los mensajes de error para explicar el porqué y guiar al flujo correcto.
  Ver `docs/lecciones-aprendidas.md §20`.
  T3: agregado texto aclaratorio en `CuentaActions.tsx` — al tildar "Genera rendimiento"
  sin holding vinculado aún: "Esto solo marca la cuenta. Para que el saldo se actualice
  solo con el mercado, cargá tu inversión real en /inversiones y después vinculala acá."
  E2E con Playwright headed confirmado: cantidad=0 bloquea con mensaje claro, cantidad
  válida sigue funcionando (regresión), texto aclaratorio visible en cuenta "Cocos Capital"
  (earns_yield=true, sin holding). tsc limpio, build limpio, 49/49 tests verdes.

- **Sesión J.1.7 — Histórico de precios + selector de fondos por institución (commit pendiente):**
  T1: migración 022 (`holding_price_history`, aditiva, no reemplaza `current_price`) —
  código listo, **⚠ pendiente de ejecución manual en Supabase** (ver nota más arriba).
  `autoSyncFciHoldings` (`src/lib/fciAutoSync.ts`) ahora también upsertea el histórico con
  la fecha REAL del feed (`rate.fecha`), no la fecha del sync; falla en silencio si la
  tabla no existe todavía. `src/lib/finance/holdingReturn.ts` → `calcHoldingReturn(history,
  windowDays=30)`: retorno simple punto-a-punto contra el precio más antiguo dentro de la
  ventana; `null` explícito si no hay suficiente historial (nunca estima). Documentado en
  `docs/01-fundamentos-teoricos.md §8.5` como insumo de datos para el TWR real de Sesión
  J.2. 7 tests unitarios verdes.
  T2: `src/lib/fciCatalog.ts` — agrupa clases (A/B/C/D) de un mismo fondo por institución,
  elige representante por mayor patrimonio. Investigación verificada (no asumida): de
  ~32 instituciones en `institutions.ts`, solo **5 matchean** fondos en el feed de
  ArgentinaDatos por prefijo de nombre: Cocos Capital, Balanz, Bull Market Brokers,
  InvertirOnline/IOL, Mercado Pago. Ningún banco tradicional matchea (usan sociedades
  gerentes con nombre distinto — Fima/Galicia, 1822 Raíces/BBVA — no verificable desde
  este feed). Detalle completo en `docs/lecciones-aprendidas.md §21`.
  T2c/d: nuevo componente `cuentas/_components/FciFundSelector.tsx` reemplaza el dropdown
  de "elegir holding ya creado" como flujo PRIMARIO en `/cuentas` para las 5 instituciones
  con catálogo verificado — el usuario elige el fondo (nombre limpio, moneda, riesgo por
  categoría, rendimiento 30d si hay histórico propio) e ingresa el monto invertido;
  cuotapartes = monto/vcp, holding creado y vinculado en un solo paso vía RPC atómica
  nueva `create_and_link_fci_holding` (migración 023, **⚠ pendiente de ejecución**).
  Para instituciones sin catálogo (o si el usuario ya tiene un holding cargado a mano)
  el flujo manual de vincular un holding existente se preserva como fallback/escape hatch
  (`showManualLink` en `CuentaActions.tsx`).
  T2e: `/inversiones/nueva` y `HoldingForm.tsx` sin tocar — confirmado por `git status` y
  regresión E2E en vivo.
  T3: DB de test verificada — cero holdings FCI actualmente (ninguno mal vinculado).
  Para la cuenta real del usuario: si `/inversiones` muestra un holding FCI con "Sin
  precio" o nombre distinto al exacto del feed, no hace falta arreglarlo a mano — usar el
  nuevo selector en `/cuentas` (editar cuenta → tildar "Genera rendimiento" → elegir el
  fondo → ingresar el monto real) crea un holding nuevo con el nombre exacto y lo vincula;
  el holding viejo queda huérfano y se puede borrar aparte, no afecta el balance porque
  solo los holdings vinculados a una cuenta lo alimentan.
  **QA E2E confirmado con Playwright headed contra el feed real:** selector visible y
  reemplaza el dropdown viejo; "Cocos Rendimiento" aparece en la lista; monto → preview
  de cuotapartes correcto; click "Vincular" falla con error controlado (RPC no existe
  todavía) — comportamiento esperado, no un crash. **Verificación completa end-to-end
  (holding creado en DB con cantidad correcta + rendimiento 30d con histórico simulado)
  queda PENDIENTE hasta que el usuario ejecute las migraciones 022 y 023.**
  tsc limpio, build limpio (26 rutas), 64/64 tests unitarios verdes (15 nuevos: 7
  `holdingReturn.test.ts` + 8 `fciCatalog.test.ts`).

- **Sesión J.1.8 — Fixes de `/inversiones/nueva` + catálogo de CEDEARs (commit `b8e95a7`):**
  T4 (Cuenta/Broker no listaba bolsillos): **NO reprodujo.** `HoldingForm.tsx` ya usaba
  `getLeafAccounts`/`accountDisplayName` correctamente. Verificado recreando el escenario
  exacto en DB de test (bolsillo "Fondos" hijo de "Cocos Capital") + Playwright — el
  selector lista "Cocos Capital — Fondos" sin problema. Ver `docs/lecciones-aprendidas.md
  §22`. Sin cambios de código para esta tarea.
  T1: Moneda ya no aparece pegada a Cantidad — se movió a la fila de "Precio promedio de
  compra" (o "Precio actual" en modo %), reforzando que la moneda es un atributo del
  precio, no de la cantidad de unidades. Cálculo de valor total sin cambios (sigue siendo
  cantidad × precio).
  T2: nuevo toggle "Precio exacto" / "Sé cuánto gané (%)" en `HoldingForm.tsx`. En modo %:
  pide precio actual (obligatorio) + % de ganancia/pérdida, deriva
  `precio_compra = precio_actual / (1 + pct/100)` con preview en vivo, marcado
  explícitamente como aproximación. Guarda contra `pct ≤ -100` (indeterminado). Fórmula
  documentada en `docs/01-fundamentos-teoricos.md §8.6` como despeje algebraico de la
  misma `Ri` de §8.2 — sin fuente nueva que agregar. Sin `min` nativo en los inputs nuevos
  (lección §20).
  T3: `curl` real confirmó `https://data912.com/live/arg_cedears` (944 símbolos únicos) y
  `.../usa_stocks` (3159 símbolos) responden 200 con campos
  `{symbol, q_bid, px_bid, px_ask, q_ask, v, q_op, c, pct_change}` — `c` = último precio
  operado. **Integrado** para `asset_type="cedear"`: `src/lib/cedearCatalog.ts`
  (`fetchCedearQuotes`/`findCedearQuote`, matching por **ticker exacto** — sin ambigüedad,
  a diferencia del catálogo FCI que necesitó heurísticas de nombre libre) +
  datalist de símbolos en el campo Ticker de `HoldingForm.tsx`; al tipear un ticker
  que matchea, autocompleta "Precio actual" (usuario puede sobreescribir, IAS 16.51).
  Fetch server-side en `inversiones/nueva/page.tsx` (data912 no expone CORS, igual que
  el patrón ya usado para `fetchAllFciFundsRaw`). `usa_stocks` NO se integró: sería
  semánticamente incorrecto usarlo para `asset_type="accion"` (acciones locales BYMA)
  porque son mercados distintos — ver lección §23 (GGAL no tiene CEDEAR).
  T5: documentado como Sesión J.1.9 en el roadmap (no implementado) — historial de
  compras a distinto precio + promedio ponderado automático, requiere tabla nueva y se
  diseñará junto con `holding_events` de Sesión J.2.
  **QA E2E con Playwright headed, 7/7 checks verdes:** T4 confirmado sin bug; T1 layout
  verificado por posición (Moneda en la misma fila que Precio, lejos de Cantidad); T2
  probado con caso real (precio actual $1000, ganancia 25% → precio de compra derivado
  $800, holding guardado y verificado en DB con `avg_buy_price=800`); T3 probado con
  ticker real "AAPL" → precio autocompletado ($24800 ARS, valor real del feed en el
  momento del test). tsc limpio, build limpio (26 rutas), 70/70 tests unitarios verdes
  (6 nuevos en `cedearCatalog.test.ts`).

- **Sesión J.1.10 — Fix: selector de fondos por institución no matcheaba bolsillos de
  nombre genérico (commit `0e2ea51`):** bug reportado y confirmado con captura real:
  editando el bolsillo "Fondos" (hijo de "Cocos Capital", `earns_yield=true`), aparecía
  "No tenés posiciones FCI" en vez del selector de Cocos. Causa: `cuentas/page.tsx`
  llamaba `findFciInstitutionForAccountName(a.name)` — solo el nombre propio del
  bolsillo, que no contiene la palabra clave de la institución cuando es genérico
  ("Fondos", "Pesos"). Fix: pasar `accountDisplayName(a, accounts)` (ya arma
  "Institución — Bolsillo" caminando ancestros) en las dos llamadas del archivo.
  `findFciInstitutionForAccountName` en sí no necesitó cambios — su `.includes()` ya
  funcionaba con el string completo, confirmado con test nuevo en `fciCatalog.test.ts`
  (no asumido). Búsqueda de otros lugares con el mismo patrón (matching por nombre propio
  ignorando jerarquía): no se encontró ninguno — es el único punto que infiere la
  institución de una cuenta ya existente a partir de su nombre. Ver
  `docs/lecciones-aprendidas.md §24`.
  **QA E2E con Playwright headed confirmado:** bolsillo "Fondos" bajo "Cocos Capital" y
  bolsillo "Ahorro" bajo "Mercado Pago" (creado para la prueba) — ambos muestran ahora
  el selector real de fondos de su institución, no el mensaje genérico. tsc limpio, build
  limpio (26 rutas), 71/71 tests unitarios verdes (1 nuevo en `fciCatalog.test.ts`).

- **Sesión J.1.11 — Fix: holding FCI vinculado no aparecía en /inversiones + rendimiento
  30d en la vista de cuenta vinculada (commit `ff28f43`):** el usuario reportó que un
  holding creado y vinculado exitosamente desde `/cuentas` (RPC `create_and_link_fci_holding`,
  migración 023) no aparecía en `/inversiones`. Causa real (no era matching de institución
  ni nada relacionado con el bolsillo específico): `inversiones/page.tsx` hacía
  `select("*, accounts(name)")`, un embed implícito que desde la migración 021 es
  AMBIGUO — hay dos FKs entre `holdings` y `accounts` (`holdings.account_id` y
  `accounts.holding_id`). PostgREST responde `HTTP 300 PGRST201` y, como el código no
  chequeaba `error`, la página quedaba en el empty-state para **todos** los holdings del
  usuario (confirmado en vivo: hasta el holding de AAPL de una sesión anterior había
  dejado de aparecer). Fix: `accounts!holdings_account_id_fkey(name)` (FK explícita) en
  vez del embed implícito. Ver `docs/lecciones-aprendidas.md §25`. TAREA 2: la vista de
  cuenta ya vinculada ("Posición FCI vinculada" en `CuentaActions.tsx`) ahora muestra el
  rendimiento 30d (`calcHoldingReturn`, §8.5 fundamentos) junto al nombre del fondo —
  antes ese cálculo solo corría dentro de `institutionsNeeded.size > 0`, así que una
  cuenta ya vinculada (que no necesita catálogo) nunca lo recibía; se movió a un cálculo
  independiente sobre todos los holdings FCI del usuario.
  **QA E2E con Playwright headed confirmado:** vinculado un fondo real de Cocos vía la UI,
  simulado histórico de precios (3 puntos, `holding_price_history`), verificado en la
  MISMA corrida que (a) el holding aparece en `/inversiones` con su cuenta y P&L, y (b)
  el badge "+8.6% · 30d" aparece en la vista de cuenta vinculada en `/cuentas`. tsc
  limpio, build limpio (26 rutas), 71/71 tests unitarios verdes (sin tests nuevos — el
  fix es una query de PostgREST no testeable en unitarios sin una instancia real;
  verificado en vivo contra REST y UI, no solo leyendo el código). Datos de prueba y
  scripts temporales eliminados tras la verificación.

- **Sesión J.1.12 — 5 bugs/gaps reportados por uso real (commit `eb49836`):**
  T1 (SPY -74%): investigado con `curl` real + Playwright — el matching de CEDEAR es
  exacto (`findCedearQuote`, sin ambigüedad SPY/SPYC/SPYD), no reprodujo como bug de
  código. Causa real: BYMA hizo un split del CEDEAR de SPY (ratio 20:1→60:1, 29 mayo–1
  junio 2026, fuente pública) antes de la compra del usuario — `holdings.quantity`
  nunca se actualizó, así que la app compara precio pre-split contra post-split. Sin
  fix de código (gap real pero fuera de alcance: no hay forma de editar
  quantity/avg_buy_price post-creación). Ver `docs/lecciones-aprendidas.md §26`.
  T2 (auto-sync de histórico): auditoría de código encontró que el insert a
  `holding_price_history` en `fciAutoSync.ts` vivía dentro del throttle de balance
  (`current_price !== vcp`), así que un día sin cambio de VCP nunca generaba fila,
  aunque fue una cotización real. Separado: el histórico ahora se registra siempre
  que el feed reporte VCP, el throttle quedó solo para el RPC de balance. Ver
  `docs/lecciones-aprendidas.md §27`.
  T3 (reset de contraseña): no existía ninguna ruta para completarlo — causa raíz
  confirmada por ausencia de código, no por config de Supabase. Agregado: `/forgot-password`
  (pide email, llama `resetPasswordForEmail`), `/reset-password` (formulario de
  contraseña nueva, protegido — redirige a `/forgot-password` si no hay sesión de
  recuperación activa), `/auth/callback` extendido con parámetro `next` (reutilizable
  para signup y para recovery). Link "¿Olvidaste tu contraseña?" agregado en `/login`.
  **⚠ Acción pendiente en el dashboard de Supabase** (no resoluble por código): agregar
  `{origin}/auth/callback` a Authentication → URL Configuration → Redirect URLs, para
  `http://localhost:3000` y para el dominio de producción en Vercel.
  T4 (selector Mercado Pago no priorizaba catálogo): la lógica de prioridad en
  `CuentaActions.tsx` ya está bien (catálogo primero, dropdown manual como fallback
  solo si `fciCatalog.length === 0`) y el matching de institución/prefijo de fondo
  también es correcto (verificado con `curl` contra el feed real). **No reprodujo**
  con Playwright headed recreando la estructura exacta reportada. Hipótesis más
  probable (no confirmada): `fetchAllFciFundsRaw` hace 4 fetches en paralelo con
  errores silenciados por categoría; Mercado Pago tiene un solo fondo en una sola
  categoría (a diferencia de Cocos/Balanz/Bull Market/IOL, repartidos en varias), así
  que un solo fetch fallido transitorio vacía TODO su catálogo de forma asimétrica.
  Fix defensivo aplicado: un reintento por categoría (`fetchFciCategoryWithRetry` en
  `fciCatalog.ts`). Ver `docs/lecciones-aprendidas.md §28`.
  T5 (recordatorio mensual de tarjetas — **implementado, no solo diseñado**): estado
  previo confirmado — `closing_day`/`due_day` ya existen (migración 009), banner de
  aviso de fecha próxima (N=3 días) ya existía en el dashboard. Decisión de diseño
  (sin tabla nueva, tal como prefería el brief): se infiere en cada carga comparando
  con la fecha actual. Agregado en `(main)/page.tsx`: (a) aviso persistente rojo
  "Falta configurar {tarjeta}" para toda tarjeta sin `closing_day`/`due_day` — se
  muestra siempre que falte el dato, no depende de la fecha, distinto del banner
  ámbar existente (que sí es por fecha próxima); (b) resumen "cuánto vas a pagar" para
  tarjetas SÍ configuradas cuya ocurrencia de `due_day` más cercana (mes anterior,
  actual o siguiente — `closestOccurrence`) cae dentro de ±7 días de hoy, sumando las
  cuotas de `installments` para ese mes (mismo agrupamiento por cuenta+mes que
  `/cuotas`, sin reinventar lógica); (c) "ya pagué" reusa `installments.paid` (el
  mismo estado que actualiza `pay_installments_batch`) — sin campo nuevo. Verificado
  en vivo con Playwright: tarjeta sin config → aviso rojo; tarjeta con vencimiento hoy
  y 1 cuota sin pagar → resumen indigo "1 de 1 cuota sin pagar $15.000"; cuota
  marcada paid → resumen cambia a verde "Ya pagaste todas las cuotas ✓".
  **QA E2E con Playwright headed, con datos reales del feed (no simulados):** holding
  SPY creado con precio autocompletado exacto ($20.410, igual al feed en vivo);
  Mercado Pago con catálogo visible incluso con un holding FCI de otra institución ya
  en la DB; dashboard con los 3 estados de TAREA 5 confirmados. tsc limpio, build
  limpio (29 rutas — 2 nuevas: `/forgot-password`, `/reset-password`), 71/71 tests
  unitarios verdes (sin tests nuevos — todos los cambios de esta sesión son de
  integración server/feed/DB, no lógica financiera pura). Datos y cuentas de prueba
  creados durante la sesión (SPY, Mercado Pago+Pesos, Cocos Ahorro test, Mastercard
  Test QA + gasto + cuota) fueron eliminados; DB verificada de vuelta a fixtures
  originales (Cocos Capital, Visa Test SD, holding AAPL).

- **Sesión J.1.13 — 6 tareas: bug crítico de saldo de ingresos + 5 mejoras
  (commit pendiente):**
  T1 (CRÍTICO — saldo de ingresos): confirmado con evidencia real (no asumido):
  `createIncome`/`updateIncome` en `ingresos/actions.ts` solo hacían INSERT/UPDATE
  directo sobre `incomes` — `account_id` era puramente informativo, nunca tocaba
  `accounts.balance`. Coherente con la teoría ya documentada del proyecto: la
  plata de un ingreso existe desde que se registra, "distribuir" es solo decidir
  cómo categorizarla (no hay una sección específica en fundamentos sobre esto —
  es lógica de dominio, no una fórmula financiera nueva a citar). Fix: migración
  024 (`create_income_with_balance`, `update_income_with_balance`,
  `delete_income_with_balance`, y `confirm_income_distribution`/
  `confirm_distribution_with_contributions` actualizadas) — 5 RPCs atómicas
  `SECURITY INVOKER`. Reglas: (a) crear ingreso con cuenta → crédito atómico
  inmediato, sin importar el tipo; (b) editar monto/cuenta de un ingreso NO
  distribuido → revierte el crédito viejo y aplica el nuevo (nunca duplica); si
  YA fue distribuido, editar es puramente informativo (la plata ya se movió vía
  la distribución, no se vuelve a tocar el balance); (c) distribuir → "movimiento
  neutro": débita de la cuenta de origen exactamente la suma de lo que las
  líneas van a acreditar en otras cuentas (`v_lines_total`, calculado
  server-side a partir de `p_lines`, no de lo que muestra la UI) — lo que el
  usuario deja sin asignar queda en la cuenta de origen, tal como ya decía el
  texto de `/ingresos/distribuir`; (d) `deleteIncome` — consecuencia directa del
  fix: ahora revierte el crédito si el ingreso no fue distribuido (antes no
  hacía falta, porque `account_id` nunca movía plata).
  **QA E2E con Playwright headed, ciclo completo con evidencia real de Supabase:**
  cuenta A en 0 → crear ingreso $100.000 → A=100.000 ✅ → editar monto a $150.000
  → A=150.000 (no 250.000) ✅ → editar cuenta destino A→B → A=0, B=150.000 ✅ →
  ingreso Sueldo $200.000 en cuenta C (sin distribuir) → C=200.000 ✅ → distribuir
  $80.000 de C hacia B con línea custom (resto sin asignar) → C=120.000,
  B=230.000 (150.000+80.000, sin duplicar) ✅. Ver `docs/lecciones-aprendidas.md §29`.
  T2 (aviso de tarjeta sin config): el link del dashboard iba a `/cuentas` sin
  más contexto. Fix: `?editar=<accountId>` + `CuentaActions` lee
  `useSearchParams()` y abre `mode="edit"` automáticamente si matchea. Al
  implementar esto se encontró un gap no reportado explícitamente pero necesario
  para que el deep-link sirviera de algo: `closing_day`/`due_day` NUNCA fueron
  editables después de crear la cuenta (solo en `NuevaCuentaForm` al crearla) —
  se agregaron los inputs (rango 1–28, mismo CHECK que migración 009) al modo
  edición de `CuentaActions` para tarjetas de crédito, y `updateAccount` ahora
  acepta `closing_day`/`due_day` opcionales.
  **QA E2E confirmado:** aviso en dashboard con `href="/cuentas?editar=<id>"`
  correcto; click abre `/cuentas` con el formulario de esa tarjeta ya en modo
  edición (sin click extra); guardar día de cierre/vencimiento persiste en DB;
  revertido a `null`/`null` después de la prueba.
  T3 (texto TNA desactualizado): `/inversiones` decía "FCI: TNA actualizada
  desde ArgentinaDatos" — el feed da VCP, no TNA (mismo malentendido de la
  lección §17, pero en un texto suelto que no se había corregido). Cambiado a
  "VCP (valor de cuotaparte) actualizado desde ArgentinaDatos".
  T4 (editar cantidad/precio de compra de un holding): antes solo se podía
  editar `current_price` (`HoldingPriceEdit`). Caso real: split de CEDEAR (SPY,
  BYMA 20:1→60:1, ver lección §26) — sin esto, no había forma de corregir la
  posición sin borrar y recrearla. Agregado `HoldingPositionEdit.tsx` +
  server action `updateHoldingPosition` + RPC atómica `update_holding_position`
  (migración 025): actualiza `quantity`/`avg_buy_price` y, si hay una cuenta
  vinculada (`accounts.holding_id`), recalcula su balance con la cantidad nueva
  (invariante `balance = quantity × current_price` de la migración 021 —
  cambiar `quantity` por fuera de un RPC atómico la habría roto).
  **QA E2E confirmado:** holding AAPL (150u @ $10) editado a 450u @ $3,33 →
  verificado en DB → revertido a los valores originales del fixture.
  T5 (verificar histórico real del usuario): sin acceso a la cuenta real del
  usuario (RLS + sin `service_role_key`, lección §9), se documenta acá la query
  para que el usuario la corra en el SQL Editor de Supabase:
  ```sql
  -- Cuántas filas de histórico tiene cada holding, con qué fechas
  select h.ticker, h.name, hph.recorded_at, hph.price
  from holding_price_history hph
  join holdings h on h.id = hph.holding_id
  where h.user_id = auth.uid()
  order by h.ticker, hph.recorded_at;

  -- Resumen: cantidad de filas y rango de fechas por holding
  select h.ticker, h.name, count(*) as filas,
         min(hph.recorded_at) as desde, max(hph.recorded_at) as hasta
  from holding_price_history hph
  join holdings h on h.id = hph.holding_id
  where h.user_id = auth.uid()
  group by h.ticker, h.name
  order by h.ticker;
  ```
  Si un holding FCI tiene más de 1 fila con fechas distintas después de varios
  días de uso, el fix de histórico de la Sesión J.1.12 (lección §27) está
  funcionando en producción. Si tiene 0 o 1 fila, todavía no pasó suficiente
  tiempo desde el fix, o el holding no matchea ningún fondo del feed
  (`matchFCIRate` — nombre exacto de la clase, ver lección §19).
  T6 (TNA estimada anualizada): `calcAnnualizedReturn(return30d)` en
  `src/lib/finance/holdingReturn.ts` = `return30d × (365/30)` — proyección
  lineal, NO una tasa garantizada, documentada en `docs/01-fundamentos-teoricos.md
  §8.7` (fórmula dada explícitamente en el brief, sin fuente externa nueva que
  citar — es aritmética de escalado, igual que §8.6). `null` explícito si no
  hay retorno de 30 días (regla dura: nunca inventar). Mostrado junto al 30d en
  `/inversiones` (para TODOS los holdings, no solo FCI — hoy en la práctica solo
  FCI acumula histórico automático) y en `CuentaActions` (posición FCI
  vinculada), siempre etiquetado "TNA est./estimada" con el texto visible
  "proyectada del último mes, no garantizada" (texto visible, no `title`/hover
  — no sirve en touch, agente-ux). De paso: `src/app/api/fci/rendimiento/route.ts`
  era código huérfano de una sesión temprana (previa al fix TNA→VCP de la
  lección §17) — no lo importaba nada en `src/` — se eliminó.
  **QA E2E con Playwright headed, histórico simulado (holding FCI temporal
  vinculado a una cuenta, 2 puntos de precio $1.000→$1.200, retorno real
  20,0%):** `/inversiones` mostró "+20.0% · 30d TNA estimada +243% proyectada
  del último mes, no garantizada"; `CuentaActions` (cuenta vinculada) mostró
  "+20.0% · 30d · TNA est. +243%" + la misma leyenda debajo. 243% = 20% ×
  365/30, matemática confirmada. Datos de prueba eliminados tras la verificación.
  4 tests nuevos en `holdingReturn.test.ts` para `calcAnnualizedReturn`.
  **Cierre de sesión:** tsc limpio, build limpio (28 rutas — una menos que
  J.1.12 por el borrado de `/api/fci/rendimiento`), 75/75 tests unitarios
  verdes (4 nuevos). Migraciones 024 y 025 creadas y **ejecutadas en Supabase
  por el usuario durante la sesión** (no como los `⚠ pendiente` de sesiones
  anteriores — se pudo verificar todo en vivo). Ver lecciones §29 y §30.

- **Sesión J.1.14 — 9 tareas: 2 bugs críticos de integridad + 6 mejoras
  implementadas + 1 diseñada (commit pendiente):**
  T1 (CRÍTICO — holding_price_history en 0 filas): root cause confirmado con
  reproducción real (REST + Playwright, no simulado desde cero): `matchFCIRate`
  (`src/lib/fciRates.ts`) priorizaba `ticker` sobre `name`
  (`holding.ticker ?? holding.name`). El feed de ArgentinaDatos no expone ningún
  ticker, solo `fondo` (nombre completo) — para FCI, `ticker` es un campo de texto
  libre opcional sin relación con el feed. Cualquier holding con algo cargado en
  Ticker nunca sincronizaba, para siempre, silenciosamente — reproducido: holding
  con `ticker="COCO1"` → 0 filas de histórico; el mismo fondo con `ticker=null` →
  sincroniza correctamente. Fix: `matchFCIRate` ya no acepta `ticker`, matchea
  siempre por `name` para FCI. Hint agregado en `HoldingForm.tsx` aclarando que
  Ticker no se usa para el sync de FCI. 5 tests nuevos en `fciRates.test.ts`
  (regresión explícita del bug). Ver `docs/lecciones-aprendidas.md §31`.
  T2 (CRÍTICO — balance de cuenta vinculada a holding desincronizado): confirmado
  que la invariante `balance = quantity × current_price` (migración 021) solo se
  mantenía en RPCs conscientes del holding; la edición manual de saldo
  (`updateAccount`) la rompía silenciosamente (el caso reportado). Fix: RPC
  `adjust_linked_account_balance` (migración 026, ejecutada por el usuario) —
  interpreta el delta de balance como compra/venta de unidades al precio actual
  del holding y actualiza `quantity` + `balance` atómicamente; si el holding no
  tiene precio cargado, rechaza la edición con mensaje explícito en vez de
  adivinar. **Alcance decidido:** solo el camino de edición manual (el reportado)
  — crédito de ingreso (migración 024) y earmark funding (migración 017) sobre
  cuentas vinculadas quedan **pendientes, documentados, no implementados** (más
  riesgo que valor tocar RPCs de dinero ya verificadas en la misma sesión que
  otras 7 tareas). Ver `docs/lecciones-aprendidas.md §32`.
  **QA E2E confirmado con Supabase real:** cuenta vinculada a holding (100u @
  $1000, balance $100.000) → editar balance a mano a $150.000 → holding pasó a
  150u (no solo el número de balance) — verificado en DB, no solo en pantalla.
  T3 (deuda de tarjeta mezclaba ARS+USD en un total): confirmado el bug — tanto
  `/cuotas` (total del grupo tarjeta+mes) como el resumen del dashboard
  ("cuánto vas a pagar") sumaban TODAS las cuotas del grupo sin filtrar por
  moneda, etiquetando el total con la moneda de la primera fila only. Fix: total
  por moneda (mismo patrón `Record<string, number>` ya usado en
  `BatchPayButton.tsx`) en ambos lugares. **QA E2E confirmado:** tarjeta con un
  gasto ARS $50.000 y un gasto USD $200 el mismo mes → dashboard mostró DOS líneas
  separadas ("$ 50.000" y "US$ 200"), nunca sumadas.
  T4 (desfasaje cierre/vencimiento): confirmado que `getInstallmentDueDates`
  (`gastos/actions.ts`) ignoraba `closingDay` por completo apenas faltaba
  `dueDay`, cayendo a un heurístico ciego de "+30 días desde la compra" sin
  relación con el ciclo real — explica fechas que "no cuadran" con el cierre
  configurado. Fix: si `closingDay` está pero `dueDay` no, usar `closingDay` como
  proxy (`effectiveDueDay = dueDay ?? closingDay`), manteniendo la lógica de ciclo
  mensual. Solo cuando faltan LOS DOS se usa el heurístico ciego (no hay ninguna
  info real que aprovechar). Texto agregado en `CuentaActions.tsx`: "Se aplica
  automáticamente todos los meses — no hace falta volver a cargarlo" (confirmado
  por lectura de código: closing_day/due_day son enteros 1-28 reaplicados cada
  mes por diseño, no hay ningún campo ni lógica de reconfiguración mensual). **QA
  E2E confirmado:** tarjeta `closing_day=7/due_day=null`, gasto real creado vía UI
  → `due_date` calculado = día 07 del ciclo siguiente (antes: fecha arbitraria por
  +30 días). Ver `docs/lecciones-aprendidas.md §33`.
  T5 (decimales en monto de gasto): confirmado — `AmountInput.tsx` (usado en
  `ExpenseForm`, `EditExpenseForm`, `DistribuirForm`) stripeaba todo carácter
  no-dígito con `\D`, bloqueando "." y "," antes de que llegara ninguna lógica de
  parseo. Fix: acepta dígitos + un separador decimal (2 decimales máx.), normaliza
  "," a "." para el valor interno. De paso corregido: `EditExpenseForm.tsx`
  redondeaba el monto a entero al ABRIR el formulario de edición
  (`Math.round(expense.amount)`), truncando centavos reales de gastos ya cargados
  incluso sin que el usuario tocara el campo. **QA E2E confirmado:** "1234,56"
  tipeado en el monto de un gasto nuevo → guardado en DB como `1234.56` (antes se
  truncaba a enteros). **Incidente de QA detectado y corregido antes del cierre:**
  un script de prueba intermedio (bug propio del script, no del producto) escribió
  por error en el campo de monto en vez de en "Comercio" (`AmountInput` también es
  `type="text"`) y su cleanup usó `DELETE` crudo en vez de la RPC
  `delete_expense_with_balance`, dejando "Cocos Capital" con $1.239,56 menos del
  valor documentado. Detectado en la auditoría final de fixtures (no por
  `git status`, que no muestra drift de datos) y restaurado a $252.500,01. Ver
  `docs/lecciones-aprendidas.md §35`.
  T6 (falta botón de confirmar en pago en lote): confirmado — el botón SÍ existe
  en el código (`BatchPayButton.tsx`), pero queda tapado: el modal usa
  `fixed inset-0 z-50` (bottom-sheet, botón en la franja inferior) y `BottomNav`
  (`layout.tsx`, se monta DESPUÉS de `{children}`) también usa `z-50` en su
  `<nav>` — con z-index empatado, gana el último en el DOM, tapando la franja
  inferior de cualquier modal `z-50`. Mismo bug latente en
  `PayInstallmentButton.tsx` y `AportarModal.tsx`; `ConfirmFundingButton.tsx` ya
  usaba el fix correcto (`z-[60]`), solo faltaba aplicarlo de forma consistente.
  Los 3 casos corregidos a `z-[60]`. **QA E2E confirmado en viewport móvil
  (390×700):** modal de pago en lote con 2 cuotas sin cobertura → botón
  "Confirmar pago" clickeable → ambas cuotas quedaron `paid=true` en Supabase.
  Ver `docs/lecciones-aprendidas.md §34`.
  T7 (no se pueden agregar categorías al cargar un gasto): confirmado — el campo
  Categoría existía (`<select>` con las categorías del usuario), pero la ÚNICA
  forma de agregar una nueva era navegar a `/categorias/nueva`, perdiendo todo lo
  ya tipeado en el formulario de gasto (monto, cuenta, comercio...). No era un
  problema de descubribilidad, sino de flujo real ausente. Fix: opción
  "+ Crear categoría nueva…" al final del `<select>` de `ExpenseForm.tsx` que
  despliega un mini-formulario inline (nombre + picker de 12 íconos) sin
  navegar — inserta directo en `categories` (mismo patrón de `/categorias/nueva`,
  client + `supabase.from("categories").insert`, no requiere RPC porque no mueve
  dinero) y autoselecciona la categoría nueva sin perder el resto del formulario.
  **QA E2E confirmado:** monto "5.000" tipeado → crear categoría inline → monto
  se mantuvo intacto → categoría persistida en DB y auto-seleccionada.
  `EditExpenseForm.tsx` no recibió el mismo tratamiento (fuera del alcance
  reportado — "al cargar un gasto" se interpretó como creación).
  T8 (filtros de fecha + gráfico en `/movimientos`): agregado selector de período
  con 4 modos: **Esta semana** (lunes a domingo de la semana actual, nuevo),
  **Este mes** (default, ya existía como navegación por `mes=<yyyy-mm>`),
  **Mes pasado** (nuevo — en realidad solo un link a `mes=prevMes(actual)`, reusa
  el mecanismo existente sin código nuevo), **Rango personalizado** (nuevo,
  `<details>` + `<form method="GET">` nativo con dos `<input type="date">` — sin
  JS extra, Next.js App Router lee los query params directo). Gráfico de barras
  horizontales por categoría (`recharts`, **instalado esta sesión** — estaba en
  el stack documentado pero nunca se había agregado como dependencia real) en
  `movimientos/_components/MovimientosChart.tsx`, uno por moneda presente (nunca
  suma ARS+USD juntos, mismo principio que TAREA 3). **Decisión TAREA 8c:** el
  filtro de fecha NO se replica en el dashboard de inicio — el dashboard es una
  vista de estado "ahora" (avisos de tarjetas, sueldo sin distribuir, resumen de
  pago con ventana ±7 días) que no encaja con la semántica de "período
  histórico"; mezclarlas complicaría el diseño sin necesidad real, ya que
  `/movimientos` ya cubre el caso de uso de reporte histórico. El
  "Gastos de {mes}" del dashboard sigue mostrando solo el mes actual, sin
  filtro, por diseño.
  **QA E2E confirmado:** gasto de hoy visible en "Esta semana", ausente en
  "Mes pasado" (redirige a `mes=2026-07`); gráfico renderiza con datos reales
  (verificado vía `.recharts-wrapper` + texto de categoría en el DOM — el header
  "Gastos por categoría" se ve en mayúsculas por CSS `uppercase`, no es texto
  literal distinto).
  T9 (gastos compartidos — **diseño completo, NO implementado esta sesión**):
  decisiones tomadas, listas para implementar sin repreguntar en la próxima
  sesión:
  - **Modelo de datos:** tabla nueva `expense_participants` (id, `expense_id`
    FK→expenses ON DELETE CASCADE, `name` TEXT libre — no requiere ser usuario
    de la app, `amount` NUMERIC, `paid` BOOLEAN DEFAULT false, `paid_date` DATE
    NULL, `deposit_account_id` UUID NULL FK→accounts ON DELETE SET NULL,
    `created_at`). RLS vía EXISTS a `expenses.user_id` (mismo patrón que
    `holding_price_history`/`fund_transactions` — no tiene `user_id` propio). Sin
    columna `currency` propia — siempre se lee de `expenses.currency` vía join
    (un gasto compartido nunca tiene una moneda distinta a la del gasto padre).
    Sin columna nueva en `expenses` — la existencia de filas en
    `expense_participants` ES la señal de "es compartido", no hace falta un
    booleano redundante.
  - **Semántica del split:** el usuario paga el monto TOTAL del gasto (sin
    cambios al modelo de `expenses` — la plata ya salió completa de su cuenta,
    como cualquier gasto hoy). "¿Entre cuántas personas?" cuenta el TOTAL de
    personas INCLUYENDO al usuario (ej. "éramos 4" → 3 filas en
    `expense_participants`, cada una "le debe" `amount/4` al usuario — la parte
    del usuario mismo NUNCA se guarda como fila, es implícita:
    `expense.amount − Σ(participants.amount)`). Default: split igual
    (`amount/N`); cada fila editable a un monto custom (brief 9a).
  - **UI de carga (9b):** en `ExpenseForm.tsx`, checkbox "¿Es compartido?" (mismo
    estilo que "Genera rendimiento" en `CuentaActions`). Al tildar: input
    "¿Entre cuántas personas? (incluyéndote)" (min 2) + N−1 filas
    {Nombre, Monto} pre-llenadas con el split igual, editables individualmente
    (mismo patrón de inputs editables que Capa 4 50/30/20 en `DistribuirForm`).
    Sin RPC nueva para la creación: dado que no mueve dinero (la plata ya se
    contabilizó al 100% en el gasto normal), un insert simple en
    `expense_participants` después de `createExpense` es suficiente — no
    atómico con el gasto en sí, mismo nivel de tolerancia que el insert
    best-effort de `holding_price_history` (metadata, no plata).
  - **Dónde se muestran los pendientes (9c):** banner nuevo en el dashboard
    ("Te deben $X de N personas", mismo estilo que el banner de "Sueldo sin
    distribuir") si `SUM(expense_participants.amount) WHERE paid=false > 0`,
    agrupado por moneda (nunca sumado entre monedas). Link a una ruta nueva
    `/compartidos`: lista de participantes pendientes (nombre, monto, gasto
    relacionado) + sección colapsada de ya cobrados.
  - **Flujo "ya me pagaron" (9d):** botón por participante → mini-form "¿A qué
    cuenta entró la plata?" (selector de cuentas hoja, filtrado por la moneda del
    gasto) → RPC atómica nueva `confirm_participant_payment(p_participant_id,
    p_account_id)` SECURITY INVOKER: verifica ownership vía join a
    `expenses.user_id = auth.uid()`, acredita `accounts.balance += amount` en la
    cuenta elegida, marca `paid=true`/`paid_date=hoy`/`deposit_account_id` — el
    mismo patrón atómico de `create_income_with_balance` (migración 024),
    explícitamente pedido en el brief.
  - **Motivo de no implementar esta sesión:** T9 es la de menor prioridad
    (9 de 9, "implementar si el contexto alcanza") y mueve dinero real en el
    flujo 9d — apurarla al final de una sesión ya larga (8 tareas, 2 críticas de
    integridad de plata) es más riesgo que valor. Queda completamente diseñada,
    sin decisiones pendientes, para implementar directo en la próxima sesión.

- **Sesión J.2 — Inversiones:** implementar TWR (§8 fundamentos); precio promedio derivado
  de monto/cantidad (no campo obligatorio); rendimiento de fondos en billeteras/bancos;
  rediseño de orden de campos en formulario (Precio antes de Cantidad — ver
  `docs/lecciones-aprendidas.md §6`).
  ~~INVESTIGAR feed de precios BYMA/CEDEARs.~~ ✅ Hecho en Sesión J.1.8: `data912.com`
  confirmado viable e integrado para CEDEARs (ver entrada de sesión más abajo). Queda
  pendiente solo la decisión de si algún día se busca tiempo real (rompería costo cero) —
  hoy no hace falta, dato educativo cada ~2hs alcanza para el caso de uso.
- **Sesión J.1.9 — Historial de compras y precio promedio ponderado automático (documentar,
  NO implementar todavía):** el usuario quiere poder cargar "compré 1 CEDEAR a $1000 y
  después otro a $1500" y que la app calcule sola el precio promedio ponderado, en vez de
  que él haga la cuenta a mano y cargue el campo `avg_buy_price` ya existente (que se llama
  "precio PROMEDIO de compra" precisamente para permitir ese cálculo manual mientras tanto).
  Esto NO es un ajuste de formulario — requiere pasar de "una posición con un precio" a "una
  posición con historial de compras" (tabla nueva de transacciones de compra por holding,
  similar en espíritu a `holding_price_history` de Sesión J.1.7 pero para compras del
  usuario, no cotizaciones del feed). Impacta directamente el cálculo de TWR de §8.2 (cada
  compra nueva es un evento de flujo que delimita un sub-período) — conviene diseñarlo junto
  con `holding_events` de Sesión J.2, no antes ni por separado. Sin fuente teórica nueva que
  agregar a fundamentos: el promedio ponderado es aritmética estándar
  (`Σ(cantidad_i × precio_i) / Σcantidad_i`), no requiere una sección nueva en §8.
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
- `mep.ts` — `convertViaMep(amount, fromCurrency, toCurrency, mepRate)`: conversión pura entre ARS↔USD usando tipo MEP provisto por el usuario. Sin tasa hardcodeada — el usuario siempre ingresa el tipo del día.
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
- `015` — (archivo en repo: `015_safe_delete_account.sql`; **ejecutada en Supabase**, confirmada via REST API Sesión G.2) RPC `safe_delete_account(p_account_id UUID) RETURNS VOID SECURITY INVOKER`: verifica propiedad vía `FOR UPDATE`; rechaza si tiene hijos directos; rechaza si tiene dependencias activas (gastos, earmarks no liberados, ingresos, metas); limpia earmarks `released=true` antes del DELETE; error descriptivo en español con conteos.
- `016` — (archivo en repo: `016_fix_cascade_fk.sql`; **ejecutada en Supabase**, sesión housekeeping post-I.1) Cambia FK `accounts.parent_id` y `account_earmarks.account_id` de `ON DELETE CASCADE` a `ON DELETE RESTRICT`. Actualiza `safe_delete_account` para limpiar earmarks released antes del DELETE (obligatorio con RESTRICT). Red de seguridad contra borrados externos por SQL directo sin pasar por el pre-chequeo de la app.

### Rutas implementadas
| Ruta | Descripción |
|------|-------------|
| `/` | Dashboard: gastos del mes, saldos, últimos gastos, botón "+ Ingreso"; grid de accesos rápidos Cuotas/Bienes/Inversiones |
| `/login` | Auth email + password (Supabase Auth); link "¿Olvidaste tu contraseña?" |
| `/forgot-password` | Pide email, llama `resetPasswordForEmail` (Supabase Auth) |
| `/reset-password` | Formulario de contraseña nueva; protegido — redirige a `/forgot-password` si no hay sesión de recuperación activa |
| `/cuentas` | Lista de cuentas agrupada; editar nombre/saldo/tipo + closing_day/due_day (tarjetas) + eliminar inline (CuentaActions); `?editar=<id>` abre esa cuenta ya en modo edición; cuentas padre con Editar/Eliminar; tarjetas de crédito con parent_id bajo banco; vista discriminada Total/Cuotas/Metas/Libre |
| `/cuentas/nueva` | Formulario nueva cuenta (tipo, moneda, saldo inicial, cuenta padre); tarjeta de crédito: selector opcional de banco padre |
| `/cuentas/transferencia` | Transferencia entre cuentas vía RPC atómico; aviso si monedas distintas |
| `/gastos` | Lista de gastos con filtros (FK disambiguation corregida: `!account_id`) |
| `/gastos/nuevo` | Formulario gasto: medio de pago, cuotas, cuenta de cobertura, autocomplete comercio |
| `/nuevo-gasto` | Alias rápido para iOS Shortcuts |
| `/categorias` | Onboarding de categorías con defaults |
| `/cuotas` | Cuotas pendientes agrupadas por tarjeta+mes; nombre tarjeta, "Vence el día X", "Pagar todas (N)", advertencia si sin closing/due |
| `/inversiones` | Holdings con P&L; FCI lazy-load: TNA via `FciRateCell` (async SC en Suspense, sin bloquear render inicial); `HoldingPriceEdit` para precio manual en acciones/CEDEARs |
| `/inversiones/nueva` | Formulario nueva posición: Cantidad separada de Moneda (moneda se muestra junto al precio); toggle "Precio exacto"/"% de ganancia" (deriva precio de compra); tipo CEDEAR con datalist de tickers reales (data912) que autocompleta precio actual |
| `/bienes` | Lista de bienes con sinking + maintenance + Meta por bien; modo manual muestra badge "manual" |
| `/bienes/nuevo` | Formulario con defaults por categoría; sección "Detalles del auto" (segmento/bought_used/tasas+fuente); sección "Objetivo de ahorro" (toggle calculado/manual) |
| `/bienes/[id]/editar` | Igual que nuevo + pre-llena todos los campos incluyendo car_segment/savings_goal |
| `/ingresos` | Lista de ingresos (últimos 100); link a editar cada uno; badge distribuido/sin distribuir |
| `/ingresos/nuevo` | Formulario ingreso: tipo (sueldo→distribuir, freelance/otro→inicio) |
| `/ingresos/[id]/editar` | Editar ingreso: monto/moneda (read-only si distribuido), tipo, cuenta, fecha, nota; eliminar con advertencia explícita si distribuido (saldos no se revierten) |
| `/ingresos/distribuir` | Vista unificada de distribución: sinAsignar live en header, obligaciones (no edit.), metas same-currency + other-currency interactuables, fondo emergencia con toggle $/% y saldo manual editable, 50/30/20 con toggle $/% + categorías custom, sección teórica colapsable → RPC `confirm_distribution_with_contributions` |
| `/objetivos` | Lista de SavingsTargets (bienes+objetivos): progress bars, badges Bien/Objetivo, AportarButton; resumen total mensual arriba; link a /bienes para detalles de mantenimiento |
| `/objetivos/nuevo` | Formulario nueva meta: nombre, monto+moneda (toggle ARS/USD), plazo en meses, cuenta opcional; preview live "necesitás aportar X/mes" |
| `/gastos/[id]/editar` | Editar gasto: monto (read-only para crédito con badge), merchant, descripción, categoría, fecha; eliminar con reversión de saldo atómica |
| `/categorias/nueva` | Formulario nueva categoría |
| `/movimientos` | Lista unificada gastos+ingresos; filtro de período (Esta semana / Este mes / Mes pasado / Rango personalizado, Sesión J.1.14); gráfico de barras por categoría (Recharts) por moneda |

### Componentes y libs
- `BottomNav` — Inicio · Gastos · [+] · Cuentas · Metas; botón [+] abre bottom sheet con overlay (z-40) + 3 acciones rápidas: Nuevo gasto / Nuevo ingreso / Transferencia
- `LogoutButton` (Server Action)
- Dashboard (`(main)/page.tsx`) — banner recordatorio N=3 días antes de closing_day o
  due_day de cualquier tarjeta de crédito activa; `daysUntil(targetDay, today)` maneja
  wrap de mes.
- `ExpenseForm` — Refactorizado en Sesión I. **Interacción primaria: selector de cuenta** (jerárquico con `<optgroup>` por institución). `paymentMethod` derivado del tipo de cuenta: efectivo→efectivo, credito→credito, otros→debito. Sección crédito (cuotas + cobertura + timing) visible solo si cuenta es type='credito'. Cobertura filtrada por `earns_yield=true`; si vacía, muestra aviso con link a /cuentas. Timing "Ahora/Después": "Ahora" muestra selector de cuenta origen, "Después" = earmark simbólico (confirmar desde /cuotas). Autocomplete comercio vía `<datalist>`; `AmountInput` para ARS; llama `createExpense` server action.
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
  montos editables, mini progress bars (`metaChecks` state), toggle $/% global (base = incomeAmount,
  pct se backfill al cambiar a % mode), other-currency con conversión MEP (toggle por meta
  {otherCurrency}|{incomeCurrency}, tipo MEP editable global, importe derivado calculado al submit);
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
- `ingresos/actions.ts` — Sesión J.1.13: `createIncome`/`updateIncome`/`deleteIncome`
  ahora llaman RPCs atómicas (`create_income_with_balance`/`update_income_with_balance`/
  `delete_income_with_balance`, migración 024) que acreditan/revierten `accounts.balance`
  según `account_id` — antes era puramente informativo (TAREA 1, bug crítico). `updateIncome`
  no toca balance si el ingreso ya fue distribuido (la plata ya se movió). `confirmDistribution`/
  `confirmDistributionWithContributions` (llama RPC migración 011, actualizada en 024 para
  debitar la cuenta de origen antes de acreditar destinos — movimiento neutro), `updateEmergencyFund`,
  `redirectToDistribute`, `setEmergencyFundAmount` (SET directo de current_amount, no +=)
- `AmountInput` (`src/components/AmountInput.tsx`) — `type="text" inputMode="numeric"`;
  dígitos crudos mientras escribe (evita conflicto de cursor); `Intl.NumberFormat("es-AR",
  { maximumFractionDigits: 0 })` al blur; solo enteros ARS
- `inversiones/_components/HoldingPriceEdit.tsx` — Ciclo idle→edit→saving; llama
  `updateHoldingPrice` server action + `router.refresh()`
- `inversiones/_components/HoldingPositionEdit.tsx` — Sesión J.1.13: ciclo idle→edit→saving,
  edita `quantity`/`avg_buy_price` de un holding ya cargado (ej. corregir split de CEDEAR);
  llama `updateHoldingPosition` server action + `router.refresh()`
- `inversiones/actions.ts` — `updateHoldingPrice(holdingId, price)` server action con RLS
  (`eq("user_id", user.id)`); `updateHoldingPosition(holdingId, quantity, avgBuyPrice)` —
  RPC atómica `update_holding_position` (migración 025)
- `src/lib/cedearCatalog.ts` — `fetchCedearQuotes()` (fetch server-side a
  `data912.com/live/arg_cedears`, `next: { revalidate: 7200 }`), `findCedearQuote(quotes,
  ticker)` (matching por ticker EXACTO, sin fuzzy — cada símbolo del feed ya es el mismo
  ticker que el usuario tipearía). Usado en `HoldingForm.tsx` para autocompletar precio
  actual de CEDEARs. 6 tests en `cedearCatalog.test.ts`.
- `src/lib/institutions.ts` — `INSTITUTIONS` (array completo), `INSTITUTION_GROUPS` (grupos
  visibles en el picker — excluye "credito" desde Sesión M), `CREDIT_CARDS` (marcas de
  tarjeta: Visa, Mastercard, Amex, Naranja — usadas solo como hijas de bancos en bank_config).
  Bug B3 corregido en `NuevaCuentaForm.tsx`: crédito salta el step "mode" y va directo al
  form, así closing_day/due_day siempre se muestran (el step "bolsillos" no tenía esos campos)
- **Flujos de alta de cuentas (dos caminos, distintos propósitos):**
  1. **`AccountsOnboarding`** (`/cuentas/_components/AccountsOnboarding.tsx`): wizard de primera
     carga, visible SOLO cuando el usuario tiene 0 cuentas. Multi-selección masiva. Bancos
     tienen sub-panel opcional para agregar Pesos/Dólares y tarjetas de crédito asociadas.
     Crea todo en una secuencia de inserts (padre primero, hijos después). Sin RPC — no mueve
     dinero, por lo que 2 roundtrips al cliente son aceptables.
  2. **`NuevaCuentaForm`** (`/cuentas/nueva`): alta individual, siempre disponible via "+ Agregar".
     Flujo: `pick` → `bank_config` (solo bancos) → submit ó `mode` → `form`/`bolsillos`.
     Crédito: pick → form (tiene closing/due day y "Banco asociado" para parent_id).
     Cuenta personalizada: pick → mode → form/bolsillos (sin bank_config).
  3. **`AddChildInline`** (en CuentasTree): alta cotidiana inline de bolsillos en cuentas
     existentes. Usa `convertAccountToParent` (primera subdivisión, RPC atómica) o
     `createChildAccount` (subdivisiones adicionales, INSERT heredando el tipo del padre).
     No puede crear hijos tipo=credito (hereda el tipo del padre).
- `inversiones/_components/FciRatesSection.tsx` — `FciRateCell` (async SC: muestra VCP del
  feed de ArgentinaDatos, fallback HoldingPriceEdit) + `FciPortfolioSummary` (totales portfolio);
  ambos envueltos en `<Suspense>` desde la page; elimina bloqueo de 4 fetches externos al render
- **Sesión J.1.14 — cambios a componentes/libs existentes** (ver detalle completo
  en la entrada de sesión): `src/lib/fciRates.ts` (`matchFCIRate` ya no acepta
  `ticker`, solo `name`, TAREA 1); `src/components/AmountInput.tsx` (acepta
  decimales, TAREA 5); `src/components/ExpenseForm.tsx` (creación de categoría
  inline sin perder el formulario, TAREA 7); `gastos/actions.ts`
  (`getInstallmentDueDates` usa `closingDay` como proxy de `dueDay` faltante,
  TAREA 4); `cuentas/actions.ts` (`updateAccount` llama RPC
  `adjust_linked_account_balance` si la cuenta tiene holding vinculado, TAREA 2);
  `cuotas/page.tsx` + `(main)/page.tsx` (totales de deuda por moneda, nunca
  sumados, TAREA 3); `cuotas/_components/BatchPayButton.tsx` +
  `PayInstallmentButton.tsx` + `objetivos/_components/AportarModal.tsx`
  (`z-[60]` en vez de `z-50`, empataban con `BottomNav` y tapaban el botón de
  confirmar, TAREA 6); `movimientos/page.tsx` +
  `movimientos/_components/MovimientosChart.tsx` (nuevo — filtro de período +
  gráfico de barras por categoría con Recharts, TAREA 8).
- `src/types/index.ts` — `AccountType` incluye `"credito"`; `Account` tiene
  `closing_day/due_day: number | null`; `Asset` tiene `car_segment: CarSegment | null`,
  `bought_used: boolean | null`, `savings_goal_mode: SavingsGoalMode | null`,
  `savings_goal_amount: number | null`, `savings_goal_months: number | null`,
  `account_id: string | null`; `Expense` incluye `funding_account_id: string | null`;
  `AccountEarmark` incluye `expense_id: string | null`; tipos `CarSegment`,
  `SavingsGoalMode`, `SavingsGoal`, `SavingsContribution`

### Testing

**Nota de build local:** `npm run build` falla por Turbopack + `fonts.gstatic.com` sin acceso a red (pre-existente; no es un bug de código). En entorno sin internet, usar `npx tsc --noEmit` como verificación de tipos. En Vercel el build pasa normalmente.

- **80 tests totales** (Jest + ts-jest):
  - 36 en `sinkingFund.test.ts` (9 nuevos en `84c3a1a`: calcCarResidualValue por segmento,
    0 meses, sanity check 65%-90%; calcAssetFunds modelo auto; CAR_DEPRECIATION_SEGMENTS.popular)
  - 13 en `savingsGoals.test.ts` (asset calculado/manual, goal con progreso/atrasado/completado/
    expirado, filtrado vivienda, ordenamiento, maintenance excluido de sinking)
  - 11 en `holdingReturn.test.ts` (7 Sesión J.1.7 — retorno simple desde histórico; 4 Sesión
    J.1.13 — `calcAnnualizedReturn`: proyección lineal 30d→365d, signo negativo, retorno 0)
  - 9 en `fciCatalog.test.ts` (Sesión J.1.7 — agrupación de fondos por institución; +1 en
    Sesión J.1.10 — bolsillo genérico requiere cadena de ancestros completa)
  - 6 en `cedearCatalog.test.ts` (Sesión J.1.8 — matching exacto por ticker CEDEAR)
  - 5 en `fciRates.test.ts` (Sesión J.1.14 — `matchFCIRate`: exacto, fuzzy, nunca usa
    `ticker` (regresión TAREA 1), null para no-fci, null sin match)
- `docs/test-cases.md` — 9 casos funcionales documentados con valores esperados
- `test-credentials.txt` — Credenciales test user (en `.gitignore`, nunca commitear)
- `screenshot.mjs` — Script Playwright para capturas autenticadas

### QA — Selectores correctos para scripts de Playwright

```javascript
// Monto gasto ARS (AmountInput — type='text' inputMode='numeric')
page.locator("input[inputMode='numeric']").first()

// Monto ingreso IncomeForm (type='number', NO AmountInput)
page.locator("input[type='number'][placeholder='0']")

// SESIÓN I: Botones de medio de pago ELIMINADOS. El form usa selector de cuenta como primario.
// No buscar botones Efectivo/Débito/Crédito — ya no existen en ExpenseForm.

// Selector de cuenta pagadora (primario)
page.locator("select").filter({ has: page.locator("option", { hasText: "Sin cuenta" }) }).first()

// Covering account select — "No destinar a ningún fondo"
page.locator("select").filter({ has: page.locator("option", { hasText: "No destinar a ningún fondo" }) })

// Timing "Ahora/Después" — son botones type='button' dentro de la sección crédito
// Usar textContent() para identificarlos, ya que pueden ser varios botones
var btns = page.locator("button[type='button']");
// "Ahora" o "Después" — buscar por texto

// Funding account select (cuando timing=Ahora) — "Seleccioná una cuenta"
page.locator("select").filter({ has: page.locator("option", { hasText: "Seleccioná una cuenta" }) })

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
  en `/inversiones`. Queda hasta Sesión J.2. Ver `docs/lecciones-aprendidas.md §6`.

**Migraciones pendientes de ejecución en Supabase dashboard:** `019_force_delete_account.sql` (re-ejecución: agregado DELETE de account_transfers — ver nota arriba).

⚠️ **ACCIÓN REQUERIDA antes de que Sesión J.1.7 funcione end-to-end:** ejecutar en el SQL
Editor de Supabase, en este orden:
1. `022_holding_price_history.sql` (tabla + RLS)
2. `023_create_and_link_fci_holding.sql` (RPC)
Sin `service_role_key` en `.env.local` (solo hay `anon_key`, ver lecciones-aprendidas §9),
Claude Code no puede ejecutar DDL — hay que correrlo a mano. Hasta entonces, en `/cuentas`
el selector de fondos se ve y funciona (lee el feed real de ArgentinaDatos), pero el botón
"Vincular" falla con un error controlado (RPC no encontrada) — comportamiento esperado,
confirmado en QA de la sesión.

**Migraciones recientes ejecutadas** (ver lista completa en sección "Base de datos" arriba):
- `016_fix_cascade_fk.sql` — ✅ EJECUTADA (sesión housekeeping post-I.1). FK CASCADE → RESTRICT + `safe_delete_account` actualizado.
- `017_confirm_earmark_funding.sql` — ✅ EJECUTADA. RPC atómica para completar earmarks sin funding.
- `018_earns_yield.sql` — ✅ EJECUTADA. Columna `earns_yield BOOLEAN NOT NULL DEFAULT false` en `accounts`. Cocos Capital tiene earns_yield=true (seteado desde UI).

- `019` — (archivo en repo: `019_force_delete_account.sql`; **PENDIENTE DE RE-EJECUCIÓN en Supabase — RPC actualizada**) RPC `force_delete_account(p_account_id UUID) RETURNS VOID SECURITY INVOKER`: elimina una cuenta aunque tenga dependencias activas; libera y borra todos sus earmarks; NULLea referencias en expenses/incomes/savings_goals/savings_contributions/assets/income_distribution_lines; **DELETE de account_transfers** (from_account_id OR to_account_id — NOT NULL, no se puede NULLear, raíz del bug T1 Sesión L); bloquea solo si tiene subcuentas. Invocado desde `CuentaActions` vía `forceDeleteAccount` server action, como segunda confirmación después de ver la lista de deps. **⚠ Ejecutar `CREATE OR REPLACE FUNCTION force_delete_account...` en Supabase SQL Editor para aplicar el fix de account_transfers.**

- `021` — (archivo en repo: `021_account_holding_link.sql`; **EJECUTADA en Supabase**) Columna `holding_id UUID REFERENCES holdings(id) ON DELETE SET NULL` en `accounts`; índice `idx_accounts_holding_id`; RPC `sync_holding_balance(p_holding_id, p_new_price)` — actualiza `holdings.current_price` Y `accounts.balance = quantity × new_price` atomicamente (SECURITY INVOKER); RPC `link_and_sync_holding(p_account_id, p_holding_id)` — vincula cuenta a holding y sincroniza balance si tiene precio; RPC `unlink_holding_from_account(p_account_id)` — desvincula (balance queda sin cambio).
- `022` — (archivo en repo: `022_holding_price_history.sql`; **EJECUTADA en Supabase** — confirmado en Sesión J.1.13, ya no pendiente) Tabla `holding_price_history` (id, holding_id FK holdings ON DELETE CASCADE, price, recorded_at DATE, created_at; UNIQUE(holding_id, recorded_at)); índice `idx_holding_price_history_holding_date`; RLS vía EXISTS a `holdings.user_id` (mismo patrón que `fund_transactions` en migración 001, no tiene user_id propio). Aditiva: no reemplaza `holdings.current_price`.
- `023` — (archivo en repo: `023_create_and_link_fci_holding.sql`; **EJECUTADA en Supabase** — confirmado en Sesión J.1.13, ya no pendiente) RPC `create_and_link_fci_holding(p_account_id, p_name, p_quantity, p_price, p_currency, p_purchase_date) RETURNS UUID SECURITY INVOKER`: inserta el holding y vincula+sincroniza la cuenta (`holding_id`, `balance = quantity × price`) en una sola transacción — evita el riesgo de holding huérfano de un insert+link sueltos (mismo principio que lección §14). Guardas `p_quantity > 0` y `p_price > 0` dentro del RPC (no solo en el server action de Next.js).
- `024` — (archivo en repo: `024_income_balance.sql`; **EJECUTADA en Supabase**, Sesión J.1.13) RPCs `create_income_with_balance`, `update_income_with_balance`, `delete_income_with_balance` (todas `SECURITY INVOKER`) + `confirm_income_distribution`/`confirm_distribution_with_contributions` actualizadas para debitar la cuenta de origen del ingreso antes de aplicar las líneas de distribución (movimiento neutro, no duplica plata). Ver checkpoint de sesión, TAREA 1.
- `025` — (archivo en repo: `025_holding_position.sql`; **EJECUTADA en Supabase**, Sesión J.1.13) RPC `update_holding_position(p_holding_id, p_quantity, p_avg_buy_price) SECURITY INVOKER`: actualiza `quantity`/`avg_buy_price` de un holding y recalcula el balance de su cuenta vinculada (si tiene) con la cantidad nueva. Ver checkpoint de sesión, TAREA 4.
- `026` — (archivo en repo: `026_adjust_linked_account_balance.sql`; **EJECUTADA en Supabase**, Sesión J.1.14) RPC `adjust_linked_account_balance(p_account_id, p_new_balance) SECURITY INVOKER`: si la cuenta tiene `holding_id`, interpreta el delta de balance como compra/venta de unidades al precio actual del holding (actualiza `quantity` + `balance` juntos); si no tiene holding vinculado, comportamiento simple de siempre. Usada por `updateAccount` (edición manual de saldo). Ver checkpoint de sesión, TAREA 2.

⚠️ **FK expenses.account_id posiblemente no activa en producción** (detectado en Sesión G.3): gastos huérfanos encontrados con `account_id` UUID inexistente (no NULL), lo que sugiere que la FK `ON DELETE SET NULL` de migración 001 puede no haber estado activa cuando se agregó la columna en 002/003. Verificar: `SELECT conname, confdeltype FROM pg_constraint WHERE conname LIKE 'expenses%'`. No bloquea nada hoy (el pre-chequeo de la app lo cubre), pero vale confirmar en el SQL Editor.

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
