# Diseño: Fondos de Liquidez con Rendimiento Real + Earmarks

> Documento de diseño para revisión y aprobación antes de la implementación.
> Estado: BORRADOR — pendiente de decisión del usuario.
> Sesión: previa a Sesión J.2.

---

## TAREA 1 — Estado real de los dos sistemas

### 1a. Schema de holdings (reconstruido desde TypeScript — no existe migración SQL en repo)

La tabla `holdings` fue creada directamente en Supabase (igual que migraciones 002/003/012).

**Columnas confirmadas** (desde `src/types/index.ts` y queries en `inversiones/page.tsx`):

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK auth.users | |
| `account_id` | UUID FK accounts, nullable | Broker/cuenta inversora asociada |
| `ticker` | text, nullable | Símbolo del activo |
| `name` | text | Nombre del fondo/activo |
| `asset_type` | text | `"accion"`, `"cedear"`, `"bono"`, `"fci"`, `"crypto"`, `"otro"` |
| `quantity` | numeric | Cantidad de cuotapartes/acciones |
| `avg_buy_price` | numeric | Precio promedio de compra (ARS) |
| `currency` | text | `"ARS"` o `"USD"` |
| `current_price` | numeric, nullable | Precio actual. **Solo se actualiza manualmente.** |
| `purchase_date` | date, nullable | |
| `notes` | text, nullable | |
| `created_at` | timestamptz | |

**Relación con `accounts`:** `holdings.account_id` apunta a la cuenta broker (ej. "Cocos Capital"). Es FK nullable, no hay ninguna relación inversa (ninguna columna de `accounts` apunta a `holdings`). Los dos sistemas NO se comunican.

**Valor de la posición:** siempre calculado en runtime como `quantity × current_price`. Si `current_price IS NULL`, la UI muestra "Sin precio" y excluye el holding del portfolio summary.

**Vínculo con earmarks:** cero. Ninguna tabla toca holdings desde el mecanismo de earmarks.

---

### 1b. Flujo completo de earmarks

**Tabla `account_earmarks` — columnas clave:**

| Columna | Significado |
|---|---|
| `account_id` | La cuenta **cubriente** (donde se reserva el dinero) |
| `amount` | Monto reservado |
| `expense_id` | FK expenses (earmarks de crédito); null para metas |
| `installment_id` | FK installments; null para metas |
| `release_date` | Null para metas (liberación manual); fecha para cuotas |
| `released` | false mientras está activo |

**RPCs que tocan earmarks** (confirma agente-seguridad):

| RPC | Migración | Qué asume sobre el destino |
|---|---|---|
| `create_expense_with_balance` | 012 | `accounts.balance` es un número sumable |
| `confirm_earmark_funding` | 017 | `UPDATE accounts SET balance = balance ± v_amount` — **balance numérico directo** |
| `pay_installment` | 012 | Descuenta de `accounts.balance` de la cubriente |
| `pay_installments_batch` | 013 | Idem, en loop atómico |
| `confirm_distribution_with_contributions` | 011 | Crea earmarks con `release_date = NULL` |
| `convert_account_to_parent` | 014 | Reasigna `earmarks.account_id` al hijo nuevo |
| `safe_delete_account` | 015/016 | Rechaza borrado si hay earmarks activos |
| `force_delete_account` | 019 | Borra todos los earmarks de la cuenta |

**Punto exacto donde se asume balance numérico en `confirm_earmark_funding`** (`017_confirm_earmark_funding.sql`):

```sql
UPDATE accounts SET balance = balance - v_amount WHERE id = p_funding_account_id;  -- debita origen
UPDATE accounts SET balance = balance + v_amount WHERE id = v_covering_id;          -- acredita cubriente
```

No hay ninguna verificación del tipo de cuenta ni ninguna lógica alternativa. Todos los RPCs de earmark asumen que el destino es una fila de `accounts` con `balance NUMERIC` directamente modificable.

**¿Cómo se filtra qué cuentas pueden ser cubrientes?** Solo por `earns_yield = true` en `ExpenseForm.tsx`:

```ts
const coveringLeafs = leafAccounts.filter((a) => a.earns_yield === true);
```

---

### 1c. ArgentinaDatos — qué hay y qué falta (hallazgo crítico)

**Lo que hay hoy:**

