# Fundamentos Teóricos — App de Finanzas Personales

> Este documento es la **base conceptual y autoritativa** del proyecto. Toda fórmula,
> default y lógica de cálculo de la app debe rastrearse hasta una fuente listada acá.
> Está organizado por nivel de confiabilidad de la fuente.

---

## 0. Principio rector

La app distingue **cuatro tipos de fondos** que la teoría financiera trata como
conceptos separados. Confundirlos es el error más común en finanzas personales.

| Fondo | Propósito | Cuándo se usa |
|---|---|---|
| **Sinking Fund (Amortización)** | Reemplazo planificado de un bien al fin de su vida útil | El bien "muere" o se decide cambiarlo |
| **Maintenance Reserve (Mantenimiento)** | Reparaciones que mantienen el bien funcionando | Algo se rompe / requiere service antes del reemplazo |
| **Savings Goal (Objetivo)** | Meta con monto y fecha, no ligada a un bien depreciable | Viaje, mudanza, entrada de algo |
| **Emergency Fund (Emergencia)** | Colchón general para lo imprevisto (3-6 meses de gastos) | Pérdida de ingreso, evento inesperado |

---

## 1. NIVEL 1 — Máxima confiabilidad (normativa y peer-reviewed)

### 1.1 Vida útil, valor residual y depreciación — IAS 16

**Fuente:** Norma Internacional de Contabilidad 16 (Property, Plant and Equipment),
IASB. Es la norma contable de referencia mundial.

Definiciones operativas (las usamos textualmente en la app):

- **Vida útil:** período durante el cual se espera que un activo esté disponible para uso.
- **Valor residual:** monto estimado que se obtendría HOY por la disposición del activo,
  deducidos los costos de disposición, si el activo ya tuviera la edad y condición
  esperadas al final de su vida útil.
- **Monto depreciable:** Costo − Valor residual.

**Reglas críticas que la app debe respetar:**

1. El valor residual se estima a **precios de hoy**, no proyectados al futuro (IAS 16.6).
   → En la app, el "valor de reventa estimado" es lo que valdría hoy un equivalente usado.
2. Vida útil y valor residual se **revisan periódicamente** y se ajustan (IAS 16.51).
   → La app permite al usuario hacer override de cualquier default en cualquier momento.
3. **Depreciación por componentes** (IAS 16): un bien y sus partes con vida distinta
   pueden depreciarse por separado. Ej.: máquina 4%/año, su motor 8%/año.
   → Esto fundamenta la separación heladera (Sinking Fund) vs. compresor (Maintenance).

### 1.2 Sinking Fund Method — Ingeniería económica

**Fuente:** NPTEL (National Programme on Technology Enhanced Learning, India) y
literatura estándar de ingeniería económica.

El método asume que se deposita un monto fijo cada período en un fondo que gana
interés compuesto, de modo que el acumulado al final de la vida útil = monto a reponer.

**Fórmula del aporte periódico (con interés):**

```
        (C0 − CL) · i
d =  ─────────────────────
       (1 + i)^L  −  1
```

Donde:
- `d`  = aporte por período
- `C0` = costo de reposición (precio del bien nuevo equivalente)
- `CL` = valor de salvamento / reventa estimado del bien actual
- `i`  = tasa de interés/rendimiento real por período
- `L`  = número de períodos hasta el reemplazo

**Caso especial `i = 0`** (sin rendimiento real, común en Argentina con ahorro en
dólar billete): la fórmula colapsa a la versión simple:

```
d = (C0 − CL) / L
```

> ⚠️ Implementación: la app debe usar la fórmula con interés cuando `i > 0`, y la
> división simple cuando `i = 0`, evitando división por cero en `(1+i)^L − 1`.

### 1.3 Tasa de depreciación de bienes durables — Peer-reviewed

**Fuente:** Cao et al., "Identifying the Depreciation Rate of Durables from Marginal
Spending Responses", *Journal of Money, Credit and Banking* (2025).

- Tasa de depreciación de durables del hogar (vehículos, electrodomésticos, muebles;
  **excluye vivienda**): ≈ **0,16–0,17 anual** (~16% de pérdida de valor por año).
- Resultado robusto: similar entre EE.UU. y China.

→ Uso en la app: cuando no haya un default específico por categoría, usar 16%/año
como tasa de depreciación de referencia para estimar valor residual.

### 1.4 Vida útil por categoría — Fuente oficial

