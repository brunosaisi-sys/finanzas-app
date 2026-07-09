# Casos de prueba funcionales — App Finanzas

Credenciales de prueba: ver `test-credentials.txt` (local, nunca en git).

Convenciones:
- **URL base**: `http://localhost:3000`
- **Cuenta de prueba**: `test@finanzas.app`
- Todos los cálculos verificables contra `src/lib/finance/sinkingFund.ts`; las fórmulas están en `docs/01-fundamentos-teoricos.md`.

---

## 1. Autenticación

### TC-AUTH-01 — Login exitoso
**Precondiciones:** Usuario `test@finanzas.app` existe en Supabase Auth.

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Ir a `/login` | Formulario con campo email + contraseña + botón "Ingresar" |
| 2 | Ingresar `test@finanzas.app` / `TestFinanzas2024!` | — |
| 3 | Click "Ingresar" | Redirige a `/` (dashboard) |
| 4 | Verificar URL | `http://localhost:3000/` |
| 5 | Verificar header | Email del usuario visible debajo de "Finanzas" |

---

### TC-AUTH-02 — Login con credenciales incorrectas
**Precondiciones:** ninguna.

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Ir a `/login` | Formulario visible |
| 2 | Ingresar `test@finanzas.app` / `ContraseñaWrong` | — |
| 3 | Click "Ingresar" | Mensaje de error visible en pantalla (no redirección) |
| 4 | Verificar URL | Sigue en `/login` |

---

### TC-AUTH-03 — Redirect a login si no autenticado
**Precondiciones:** sin sesión activa (modo incógnito o logout previo).

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Ir a `/bienes` directamente | Redirige a `/login` |
| 2 | Ir a `/cuentas` directamente | Redirige a `/login` |
| 3 | Ir a `/gastos` directamente | Redirige a `/login` |

---

## 2. Cuentas

### TC-CUENTAS-01 — Crear cuenta simple
**Precondiciones:** autenticado.

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Ir a `/cuentas` → "+ Nueva cuenta" | Formulario de cuenta |
| 2 | Nombre: "Cuenta Corriente BNA", Tipo: banco, Moneda: ARS, Saldo: 500000 | — |
| 3 | Guardar | Redirige a `/cuentas` |
| 4 | Verificar lista | "Cuenta Corriente BNA" visible con saldo $500.000 ARS |

---

### TC-CUENTAS-02 — Cuenta con bolsillos (subcuentas)
**Precondiciones:** TC-CUENTAS-01 completado (o cualquier cuenta padre existente).

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Crear cuenta "Efectivo" tipo efectivo, ARS, saldo 150000 | Visible en lista |
| 2 | Crear subcuenta "Gastos semana" bajo "Efectivo", saldo 50000 | — |
| 3 | Ir a `/cuentas` | Subcuenta indentada bajo "Efectivo" |
| 4 | Total ARS | Solo las hojas (leaf accounts) contribuyen al total — "Efectivo" padre NO se suma |

---

## 3. Bienes

### TC-BIENES-01 — Crear Smartphone (defaults + preview + guardado)
**Precondiciones:** autenticado.

Valores de prueba:
- Nombre: "iPhone 14"
- Categoría: **Smartphone**
- Fecha compra: hace exactamente **12 meses** (ej: 2025-07-01 si hoy es 2026-07-01)
- Precio de compra: **USD 800**
- Costo de reposición C₀: **USD 1000**
- Todos los demás campos: dejar defaults precargados

Defaults esperados al seleccionar la categoría (`ASSET_DEFAULTS.smartphone`):
- Vida útil: 36 meses
- Valor residual: 30%
- Mantenimiento anual: 0.5%
- Moneda: USD
- Fuente: "Mercado/SellCell (AR ajustado)"

Cálculo esperado en preview (i=0, §1.2 y §1.3 — con hoy = 2026-07-01):
- `monthsUsed` = 12 (calendario exacto)
- `L` = 36 − 12 = **24 meses**
- `CL` = 1000 × 0.30 = 300
- `sinking` = (1000 − 300) / 24 = **≈ USD 29.17/mes**
- `currentValue` = 800 × (1 − 0.16)^1 = 800 × 0.84 = **USD 672**
- `maintenance` = 672 × 0.005 / 12 = **≈ USD 0.28/mes**
- `total` = **≈ USD 29.45/mes**

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Ir a `/bienes/nuevo` | Formulario visible |
| 2 | Seleccionar categoría "Smartphone" | Campos se pre-cargan; badge "Fuente: Mercado/SellCell (AR ajustado)" visible |
| 3 | Completar nombre, fecha, precios | Preview aparece en sección oscura |
| 4 | Verificar preview | Sinking ≈ USD 29.17, Mant. ≈ USD 0.28, Total ≈ USD 29.45 |
| 5 | Click "Guardar bien" | Redirige a `/bienes` |
| 6 | Verificar fila "iPhone 14" | Total/mes ≈ USD 29.45, desglose sinking + mant. visible |

---

### TC-BIENES-02 — Crear Auto (residual alto, vida larga)
**Precondiciones:** autenticado.

Valores de prueba:
- Nombre: "Toyota Corolla"
- Categoría: **Auto**
- Fecha compra: hace exactamente **24 meses**
- Precio de compra: **USD 15000**
- Costo de reposición C₀: **USD 18000**
- Defaults precargados (no sobrescribir)