La integración en `FciRatesSection.tsx` llama a:
```
https://api.argentinadatos.com/v1/finanzas/fci/mercadoDinero/ultimo
https://api.argentinadatos.com/v1/finanzas/fci/rentaFija/ultimo
https://api.argentinadatos.com/v1/finanzas/fci/rentaVariable/ultimo
https://api.argentinadatos.com/v1/finanzas/fci/rentaMixta/ultimo
```

Cada endpoint devuelve: `{ fondo: string; tna: number; fecha: string }`.

**Solo devuelve TNA (Tasa Nominal Anual), NO el VCN/NAV (Valor de Cuotaparte Neto).**

**Lo que falta para el objetivo del usuario:**

Para calcular `valor_real_posicion = cantidad × precio_cuotaparte`, se necesita el **Valor de Cuotaparte Neto (VCN)** — no la TNA. La TNA dice "este fondo rinde X% por año", pero no dice "hoy una cuotaparte vale $Y.YY". Son datos distintos.

Para obtener el VCN habría que:
- Verificar si ArgentinaDatos tiene otro endpoint con VCN (no está integrado ni documentado en el repo actualmente). La fuente canónica de VCN en Argentina es la **CAFCI** (Cámara Argentina de Fondos Comunes de Inversión, `cafci.com.ar/api`). Verificar disponibilidad y formato antes de comprometer la arquitectura.
- Alternativamente: el usuario actualiza manualmente el precio de cuotaparte (flujo ya existente con `HoldingPriceEdit`).

⚠️ **PENDIENTE DE VERIFICACIÓN antes de implementar:** Confirmar si `api.argentinadatos.com` tiene endpoint de VCN (no solo TNA), o si se usa CAFCI. Sin VCN, el rendimiento real automático no es posible desde los datos ya integrados. Esta decisión afecta directamente cuál opción de diseño es viable.

---

## TAREA 2 — Opciones de diseño

### Opción A: "Holding especial tipo fondo" (`is_liquidity_fund` en holdings)

**Concepto:** Un holding puede marcarse como `is_liquidity_fund = true`. Ese holding puede actuar como destino de earmark. Al confirmar una transferencia de cobertura, en vez de `UPDATE accounts SET balance = balance + X`, se convierte `X` ARS a cuotapartes al VCN vigente y se descuenta de `holding.quantity`.

**Schema changes:**
- `ALTER TABLE holdings ADD COLUMN is_liquidity_fund BOOLEAN NOT NULL DEFAULT false`
- `ALTER TABLE account_earmarks ADD COLUMN holding_id UUID REFERENCES holdings(id) ON DELETE RESTRICT` (nullable; XOR con `account_id` en el nivel de negocio)
- RLS en las columnas nuevas: nada nuevo si las políticas existentes ya filtran por `user_id` en cada tabla

**RPCs a reescribir:**
- `confirm_earmark_funding`: nueva rama — si el earmark tiene `holding_id`, en vez de `UPDATE accounts SET balance += X`, hace `UPDATE holdings SET quantity = quantity - (X / v_vcn)` donde `v_vcn` es el precio actual del holding al momento de confirmar
- `pay_installment` y `pay_installments_batch`: nueva rama para earmarks con `holding_id`
- `safe_delete_account` y `force_delete_account`: ya no solo verifican/borran earmarks por `account_id`; también los que tienen `holding_id` para holdings vinculados a esa cuenta

**Historial de earmarks ya confirmados:**
Los earmarks históricos con `account_id` quedan congelados al momento del movimiento. No se recalculan retroactivamente. Los nuevos earmarks con `holding_id` registran el VCN al momento de confirmar — ese registro es inmutable.

**TWR:** Compatible, pero con fricción. Cada `confirm_earmark_funding` que reduce `holding.quantity` es un retiro parcial — un evento de flujo que delimita un nuevo sub-período TWR. Para calcular correctamente, la reducción de cuotapartes se tiene que registrar con el VCN del momento. Si el RPC guarda ese precio en alguna tabla auxiliar de transacciones del holding, TWR se puede calcular a posteriori. Si no, se pierde.

**Pros:**
- Separación limpia: el holding sigue siendo la fuente de verdad del valor de la posición
- El earmark "consume" cuotapartes reales — refleja fielmente lo que ocurre en el fondo
- El usuario ve cuántas cuotapartes tiene en todo momento