**Fuente:** US Bureau of Economic Analysis (BEA), tablas de Fixed Assets and Consumer
Durable Goods. Basadas en estudios del Tesoro de EE.UU. y encuestas de service-life.

→ Uso: defaults de vida útil precargados por categoría (ver §4 tabla de defaults).

---

## 2. NIVEL 2 — Reglas prácticas establecidas (consenso, no normativa)

### 2.1 Mantenimiento — Regla del 1%

- Reservar **1% del valor del bien por año** para mantenimiento/reparaciones.
- Escalable a **2–4%** según antigüedad y estado del bien.
- Origen: regla de oro de real estate (home maintenance), extendida a durables.

```
Aporte mantenimiento mensual = Valor_actual_bien × (% anual) / 12
```

> Para vivienda: 1% del valor de la propiedad/año es el estándar (rango 1–4%).
> Para electrodomésticos y auto: 1% es punto de partida razonable.

### 2.2 Vida útil de electrodomésticos — Encuesta OCU (87.000 personas)

- Grandes electrodomésticos: 11–12 años promedio.
- Heladera: 10–15 | Lavarropas: 8–12 | Lavavajillas: 8–10 | Secarropas: 10–13
- Microondas: 7–10 | Horno eléctrico: 10–15 | Aspiradora: 5–8

### 2.3 Regla reparar vs. reemplazar — Regla del 50%

- Si el costo de reparación supera el **50%** del precio de un bien nuevo equivalente,
  conviene reemplazar.
- → La app puede sugerir esto cuando el usuario registra una reparación.

### 2.4 Reventa de tecnología

- Smartphones flagship: pierden **25–35% por año** los primeros 2–3 años.
- iPhones retienen ~40–50% del valor a 2 años; Android ~20–30%.
- Origen: datos de mercado (SellCell, Decluttr) — confiables pero comerciales.

### 2.5 Marco de presupuesto global — 50/30/20

- 50% necesidades / 30% deseos / 20% ahorro e inversión.
- Útil como vista de referencia, no como regla rígida.

---

## 3. NIVEL 3 — Ajuste por país (CRÍTICO para Argentina)

> Toda la teoría de Sinking Fund asume **moneda estable** y que el ahorro **gana
> interés real**. En Argentina esto NO se cumple. Sin estos ajustes, los cálculos
> estándar dan resultados peligrosamente equivocados.

**Fuentes:** INDEC, IAE Business School (informes económicos mensuales), BCRA.

### 3.1 Reglas de ajuste para Argentina

1. **Denominación en USD.** Todos los fondos de amortización y reservas se expresan y
   (idealmente) se guardan en dólares. En pesos, el ahorro se licúa antes de llegar
   al objetivo. (Inflación proyectada 2026 ≈ 10% anual en el escenario oficial
   optimista; históricamente mucho mayor.)

2. **Reposición en la moneda del bien:**
   - Bienes importados (celular, notebook, TV): se mueven con el **dólar** → calcular `C0` en USD.
   - Bienes con componente local (muebles, servicios): dinámica mixta → permitir al
     usuario elegir la moneda de referencia del bien.

3. **Tasa `i` realista.** El rendimiento real en dólares de un fondo conservador en
   Argentina suele ser **≈ 0 o negativo** (dólar billete). No usar el 5–6% de los
   ejemplos académicos por defecto. Default sugerido: `i = 0` salvo que el usuario
   indique dónde invierte y a qué tasa.

4. **Valor de reventa más alto.** El mercado de usados argentino es relativamente más
   líquido y valioso (lo nuevo es caro en USD), así que el valor residual estimado
   debería ser **mayor** que el 0–15% que IAS 16 asume para mercados desarrollados.
   Default sugerido: ajustar al alza los residuales de tablas internacionales.

### 3.2 Arquitectura de la capa de país

La app separa: **(defaults teóricos universales) + (capa de ajuste por país)**.
Argentina es la primera capa implementada; el diseño debe permitir agregar otros
países sin tocar el motor de cálculo.

### 3.3 Depreciación de automóviles en Argentina — Modelo de dos tasas

**Fuentes:**
- Asociación de Concesionarios de Automotores (ACARA), vía estudio LA NACION sobre
  evolución de precios de venta final de modelos en el mercado desde 2000.
- Kavak Argentina — informes de variación de precios de usados en dólares.
- Cámara del Comercio Automotor (CCA) — rotación y comportamiento de segmentos.
- Autozoom, comparaencasa — rankings de retención de valor por marca/modelo (2025-2026).

