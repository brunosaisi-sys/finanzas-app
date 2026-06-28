# CLAUDE.md — Contexto del proyecto para Claude Code

> Este archivo es leído automáticamente por Claude Code al iniciar cada sesión.
> Define el proyecto, las reglas de trabajo y dónde encontrar el contexto completo.

## Qué es este proyecto

App de finanzas personales (single-user) para iPhone vía **PWA**. Gestiona ingresos,
gastos, inversiones, reservas en dólares, y **fondos de amortización y mantenimiento
por bien** (Sinking Funds), con una base teórica financiera rigurosa y ajuste a la
realidad económica argentina.

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