**Contras:**
- Cambio de schema invasivo: nueva columna en `account_earmarks` (FK a holdings); requiere re-ejecutar en Supabase
- Todos los RPCs de earmark necesitan nueva rama de código — riesgo de bugs y regresiones
- La UI de earmark necesita distinguir entre "cuenta cubriente" y "holding cubriente" — más complejidad en ExpenseForm y cuotas
- El matching VCN→cuotapartes requiere saber el VCN exacto al momento del confirm: si la fuente de datos no está disponible en ese instante (fallo de red, CAFCI caído), el confirm falla
- La cantidad de cuotapartes puede quedar fraccionaria si los cálculos de redondeo no son exactos

---

### Opción B: "Cuenta con holding vinculado 1:1" (`holding_id` en accounts)

**Concepto:** La cuenta que hoy tiene `earns_yield = true` pasa a tener un `holding_id` opcional. Si está seteado, el "saldo mostrado" se calcula en runtime como `holding.quantity × holding.current_price` (VCN actualizado), en vez del `accounts.balance` estático. El mecanismo de earmark no cambia: sigue debitando/acreditando `accounts.balance`. La clave es que `accounts.balance` se mantiene en sincronía con el fondo: cada vez que hay un depósito o retiro real, se registra en ambos lados (`accounts.balance` como registro contable, `holdings.quantity` como posición de mercado).

**Schema changes:**
- `ALTER TABLE accounts ADD COLUMN holding_id UUID REFERENCES holdings(id) ON DELETE SET NULL` (nullable)
- Ningún cambio en `account_earmarks`

**RPCs a modificar:**
- Los earmark RPCs no se modifican para el flujo principal (siguen usando `accounts.balance`)
- Agregar un RPC para "sincronizar balance con holding": cuando el usuario actualiza el VCN manualmente (o llega del feed), `accounts.balance` se recalcula como `holding.quantity × nuevo_vcn`. Esto puede dispararse desde `HoldingPriceEdit` — hoy ya existe esa acción, solo hay que agregar el step de sync.
- Alternativamente: `accounts.balance` no se sincroniza automáticamente — es el "capital comprometido" (lo que el usuario depositó), y el VCN es informacional. Esta sub-variante es más simple pero no cumple el requisito del usuario (earmarks contra valor real, no contra capital depositado).

**Historial de earmarks ya confirmados:**
Los earmarks históricos fueron contra `accounts.balance` del momento. Quedan congelados correctamente. La opción B no rompe el historial.

**Variante recomendada de B ("B-sync"):**
- `accounts.balance` = último valor de mercado conocido (`holding.quantity × vcn_ultima_actualizacion`)
- Cuando el usuario actualiza el VCN (manual o desde feed), se recalcula `accounts.balance` automáticamente
- Los earmarks siguen trabajando contra `accounts.balance`; el usuario solo puede earmarkear hasta el valor de mercado actualizado (no más)
- El "saldo disponible" se computa como siempre: `accounts.balance - SUM(earmarks activos)`

**Variante B-derivado (más ambiciosa, más riesgosa):**
- `accounts.balance` es SIEMPRE derivado: la columna no se almacena, se calcula al vuelo en cada query como `holding.quantity × current_price`
- Requiere cambiar TODAS las queries que leen `accounts.balance`, incluyendo los RPCs atómicos — alto riesgo de romper el sistema existente

**Recomendación: usar B-sync, no B-derivado.**

**TWR:** Compatible y más simple que Opción A. Los flujos de entrada/salida del holding son los depósitos/retiros reales hacia el fondo. Los earmarks NO son flujos desde la perspectiva del holding (el holding no "pierde" cuotapartes cuando se crea un earmark). Solo cuando el earmark se libera (pago final de una cuota) hay un flujo real: el usuario retira dinero del fondo para pagar la tarjeta. Ese retiro es el evento TWR que delimita el sub-período. Esto es semánticamente correcto: TWR debe medir la performance del fondo, y un earmark es una promesa, no una transacción.

**Pros:**
- Sin cambios en `account_earmarks` ni en ningún RPC de earmark
- Menor superficie de cambio → menor riesgo de regresiones
- Conceptualmente claro: la cuenta es "el dinero", el holding es "cómo está invertido"
- Compatible con el flujo existente de `HoldingPriceEdit` (actualización manual del precio)
- Si se consigue VCN automático (CAFCI u otra fuente), se puede agregar después sin tocar earmarks
- El earmark del usuario es siempre contra un valor que él conoce y controla

