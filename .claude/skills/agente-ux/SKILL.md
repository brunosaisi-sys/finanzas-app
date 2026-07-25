---
description: Revisión de UX y diseño para sesiones que tocan pantallas o componentes. Invocar al crear o modificar formularios, páginas, o componentes visuales.
---

## Rol

Asegurar que la app se vea y se sienta profesional en un iPhone, sin el aspecto genérico
de una interfaz autogenerada.

## Checklist

### Sistema de diseño (consistencia con lo existente)
- [ ] **Tipografía:** `text-sm font-medium text-gray-700` para labels; `text-lg font-semibold`
  para montos; `text-xs text-gray-400` para hints.
- [ ] **Espaciado:** `space-y-4` entre secciones de formulario; `mb-1` entre label e input;
  `gap-2` entre elementos inline.
- [ ] **Bordes:** `rounded-lg` para inputs/selects; `rounded-xl` para botones principales;
  `rounded-2xl` para cards de contenido.
- [ ] **Jerarquía visual:** el monto o dato principal debe ser el elemento más prominente
  de cada card o formulario.

### Mobile-first (pantalla de iPhone)
- [ ] **Touch targets ≥ 44px de alto** en todos los botones e inputs.
- [ ] **Sin overflow horizontal** — ningún elemento causa scroll horizontal.
- [ ] **Bottom navigation** no tapa contenido al final de la página. Verificar `pb-24`
  o equivalente en páginas con contenido largo.
- [ ] **Formularios largos:** secciones colapsables si el scroll es excesivo.

### Estados de carga y error
- [ ] **Loading state:** botón muestra "Guardando..." y queda `disabled` mientras procesa.
- [ ] **Error state:** mensaje en `text-red-600 bg-red-50 rounded-lg px-3 py-2`, dentro
  del formulario (no solo en consola).
- [ ] **Empty state:** si una lista puede estar vacía, mostrar estado vacío claro con
  acción disponible.

### Accesibilidad básica
- [ ] Cada `<input>` tiene su `<label>` asociado (o `aria-label`).
- [ ] Contraste suficiente entre texto y fondo (no usar `text-gray-300` sobre blanco).
- [ ] Botones destructivos (Eliminar) diferenciados visualmente del botón primario.

### Formularios
- [ ] El orden de campos sigue el flujo mental del usuario.
  > **Lección aprendida:** en el formulario de nueva inversión, Cantidad va antes que Precio,
  > lo que llevó a valores invertidos. Ver `docs/lecciones-aprendidas.md §6`.
- [ ] El campo más importante tiene foco automático al cargar.
- [ ] Campos opcionales marcados con `(opcional)`.

## Cuándo invocar

- Al crear una pantalla nueva.
- Al modificar un formulario existente (agregar campos, cambiar orden).
- Al revisar un componente que el usuario reportó como confuso.
- En la sesión de rediseño visual completo (backlog, después de Sesión M).

## Nota sobre skills oficiales

No existe un skill bundled de Claude Code específico para UX de aplicaciones móviles.
El skill `simplify` (bundled) puede invocarse para revisar estructura de componentes y
código duplicado, pero no cubre criterios de UX. Este skill es la fuente de verdad de
UX para el proyecto.
