# Especificación de Arquitectura — App de Finanzas Personales

## 1. Objetivo del producto

App personal (single-user) para gestión integral de finanzas:
- Distribución de ingresos (inversión, ahorro USD, objetivos, amortizaciones)
- Fondos de amortización (Sinking Funds) y mantenimiento por bien
- Registro y categorización de gastos
- Resúmenes: dónde está invertida la plata, cuánto rinde, reservas en USD, gastos
- Carga de gastos vía: (a) app, (b) bot de WhatsApp (texto), (c) imagen/PDF con OCR local

## 2. Decisiones de arquitectura (y por qué)

### 2.1 Plataforma: PWA, no app nativa

**Decisión:** Progressive Web App instalable en iPhone.

**Por qué:** Una app nativa de iOS requiere (a) una Mac para compilar y (b) cuenta de
Apple Developer de US$99/año para publicar en la App Store. Eso rompe el requisito de
costo cero. Una PWA:
- Se instala en la pantalla de inicio del iPhone ("Agregar a inicio") como un ícono.
- Funciona offline (service worker + cache).
- Tiene acceso a cámara para sacar fotos de tickets.
- Es 100% gratis, sin App Store.

**Limitaciones aceptadas:** las PWA en iOS tienen restricciones (push notifications
limitadas, sin acceso a algunas APIs nativas). Para este caso de uso no son bloqueantes.

### 2.2 Stack

| Capa | Tecnología | Free tier | Notas |
|---|---|---|---|
| Frontend | Next.js 14+ (App Router) | Sí | Mismo stack que NuraGest |
| UI | React + Tailwind CSS | Sí | |
| PWA | next-pwa / Serwist | Sí | Service worker, manifest, offline |
| Backend/DB | Supabase (PostgreSQL + RLS) | Sí (500MB) | Auth incluido |
| Hosting | Vercel | Sí (Hobby) | Deploy desde Git |
| OCR | Tesseract.js | Sí (local) | Corre en el navegador, sin API |
| Bot WhatsApp | WhatsApp Cloud API + webhook en Vercel | Sí* | *Mensajes self-initiated gratis |
| Charts | Recharts | Sí | |

### 2.3 OCR local (sin costo de API de visión)

**Decisión:** Tesseract.js en el cliente.

**Por qué:** Cumple el requisito "100% gratis aunque menos preciso". Tesseract.js corre
enteramente en el navegador (WASM), no envía datos a ningún servicio pago.

**Estrategia de mitigación de precisión:**
- Pre-procesar la imagen (escala de grises, aumento de contraste, binarización) antes
  del OCR para mejorar resultados.
- Parsear el texto OCR con heurísticas/regex para detectar monto, fecha y comercio.
- SIEMPRE mostrar al usuario lo detectado para que confirme/corrija antes de guardar
  (nunca auto-guardar un gasto leído por OCR sin confirmación).
- Para tickets argentinos: detectar patrones de "TOTAL", "$", CUIT, fecha dd/mm/aaaa.

### 2.4 Bot de WhatsApp (gratis para uso personal)

**Decisión:** WhatsApp Cloud API directa de Meta (sin BSP) + webhook serverless en Vercel.

**Por qué es gratis en este caso:** las conversaciones de servicio iniciadas por el
usuario son gratis e ilimitadas. Como el usuario es el único y siempre inicia la
conversación, no hay costo de mensajería de Meta. Aplicar a la Cloud API no cuesta.

**Flujo:**
```
Usuario escribe a WhatsApp → Meta Cloud API → webhook (Vercel function)
   → parsea mensaje (texto: monto + banco/efectivo)
   → si hay imagen/PDF: descarga media → OCR (server-side Tesseract o reenvía a la PWA)
   → inserta gasto en Supabase
   → responde confirmación al usuario por WhatsApp
```