**Contras:**
- `accounts.balance` puede quedar momentáneamente desincronizado con el valor real del holding (entre actualizaciones de VCN)
- El usuario necesita actualizar el VCN para que los saldos reflejen la realidad (si no hay feed automático). Aunque esto ya ocurre hoy con `HoldingPriceEdit`.
- Si VCN baja y `accounts.balance` no se actualiza, el usuario podría earmarkear "más de lo que tiene en realidad". Mitigación: la desincronización sería breve si el usuario actualiza el precio regularmente.

---

### Opción C (alternativa sugerida): "Balance derivado con cache explícita"

**Concepto:** Similar a B-sync pero invirtiendo quién es la fuente de verdad. En lugar de mantener `accounts.balance` como campo editable que se actualiza con el VCN, lo convertimos en un campo de cache (`balance_cache`) que siempre refleja `holding.quantity × vcn_at_last_update`, y los RPCs leen `balance_cache` en lugar de `balance`.

**Veredicto: NO recomendada.** Introduce el mismo riesgo de B-derivado (migrar todos los RPCs) más la complejidad de manejar invalidación del cache. La semántica de "cache" en una base de datos transaccional es frágil. El beneficio sobre B-sync es mínimo.

---

### Recomendación: Opción B-sync

**Justificación:**

1. **Menor riesgo:** no toca ningún RPC de earmark. El sistema más crítico (que mueve plata real) no cambia.

2. **Compatible con el estado actual:** hoy Cocos Capital ya existe como `accounts` con `earns_yield=true`. El `holding` asociado ya existe. Solo hay que linkearlos (`accounts.holding_id = holding_id_de_cocos`) y agregar el sync al actualizar precio.

3. **Degradable si falla el feed:** si ArgentinaDatos no tiene VCN y la integración automática no funciona, el usuario sigue actualizando el precio manualmente (flujo que ya existe hoy). La arquitectura no fuerza una dependencia hard de datos externos.

4. **Progresiva:** si después se consigue feed de VCN (CAFCI o ArgentinaDatos), se puede automatizar el sync sin tocar earmarks. La Opción A no tiene ese camino incremental — una vez que los earmarks trabajan con holdings, no hay marcha atrás simple.

5. **TWR:** los earmarks NO delimitan sub-períodos TWR (correctamente, porque son promesas, no flujos reales). Los retiros reales (cuando se paga la cuota final) sí delimitan sub-períodos. Esta semántica es la correcta según §8.2 de fundamentos: `VMF_i = valor antes del flujo`, y el flujo es el retiro efectivo, no el earmark.

6. **Schema change mínimo:** una sola columna nueva en `accounts` (`holding_id`). RLS no cambia (la columna hereda la política de `accounts` existente que filtra por `user_id`).

---

## TAREA 3 — Impacto en TWR

### El problema que plantean los earmarks frecuentes

Si cada earmark fuera un flujo del fondo, TWR tendría que recalcular un sub-período nuevo por cada gasto de tarjeta cubierto (Fase 1), cada confirmación de funding (Fase 2), y cada pago de cuota (Fase 3). Eso son 3 sub-períodos por cada cuota de crédito — con 3 cuotas por gasto, son 9 sub-períodos por un solo gasto. Para un usuario activo, el cálculo se volvería extremadamente granular y difícil de explicar.

### Por qué la Opción B-sync resuelve esto correctamente

Con B-sync, los earmarks NO son flujos del holding — son anotaciones en `account_earmarks` que reducen el saldo disponible de `accounts` pero no tocan `holdings.quantity`. Por lo tanto:

- **Fase 1 (create_expense_with_balance):** mueve plata entre cuentas (`funding_account.balance -= X`, `covering.balance += X`). El holding no cambia. NO hay sub-período TWR del fondo de liquidez.
- **Fase 2 (confirm_earmark_funding):** igual — mueve plata entre cuentas, no toca el holding.
- **Fase 3 (pay_installment):** descuenta de `accounts.balance` de la cubriente. Si la cubriente es el fondo de liquidez, el balance baja. El holding no cambia automáticamente.

