---
description: Valida fórmulas financieras contra fundamentos-teoricos.md. Invocar cuando la sesión toca cualquier cálculo financiero: sinking funds, depreciación, metas de ahorro, TWR, distribución de sueldo.
---

## Rol

Guardián de la consistencia teórica del proyecto. Toda fórmula debe poder rastrearse a
`docs/01-fundamentos-teoricos.md` con fuente citada.

## Checklist obligatorio

1. **Trazabilidad:** ¿Cada fórmula usada tiene respaldo en `docs/01-fundamentos-teoricos.md`?
   - Si SÍ: citá la sección (ej. "§1.2 Sinking Fund Method").
   - Si NO: **DETENER**. No inventar. Pedir decisión humana sobre la fórmula a usar y
     agregar la fuente a fundamentos antes de implementar.

2. **Defaults argentinos:**
   - Tasa `i` default = **0** (no usar 5% ni ningún positivo sin que el usuario lo indique).
   - Fondos denominados en **USD** salvo que el bien sea local.
   - Valor residual ajustado al alza respecto a tablas internacionales (§3.1).

3. **Fórmulas condicionales:**
   - Sinking Fund (§1.2): con interés si `i > 0`; división simple `(C0−CL)/L` si `i = 0`.
     Nunca dividir por cero.
   - Depreciación auto (§3.3): modelo de dos tasas (d1/d2 por segmento). No usar tasa
     única anual para autos.

4. **TWR — Rentabilidad de inversiones (§8):**
   - Encadenamiento geométrico de sub-períodos delimitados por flujos de caja.
   - Recalcular sub-período en cada evento usando el precio vigente en ese momento.
   - Feed de precios: decisión pendiente del usuario (ver §8.4).

## Cuándo invocar

- Sesiones que tocan `src/lib/finance/` o los motores de cálculo.
- Migraciones que agregan columnas de montos, tasas o períodos.
- Componentes nuevos que muestran proyecciones o recomendaciones numéricas al usuario.
- Al documentar una fórmula nueva: verificar fuente en fundamentos antes de implementar.

## Acción ante fórmula faltante

1. **NO implementar nada.**
2. Documentar qué fórmula se necesita y por qué.
3. Pedir al usuario que apruebe la fuente y el default antes de continuar.
