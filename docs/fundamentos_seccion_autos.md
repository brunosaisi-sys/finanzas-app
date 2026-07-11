## Adición a docs/01-fundamentos-teoricos.md — Sección nueva a insertar en NIVEL 3 (ajuste por país)

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
- Costo de reposición C0 = precio de un equivalente hoy. Si el usuario quiere reemplazarlo
  por algo similar, C0 ≈ valor actual de un auto equivalente ≈ USD 12.000-13.000.

**Cálculo del sinking fund con este modelo (caso usuario):**
```
C0 = 13.000 (reposición: auto equivalente hoy)
CL = 9.083   (lo que vale SU auto en 24 meses, calculado con d2)
L  = 24 meses
d  = (13.000 − 9.083) / 24 = 3.917 / 24 = USD 163/mes
```

Comparar con el modelo viejo (residual fijo 35%): daba USD 352/mes — sobreestimaba la
depreciación en más del doble. El modelo de dos tasas da un resultado realista para AR.

**Nota sobre inflación en USD y dólar:** este modelo trabaja en dólares constantes. El
mercado argentino de usados en USD es relativamente estable por la escasez estructural de
oferta. La app no proyecta apreciación del auto (sería especulativo); asume depreciación
suave d2. El usuario puede editar CL si conoce mejor su caso.