El único momento donde hay un flujo real del holding es cuando el usuario **retira plata efectivamente del fondo** (en la billetera del broker) y hace una transferencia a la cuenta bancaria real. Ese es el sub-período TWR correcto.

En la app, eso corresponde a: el usuario retira de Cocos, acredita en la cuenta bancaria, y ese movimiento se registra vía `execute_account_transfer`. Ese RPC ya existe y podría registrarse como evento TWR.

### Plan TWR compatible con B-sync

Para implementar TWR en Sesión J.2 sin romper el diseño de fondos de liquidez:

1. **Nueva tabla `holding_events`** (a crear en Sesión J.2, no ahora):
   ```sql
   -- holding_id, event_type (deposit/withdrawal/price_update), amount, quantity_delta, vcn_at_event, event_date
   ```

2. **Sub-períodos delimitados por:** depósitos (transfer_in), retiros (transfer_out), y actualizaciones de precio. NO por earmarks.

3. **Cada sub-período:**
   - `VMI_i` = `holding.quantity × vcn_inicio_subperiodo` (precio al inicio, o precio post-flujo anterior)
   - `VMF_i` = `holding.quantity × vcn_fin_subperiodo` (precio justo antes del próximo flujo)
   - `Ri = (VMF_i - VMI_i) / VMI_i`

4. **Compatibilidad garantizada:** los earmarks no aparecen en `holding_events`, por lo que no fragmentan el cálculo TWR. El TWR refleja la performance del fondo sin ruido de las operaciones de cobertura.

5. **Caso de retiro para pagar tarjeta:** si el usuario retira de Cocos para pagar una cuota, ese retiro SÍ aparece como `withdrawal` en `holding_events`, y SÍ delimita un sub-período. Esto es correcto: un retiro real es exactamente el tipo de flujo que TWR está diseñado para aislar.

### Verificación contra fundamentos (agente-teoria-financiera)

**Trazabilidad:** §8.2 de `docs/01-fundamentos-teoricos.md` (fuente: GIPS® CFA Institute 2020):
- "El retorno de cada sub-período se calcula ANTES de que el flujo afecte el portfolio"
- "VMF_i = valor de mercado al final del sub-período (inmediatamente ANTES del próximo flujo)"

Un earmark NO afecta el portfolio del holding (en B-sync). Por lo tanto, earmarks no son sub-períodos TWR. Esto es **consistente con GIPS** y con la nota del §8.3: "Cada evento de flujo (aporte, retiro, compra de nuevas unidades) delimita un sub-período nuevo." Un earmark es ninguno de esos tres.

---

## Decisiones pendientes (para aprobar antes de implementar)

1. **¿Existe VCN en ArgentinaDatos o en otra fuente gratuita?**
   Verificar `api.argentinadatos.com` o `cafci.com.ar/api` antes de comprometer la arquitectura. Si no hay VCN automático, el precio se actualiza manualmente (flujo ya existente — no bloquea la implementación de B-sync, solo limita la automatización).

2. **¿Se aprueba la Opción B-sync como diseño a implementar?**
   Si sí: la sesión de implementación puede arrancar con schema change + HoldingPriceEdit sync.

3. **¿El fondo de liquidez de Cocos Capital es el único caso de uso, o hay otros?**
   Si el usuario tiene (o planea tener) otros fondos money-market en otros brokers, el diseño debe ser genérico. B-sync ya es genérico (cualquier `account` puede tener un `holding_id`).

4. **¿Cuándo se sincroniza `accounts.balance` con el VCN?**
   - Opción i: Solo cuando el usuario actualiza manualmente el precio en `HoldingPriceEdit` → más simple, menos automático
   - Opción ii: Automáticamente en cada render de `/inversiones` (si ArgentinaDatos tiene VCN) → más automático, requiere feed confiable
   - Opción iii: Botón explícito "Sincronizar saldo" en la UI → el usuario controla cuándo se actualiza el balance disponible para earmarks

5. **¿Los earmarks existentes de Cocos Capital siguen igual?**
   Sí. B-sync no cambia ningún earmark histórico — solo agrega la posibilidad de que el balance mostrado sea derivado del holding.

---

*Documento listo para revisión. Cuando el usuario apruebe el diseño (o una variante), se puede iniciar la sesión de implementación.*
