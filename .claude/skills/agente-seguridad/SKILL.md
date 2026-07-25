---
description: Checklist de seguridad para sesiones que tocan base de datos, endpoints, autenticación o secrets. Invocar al crear tablas, RPCs, Server Actions, o scripts que usen credenciales.
---

## Rol

Revisión de seguridad antes de que cualquier cambio relacionado con datos llegue al repo.

## Checklist

### Base de datos
- [ ] **RLS activo** en toda tabla nueva. Toda tabla nueva requiere:
  ```sql
  ALTER TABLE nombre ENABLE ROW LEVEL SECURITY;
  -- Más políticas que filtren por auth.uid()
  ```
- [ ] **Toda operación que mueve dinero es una RPC atómica** (PL/pgSQL en Supabase, no
  updates sueltos desde el cliente JS). Ejemplos existentes: `create_expense_with_balance`,
  `pay_installment`, `execute_account_transfer`.
- [ ] **`SECURITY INVOKER`** en todas las RPCs nuevas (para que RLS aplique normalmente).
  Usar `SECURITY DEFINER` solo con razón documentada y explícita.

### Secrets y credenciales
- [ ] **Ninguna clave de servicio expuesta al cliente.** Solo `NEXT_PUBLIC_SUPABASE_URL` y
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` pueden ir al browser — son las únicas que también se
  usan en scripts de QA.
- [ ] **Secrets solo en variables de entorno.** Nunca hardcodear en código, scripts, ni en
  archivos dentro del repo. Siempre leer de `.env.local`.
  > **Lección aprendida:** en una sesión anterior se hardcodearon URL y anon key de Supabase
  > dentro de un script de QA. Ver `docs/lecciones-aprendidas.md §5`.
- [ ] `test-credentials.txt` en `.gitignore`. Verificar con `git status` antes de cada commit.

### Validación de input
- [ ] **Todo input externo validado y sanitizado:** formularios del usuario, webhook de
  WhatsApp, texto extraído por OCR.
- [ ] El futuro bot de WhatsApp recibe texto no confiable (puede contener inyección). Parsear
  con reglas estrictas, no evaluar ni ejecutar.

### Server Actions y endpoints
- [ ] **Verificar autenticación** antes de cualquier operación en Server Actions:
  `createClient()` + `supabase.auth.getUser()` + verificar que `user` no sea null.
- [ ] **Sin `service_role` key** en código del cliente o Server Components accesibles
  sin autenticación.

## Cuándo invocar

- Al crear o modificar tablas de Supabase (migrations).
- Al escribir o modificar RPCs o Server Actions.
- Al crear scripts de QA o cualquier script que use credenciales.
- Al implementar endpoints de API (webhook WhatsApp, OCR).
- Antes del commit si la sesión tocó cualquiera de los puntos anteriores.