**Nota de costo oculto:** el webhook necesita estar disponible 24/7. Vercel Hobby cubre
esto con serverless functions (sin servidor always-on). El OCR de imágenes que llegan
por WhatsApp puede hacerse server-side; vigilar límites de tiempo de ejecución de las
funciones serverless (puede requerir procesar async).

## 3. Modelo de datos (Supabase / PostgreSQL)

```sql
-- Usuario (gestionado por Supabase Auth)

-- Cuentas / fuentes de dinero
accounts (
  id, user_id, name, type,         -- type: banco | efectivo | inversion | usd_reserva
  currency,                        -- ARS | USD
  balance, expected_return_annual, -- rendimiento esperado (para inversiones)
  created_at
)

-- Categorías de gasto
categories ( id, user_id, name, icon, parent_id )

-- Gastos
expenses (
  id, user_id, account_id, category_id,
  amount, currency, description, merchant,
  date, source,                    -- source: app | whatsapp | ocr
  raw_ocr_text,                    -- texto crudo si vino de OCR (para auditar)
  created_at
)

-- Ingresos
incomes ( id, user_id, account_id, amount, currency, source, date, recurring )

-- Bienes (assets) — para Sinking Funds y mantenimiento
assets (
  id, user_id, name, category,     -- mapea a tabla de defaults
  purchase_price, purchase_date, currency,
  useful_life_months,              -- override del default
  residual_pct,                    -- override del default
  maintenance_pct_annual,          -- override del default
  replacement_horizon_months,      -- cuándo el usuario quiere cambiarlo
  interest_rate_monthly,           -- i del fondo (default 0)
  created_at
)

-- Fondos (Sinking, Maintenance, Goal, Emergency)
funds (
  id, user_id, type,               -- sinking | maintenance | goal | emergency
  asset_id,                        -- null si no está ligado a un bien
  name, target_amount, current_amount, currency,
  monthly_contribution,            -- calculado
  target_date
)

-- Movimientos de fondos
fund_transactions ( id, fund_id, amount, type, date, note )
```

**Seguridad:** Row Level Security (RLS) en todas las tablas — cada usuario solo accede
a sus filas. Esto es no-negociable (ver agente de seguridad).

## 4. Pantallas / módulos de la app

1. **Dashboard** — resumen general: patrimonio, distribución, próximos aportes.
2. **Gastos** — lista, carga manual, carga por foto (OCR), filtros por categoría/fecha.
3. **Análisis de gastos** — dónde gasto más, tendencias, comparativo mensual.
4. **Inversiones** — dónde está la plata, cuánto rinde cada cuenta, total en USD.
5. **Reservas USD** — cuánto tengo ahorrado en dólares y para qué.
6. **Bienes & Fondos** — lista de bienes, su Sinking Fund y Maintenance, aportes.
7. **Objetivos** — savings goals con monto y fecha.
8. **Configuración** — moneda, inflación, defaults por categoría, conexión WhatsApp.

## 5. Roadmap de implementación (fases)

- **Fase 1 (MVP):** Auth + carga manual de gastos/ingresos + dashboard básico + categorías.
- **Fase 2:** Bienes + motor de cálculo de Sinking/Maintenance funds + reservas USD.
- **Fase 3:** Análisis de gastos + inversiones con rendimiento.
- **Fase 4:** OCR local de tickets.
- **Fase 5:** Bot de WhatsApp (texto, luego imagen).
- **Fase 6:** PWA polish (offline, instalable, ícono) + pruebas de los 4 agentes.

## 6. Restricciones de costo cero (checklist)

- [ ] Supabase free tier (500MB DB, 50k MAU auth) — suficiente para 1 usuario.
- [ ] Vercel Hobby — deploy + serverless functions gratis.
- [ ] Tesseract.js — OCR sin API paga.
- [ ] WhatsApp Cloud API — solo mensajes self-initiated (gratis).
- [ ] Sin Apple Developer account (PWA, no nativa).
- [ ] Sin servicio de visión pago (Gemini/Claude Vision NO se usan en runtime).