**Hallazgo central:** la depreciación de autos en Argentina es **no lineal** y **más baja
en dólares** que en mercados desarrollados. No se puede modelar con una tasa única anual.

**Modelo de dos tasas (d1, d2):**

```
Valor al año n (para n >= 1):
   V(n) = C0 × (1 − d1) × (1 − d2)^(n − 1)

Donde:
   C0 = valor del auto nuevo/actual de referencia
   d1 = tasa de depreciación del PRIMER año (más alta)
   d2 = tasa de depreciación de los años SIGUIENTES (más baja, se estabiliza)
```

**Regla especial para autos comprados usados:** si el auto ya tiene antigüedad al momento
de la compra, el primer año de fuerte caída (d1) YA OCURRIÓ con el dueño anterior. Para
proyectar su valor futuro se usa solo d2 desde su antigüedad actual. No aplicar d1 de nuevo.

```
Auto comprado usado con antigüedad A (años), proyección a M meses vista:
   V_futuro = V_actual × (1 − d2)^(M/12)
```

**Tabla de tasas por segmento (defaults editables):**

| Segmento | d1 (año 1) | d2 (años siguientes) | Retención a 3 años aprox. | Fuente |
|---|---|---|---|---|
| Auto popular / medio (Corolla, Golf, Onix, etc.) | 0.18 | 0.13 | ~62% | ACARA/LA NACION, Autozoom |
| Pickup (Hilux, Ranger, Amarok, Frontier) | 0.12 | 0.10 | ~75% | CCA, Ámbito, MercadoLibre |
| SUV compacta (Nivus, T-Cross, Tracker, Creta) | 0.15 | 0.13 | ~65% | Autozoom |
| Premium (BMW, Mercedes, Audi) | 0.22 | 0.19 | ~48% | Autozoom |
| Compacto de entrada / marca poco presente | 0.20 | 0.16 | ~57% | comparaencasa |

> Valores centrales de los rangos observados. Todos EDITABLES por el usuario (IAS 16.51).
> La app SIEMPRE muestra el default con su segmento y fuente, y permite override.

**Rango de validación (sanity check):** para un auto popular/medio comprado usado, la
retención de valor en dólares a 2 años NO debería caer por debajo del ~65% ni superar el
~90% del valor de compra. Si el cálculo cae fuera de ese rango, la app debe advertirlo.

**Ejemplo trazado (caso auto usado del usuario):**
- Auto popular/medio comprado usado hace ~4 meses en USD 12.000.
- Valor actual estimado ≈ USD 12.000 (compra reciente, sin depreciación significativa aún).
- Proyección a 24 meses con d2 = 0.13:
    V(24m) = 12.000 × (1 − 0.13)^2 = 12.000 × 0.7569 = **USD 9.083**
- Este es el valor de reventa estimado (CL) para el sinking fund.

**Cálculo del sinking fund con este modelo:**
```
C0 = 13.000 (reposición equivalente hoy)
CL = 9.083   (lo que vale SU auto en 24 meses, calculado con d2)
L  = 24 meses
d  = (13.000 − 9.083) / 24 = 3.917 / 24 = USD 163/mes
```
Comparar con modelo anterior (residual fijo 35%): daba USD 352/mes — sobreestimaba en más del doble.

**Nota sobre C0 (costo de reposición):** C0 no es el precio del bien equivalente actual
— es el precio del bien CON EL QUE EL USUARIO QUIERE REEMPLAZARLO. Puede ser más caro
(upgrade) o más barato (downgrade). El sinking fund cubre exactamente la brecha C0 − CL.

---

## 4. Tabla de defaults por categoría (editable por el usuario)

| Categoría | Vida útil (años) | % Mantenimiento anual | Valor residual fin de vida | Fuente principal |
|---|---|---|---|---|
| Heladera/Freezer | 12 | 1% | 10% | OCU / BEA |
| Lavarropas | 10 | 1,5% | 8% | OCU |
| Lavavajillas | 9 | 1,5% | 8% | OCU |
| Secarropas | 11 | 1,5% | 8% | OCU |
| Microondas | 8 | 1% | 5% | OCU |
| Horno/Cocina | 12 | 1% | 8% | OCU |
| TV | 8 | 0,5% | 10% | Mercado |
| Notebook/PC | 5 | 1% | 15% | Mercado |
| Smartphone | 3 | 0,5% | 30% (AR ajustado) | Mercado/SellCell |
| Auto | 12 | 3–5% | Modelo de dos tasas por segmento (ver §3.3) | ACARA, CCA, Autozoom, comparaencasa |
| Vivienda (propia) | n/a (no se reemplaza) | 1–2% | n/a | Regla 1% real estate |
| Muebles | 15 | 0,5% | 10% | BEA |

