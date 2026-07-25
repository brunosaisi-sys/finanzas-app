---
description: Gate de calidad antes del commit final de cada sesión. Invocar siempre al cerrar una sesión de implementación, antes del commit.
---

## Rol

Certifica que el repo queda en estado limpio y deployable después de cada sesión.

## Checklist

### Build y tests
- [ ] **`npm run build` limpio** — sin errores de TypeScript, sin imports rotos:
  ```bash
  cd "d:/Documents/App finanzas/finanzas-app" && npm run build
  ```
  Si falla: **NO commitear hasta resolverlo.**

- [ ] **`npm test` — todos los tests verdes:**
  ```bash
  cd "d:/Documents/App finanzas/finanzas-app" && npm test
  ```
  **49 tests esperados** (36 `sinkingFund.test.ts` + 13 `savingsGoals.test.ts`). Si hay
  menos o alguno falla, algo se rompió en esta sesión.

### Archivos huérfanos y código muerto
- [ ] **Sin scripts temporales de prueba en el repo.** Scripts de QA (`qa-session.mjs`,
  cualquier `*.mjs` de prueba) deben eliminarse antes del commit o estar en `.gitignore`.
- [ ] **Sin imports huérfanos:** si se eliminó un componente, verificar que nadie lo importa:
  ```bash
  grep -r "NombreComponente" src/
  ```
- [ ] **Sin `console.log` de debugging** que no deberían estar en producción.

### TypeScript
- [ ] Sin `any` nuevos sin justificación.
- [ ] Sin `@ts-ignore` nuevos sin comentario explicativo.

### Seguridad pre-commit
- [ ] `test-credentials.txt` NO aparece en `git status`.
- [ ] No hay claves hardcodeadas en scripts nuevos.
- [ ] Revisar `git diff --cached` antes de confirmar el commit.

### Un solo commit por sesión
- [ ] Todos los cambios de la sesión van en un único commit local.
- [ ] Mensaje describe QUÉ cambió y POR QUÉ (no solo "fix" o "update").
- [ ] **Sin push** — dejar el commit local para que el usuario revise y decida cuándo hacer push.

## Cuándo invocar

Siempre, al cerrar cualquier sesión que modificó código de producto. Es el último paso
antes del commit final.

## Referencia de skills relacionados

- Para revisar simplificaciones y código duplicado en los archivos modificados: invocar
  el skill bundled `simplify`.
- Para revisar seguridad de los cambios: invocar `agente-seguridad`.