Defaults esperados (`ASSET_DEFAULTS.auto`):
- Vida útil: 144 meses
- Valor residual: 35%
- Mantenimiento anual: 4%
- Fuente: "BEA / mercado AR (AR ajustado)"

Cálculo esperado:
- `L` = 144 − 24 = **120 meses**
- `CL` = 18000 × 0.35 = 6300
- `sinking` = (18000 − 6300) / 120 = **USD 97.50/mes**
- `currentValue` = 15000 × 0.84² = 15000 × 0.7056 = **USD 10584**
- `maintenance` = 10584 × 0.04 / 12 = **≈ USD 35.28/mes**
- `total` = **≈ USD 132.78/mes**

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Crear bien con valores de prueba | Preview: Sinking USD 97.50, Mant. ≈ USD 35.28, Total ≈ USD 132.78 |
| 2 | Guardar | Aparece en `/bienes` |
| 3 | Verificar resumen total | Card oscuro suma USD de todos los bienes |

---

### TC-BIENES-03 — Crear Vivienda (solo maintenance, sin sinking)
**Precondiciones:** autenticado.

Valores de prueba:
- Nombre: "Depto Palermo"
- Categoría: **Vivienda**
- Fecha compra: hace 24 meses
- Precio de compra: **ARS 20000000**
- Costo de reposición C₀: **ARS 25000000**
- Moneda: ARS

Comportamiento especial de vivienda:
- Los campos "Vida útil" y "Valor residual" NO aparecen en el formulario
- Fuente: "Regla 1% real estate"

Cálculo esperado:
- `useful_life_months = null` → `sinking = 0` (no hay reposición)
- `currentValue` = 20000000 × 0.84² = **ARS 14112000**
- `maintenance` = 14112000 × 0.015 / 12 = **ARS 17640/mes**
- `total` = **ARS 17640/mes**

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Seleccionar categoría "Vivienda" | Campos vida útil y residual ocultados; nota explicativa visible |
| 2 | Completar valores de prueba | Preview: Sinking $0, Mant. ≈ ARS 17640, Total ≈ ARS 17640 |
| 3 | Guardar | `/bienes` muestra card de totales ARS separado del USD |

---

## 4. Gastos

### TC-GASTOS-01 — Gasto en efectivo
**Precondiciones:** autenticado. Existe al menos una categoría ("Comida" o similar).

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Click botón `+` del BottomNav (o `/nuevo-gasto`) | Formulario de gasto |
| 2 | Monto: 8500, Moneda: ARS, Categoría: Comida, Fecha: hoy, Medio: Efectivo | — |
| 3 | Guardar | Aparece en `/gastos` y en "Últimos gastos" del dashboard |
| 4 | Verificar en dashboard | Gastos del mes incrementan en ARS 8500 |

---

### TC-GASTOS-02 — Gasto en tarjeta en 3 cuotas con cuenta de cobertura
**Precondiciones:** autenticado. Existe cuenta "Cuenta Corriente BNA" con saldo ≥ 30000 ARS.

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Nuevo gasto: monto 30000 ARS, medio "Tarjeta de crédito", cuotas: 3 | — |
| 2 | Seleccionar cuenta de cobertura: "Cuenta Corriente BNA" | — |
| 3 | Guardar | Redirige a gastos |
| 4 | Ir a `/cuotas` | 3 cuotas de ARS 10000 cada una, con fechas de vencimiento mensuales |
| 5 | Verificar meses | Cuota 1: mes corriente, Cuota 2: siguiente mes, Cuota 3: mes+2 |

---

## 5. Earmarks (saldos reservados)

### TC-EARMARK-01 — Saldo disponible baja al crear gasto con tarjeta + cobertura
**Precondiciones:** TC-GASTOS-02 completado. "Cuenta Corriente BNA" tenía saldo 500000 ARS.

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Ir a `/cuentas` | "Cuenta Corriente BNA" visible |
| 2 | Verificar "Disponible" | Saldo 500000 − 30000 (earmark del gasto de 3 cuotas) = **ARS 470000** |
| 3 | Saldo nominal | Sigue siendo ARS 500000 (no se descontó del balance real) |

---

## 6. Inversiones

### TC-INV-01 — Agregar posición y ver P&L
**Precondiciones:** autenticado.

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Ir a `/inversiones` | Lista de posiciones (puede estar vacía) |
| 2 | Agregar posición: activo "AAPL", precio compra 150 USD, cantidad 10 | — |
| 3 | Guardar | Aparece en lista con precio actual (consultado vía API) |
| 4 | Verificar P&L | (precio_actual − 150) × 10 mostrado en USD |
| 5 | Si API no disponible | Mostrar precio desconocido sin bloquear la UI |

---

## Notas de implementación para el agente de QA

- Las credenciales viven en `test-credentials.txt` (`.gitignore`).
- El Playwright script de referencia está en `screenshot.mjs` (usar `@playwright/test`).
- Para los cálculos de bienes: usar las funciones en `src/lib/finance/sinkingFund.ts` directamente para verificar valores esperados (ver `src/lib/finance/sinkingFund.test.ts` como referencia).
- Los casos de bienes usan `today = new Date()` internamente; si se corre en una fecha distinta a 2026-07-01, ajustar `monthsUsed` y recalcular `L`, `currentValue`, `sinking`, `maintenance`.
- TC-BIENES-01 a TC-BIENES-03: verificar con `toBeCloseTo(x, 1)` (±0.05 tolerancia por floating point).