> Todos los valores son **puntos de partida editables**. La app SIEMPRE muestra el
> default con su fuente y permite al usuario reemplazarlo. La preferencia del usuario
> tiene prioridad absoluta sobre el default (principio IAS 16.51 de revisión).

---

## 5. Lógica de cálculo integrada (pseudocódigo de referencia)

```
Al registrar un BIEN:
  1. Detectar categoría → cargar defaults (vida útil, %mant, %residual, fuente)
  2. Mostrar defaults al usuario con su fuente → permitir override
  3. Determinar moneda de referencia del bien (USD si importado)
  4. C0 = costo de reposición (precio nuevo equivalente, en moneda del bien)
  5. CL = C0 × %residual  (o valor manual del usuario)
  6. L  = meses hasta reemplazo (vida útil − antigüedad actual)
  7. i  = rendimiento real mensual del fondo (default 0 en AR)

  Sinking Fund mensual:
     si i > 0:  d = (C0 − CL) · i / ((1+i)^L − 1)
     si i = 0:  d = (C0 − CL) / L

  Maintenance mensual:
     m = Valor_actual × (%mant_anual / 12)

  Total mensual a reservar por el bien = d + m
     (desglosado y etiquetado por tipo de fondo)
```

---

## 6. Disclaimers obligatorios en la app

- La app **no es asesoramiento financiero**; ofrece estimaciones basadas en teoría
  general y defaults editables.
- Los defaults son promedios estadísticos; la realidad de cada bien varía.
- Las cifras de inflación/dólar son volátiles: la app debe permitir actualizarlas.

---

## 8. Rentabilidad de inversiones — TWR vs. MWR

> Documentado en preparación de Sesión J (Inversiones). Implementación pendiente.

### 8.1 Qué mide cada métrica

**Time-Weighted Return (TWR) — Retorno ponderado por tiempo:**
Mide la performance del activo aislada de los aportes y retiros del inversor. Si el
inversor hizo depósitos grandes cuando el mercado estaba caro y retiró cuando estaba
barato, el TWR no se ve afectado: solo refleja cuánto rindió la inversión por sí misma.

→ Estándar de la industria para comparar fondos y activos, porque elimina el efecto del
timing de las decisiones del inversor.

**Money-Weighted Return (MWR):**
Equivalente a la TIR (Tasa Interna de Retorno) del flujo de fondos. Refleja el rendimiento
real que el inversor obtuvo sobre su dinero, incluyendo el impacto del timing y tamaño de
sus aportes y retiros.

→ MWR responde "¿cuánto gané yo?"; TWR responde "¿qué tan buena es esta inversión?".

**En esta app usamos TWR** para mostrar performance de activos, porque el objetivo es
evaluar la inversión, no el comportamiento del inversor.

### 8.2 Fórmula — encadenamiento geométrico de sub-períodos

**Fuente:** GIPS® (Global Investment Performance Standards), CFA Institute, edición 2020.
*(Pendiente de verificación de sección y página específica en el documento primario.)*

El TWR divide el período total en sub-períodos delimitados por flujos de caja (aportes o
retiros). El retorno de cada sub-período se calcula antes de que el flujo afecte el
portfolio, y luego se encadenan geométricamente.

**Retorno de cada sub-período i:**
```
Ri = (VMF_i − VMI_i) / VMI_i
```
Donde:
- `VMI_i` = valor de mercado al inicio del sub-período (o inmediatamente después del flujo anterior)
- `VMF_i` = valor de mercado al final del sub-período (inmediatamente ANTES del próximo flujo)

**TWR total:**
```
TWR = [(1 + R1) × (1 + R2) × ... × (1 + Rn)] − 1
```

**Ejemplo:**
1. Compra 10 acciones a $100 → portfolio = $1.000
2. Al cierre del sub-período 1: precio = $110 → portfolio = $1.100 → R1 = 10%
3. Nuevo aporte: compra 5 acciones a $110 → portfolio = $1.650
4. Al cierre del sub-período 2: precio = $99 → portfolio = $1.485 → R2 = −10%
5. TWR = (1,10 × 0,90) − 1 = **−1%** (la inversión perdió 1% en el período total)

### 8.3 Nota metodológica — aplicación en esta app

En esta app, los precios se actualizan manualmente. Por lo tanto:

- Cada evento de flujo (aporte, retiro, compra de nuevas unidades) delimita un sub-período nuevo.
- El precio del sub-período se toma del `price` vigente en el holding al momento del flujo
  (el último precio registrado manualmente por el usuario).
- Si no hubo flujos entre dos actualizaciones de precio, el sub-período abarca el intervalo
  completo entre ambas actualizaciones.
- El TWR se recalcula cada vez que el usuario actualiza el precio o registra un nuevo flujo.

### 8.4 Pendientes antes de implementar (Sesión J)

- **Feed de precios:** investigar si existe feed gratuito y confiable para acciones de BYMA
  y CEDEARs argentinos. **PENDIENTE DE DECISIÓN HUMANA:** si no existe en tiempo real
  gratuito, elegir entre cotización con retraso (gratis) o romper la restricción de costo
  cero. No decidir esto sin el usuario.
- **Precio promedio derivado:** `precio_promedio = monto_total_invertido / cantidad` en vez
  de campo obligatorio en el formulario.
- **Rediseño de formulario:** mover Precio antes de Cantidad para evitar la ambigüedad que
  generó la posición AAPL incorrecta (ver `docs/lecciones-aprendidas.md §6`).

### 8.5 Retorno simple desde histórico propio — insumo de datos para TWR (Sesión J.1.7)

> Implementado en `src/lib/finance/holdingReturn.ts`. Es un paso intermedio hacia el
> TWR completo de §8.2, no un reemplazo.

Antes de Sesión J.1.7 la app no guardaba serie temporal de precios — solo pisaba
`holdings.current_price`. La migración 022 agrega `holding_price_history` (aditiva,
no reemplaza `current_price`), poblada automáticamente cada vez que `autoSyncFciHoldings`
sincroniza un precio nuevo desde el feed de ArgentinaDatos, usando la fecha REAL de
cotización del feed (campo `fecha`), no la fecha en que corrió el sync.

Con esa serie temporal ya se puede calcular un **retorno simple punto-a-punto** (no TWR
todavía, porque TWR requiere encadenar sub-períodos delimitados por flujos de aportes/
retiros — ver §8.2 — y esos flujos todavía no se registran en ninguna tabla):

```
retorno_N_dias = (precio_hoy − precio_hace_N_dias) / precio_hace_N_dias
```

Donde `precio_hace_N_dias` es el precio **más antiguo disponible dentro de la ventana**
de N días (default 30), no necesariamente el de hace exactamente N días — los datos
solo existen para las fechas en que corrió un sync real.

**Regla dura:** si no hay al menos dos puntos de precio, o el punto más antiguo cae
fuera de la ventana de N días (holding recién vinculado, feed sin historial suficiente
todavía), la función devuelve `null` explícitamente. Nunca estima ni interpola un
número — es preferible no mostrar rendimiento a mostrar uno inventado.

**Camino hacia TWR real (Sesión J.2):** cuando exista una tabla de eventos de flujo del
holding (`holding_events`, ver `docs/diseno-fondos-rendimiento.md` TAREA 3), el mismo
histórico de precios sirve para calcular `VMI_i`/`VMF_i` de cada sub-período delimitado
por esos flujos, y el retorno simple de esta sección queda subsumido por el
encadenamiento geométrico de §8.2.

---

## 7. Bibliografía / fuentes a citar en la app

1. IASB — IAS 16 Property, Plant and Equipment (vida útil, valor residual, depreciación).
2. NPTEL — Module 3: Depreciation, Inflation and Taxes (Sinking Fund Method).
3. Cao et al. (2025) — Journal of Money, Credit and Banking (tasa depreciación durables).
4. US Bureau of Economic Analysis — Fixed Assets & Consumer Durable Goods tables.
5. OCU — Encuesta de durabilidad de electrodomésticos (vida útil por categoría).
6. INDEC — Índices de precios e inflación Argentina.
7. IAE Business School — Informes económicos mensuales (contexto macro AR).
8. Regla del 1% — consenso real estate (home maintenance reserve).
9. ACARA (Asociación de Concesionarios de Automotores) vía LA NACION — evolución de precios de venta de modelos en Argentina.
10. Kavak Argentina — informes de variación de precios de usados en dólares (2025-2026).
11. Cámara del Comercio Automotor (CCA) — rotación y comportamiento por segmento.
12. Autozoom, comparaencasa — rankings de retención de valor por marca/modelo (AR, 2025-2026).
