# Lecciones aprendidas

> Registro de errores y sorpresas para no repetirlos.
> Formato: qué pasó → por qué → qué hacer la próxima vez.

---

## 1. PowerShell vs. Bash — herramientas incompatibles

**Qué pasó:** `Start-Process -FilePath "npx"` falló en PowerShell al intentar levantar el
dev server en background, porque `npx` es un archivo `.cmd`, no un ejecutable nativo.

**Por qué:** PowerShell no resuelve `.cmd` automáticamente con `Start-Process`. Necesita
`cmd.exe` como intermediario.

**Qué hacer:** Para levantar el dev server en background, usar la herramienta `Bash`:
```bash
cd "d:/Documents/App finanzas/finanzas-app" && npm run dev > /tmp/nextdev.log 2>&1 &
```
Elegir una sola herramienta por tarea y ser consistente. Comandos de PowerShell
(`New-Item`, `Copy-Item`, `Remove-Item`) no funcionan en Bash y viceversa.

---

## 2. Scripts de QA — resolución de módulos

**Qué pasó:** Script `qa-session.mjs` falló con `ERR_MODULE_NOT_FOUND` para `@playwright/test`
al ejecutarse desde el directorio scratchpad temporal.

**Por qué:** Node.js con ESM resuelve módulos desde el directorio de trabajo. `@playwright/test`
está instalado en `finanzas-app/node_modules/`, no en el scratchpad.

**Qué hacer:** Siempre ejecutar scripts de QA desde el directorio `finanzas-app/`. Copiar
el script ahí temporalmente si es necesario, y eliminarlo después del commit.

---

## 3. Acentos en Playwright — selectores de texto

**Qué pasó:** `page.locator("button[type='button']").filter({ hasText: /^Credito$/ })`
agotó su timeout sin encontrar el botón "Crédito".

**Por qué:** La regex `/^Credito$/` no matchea "Crédito" porque `é` (U+00E9) ≠ `e`.
Playwright es exacto con caracteres Unicode.

**Qué hacer:** Iterar sobre los botones y comparar `textContent()` con regex que tolere el acento:
```javascript
var btns = page.locator("button[type='button']");
for (var i = 0; i < await btns.count(); i++) {
  if (/cr.dito/i.test(await btns.nth(i).textContent())) {
    await btns.nth(i).click(); break;
  }
}
```

---

## 4. Redirects intencionales — no declarar bug sin verificar

**Qué pasó:** El script reportó como bug que `/nuevo-gasto` no redirigía a `/gastos`
después de guardar.

**Por qué:** `/nuevo-gasto` redirige intencionalmente a `/` (Dashboard). Es la ruta de
acción rápida para iOS Shortcuts, y llevar al usuario al Dashboard es el comportamiento
correcto.

**Qué hacer:** Antes de declarar que "no redirigió", verificar en el código cuál es el
`redirectTo` esperado. Los redirects intencionales están documentados en CLAUDE.md
(sección "QA — Selectores correctos").

---

## 5. Hardcodeo de credenciales en scripts — prohibido

**Qué pasó:** Se hardcodearon la URL y la anon key de Supabase directamente dentro de
un script de QA temporal.

**Por qué:** Era más rápido que leer `.env.local`. El script fue eliminado sin commitear,
pero el riesgo de exponerlo era real.

**Qué hacer:** Nunca hardcodear credenciales. Leerlas siempre de `.env.local`:
```javascript
import { readFileSync } from "fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").trim().split("\n")
    .filter(l => l.includes("="))
    .map(l => l.split("="))
);
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
```

---

## 6. Formulario de inversiones — orden de campos contraintuitivo

**Qué pasó:** Se creó una posición AAPL con 150 unidades @ PA $10 cuando la intención era
10 unidades @ $150. Los valores se invirtieron al completar los campos.

**Por qué:** El formulario muestra Cantidad antes que Precio Promedio, lo opuesto al orden
mental habitual ("tengo X acciones a $Y"). El script (o el usuario) completó en el orden
mental, no en el orden del formulario.

**Qué hacer:** Al usar `/inversiones/nueva`, recordar: primero Cantidad, luego Precio.
En Sesión J, rediseñar el orden a Precio → Cantidad. La posición AAPL incorrecta queda
como fixture roto hasta que exista UI de eliminación en `/inversiones`.

---

## 7. Falso positivo de timing — badge en páginas con fetch remoto

**Qué pasó:** El script reportó "Badge Objetivo ausente" en `/objetivos` después de crear
un objetivo exitosamente.

**Por qué:** La página usa Server Components con fetch a Supabase free tier, que puede
tardar >20s al despertar del plan dormido. El `loading.tsx` es un skeleton puro sin texto,
así que `page.content()` durante la carga no contenía el badge. El objetivo SÍ se creó
(confirmado porque el cleanup lo archivó exitosamente).

**Qué hacer:** Al verificar texto en páginas con fetch remoto: esperar que la URL esté
estabilizada Y agregar un `waitForTimeout` adicional (≥1-2 segundos) antes de `page.content()`.
Confirmar que el dato se creó vía API antes de declarar el badge como bug.

---

## 8. Cuentas padre (contenedores) — sin botón Eliminar propio

**Qué pasó:** En el script de QA de Sesión G, el cleanup de "Multi Test QA" falló porque
la cuenta tenía bolsillos hijos y el contenedor padre no tenía botón "Eliminar" propio en la UI.

**Por qué:** En `/cuentas`, los contenedores padres se renderizan como un header sin
`CuentaActions`. Para eliminar un contenedor, primero hay que borrar todos sus hijos
(o el DELETE de postgres falla por FK violation).

**Qué hacer en scripts de QA:** Al borrar cuentas con bolsillos, borrar hijos primero
vía supabase client, luego el padre. Ver `qa-cleanup.mjs` como patrón.
En la UI: la Sesión G corrigió esto — los contenedores padre ahora tienen `CuentaActions`
con Editar y Eliminar. Eliminar devuelve error FK si aún tiene hijos, lo que es la
restricción correcta.

---

## 9. Migración sin service_role key — ejecución manual en Supabase

**Qué pasó:** La migración 014 (`convert_account_to_parent`) no pudo ejecutarse
programáticamente porque solo está disponible la `anon_key` en `.env.local`.

**Por qué:** DDL (CREATE FUNCTION) requiere el rol `postgres` o la `service_role_key`.
La `anon_key` solo puede ejecutar queries con RLS. El Supabase CLI tampoco estaba
autenticado (sin access token).

**Qué hacer:** Ejecutar el SQL directamente en el SQL Editor del dashboard de Supabase.
El archivo está en `supabase/migrations/014_convert_account_to_parent.sql`.
Pendiente de ejecución antes de habilitar el botón "+ bolsillo" en cuentas existentes.

---

## 10. Playwright — `.text-red-600` captura botones además de mensajes de error

**Qué pasó:** `getDeleteError()` usaba `page.locator('.text-red-600').allTextContents()` y
retornaba el texto del botón "Confirmar eliminar 'X'" en lugar del mensaje de error, porque
ese botón también tiene la clase `text-red-600` (`text-[11px] font-medium text-red-600`).

**Por qué:** En CuentaActions modo delete, el botón de confirmación y el párrafo de error
comparten la clase Tailwind `text-red-600`. El selector `.text-red-600` los devuelve a ambos.

**Qué hacer:** Usar `p.text-red-600` (etiqueta HTML `<p>`) para capturar solo el párrafo
de error, que nunca es un `<button>`. Adicionalmente, usar `page.waitForSelector('p.text-red-600')`
antes del chequeo para garantizar que el servidor action terminó.

---

## 11. CuentasTree — expandedIds no se actualiza con cuentas nuevas tras router.refresh()

**Qué pasó:** En T2d, "Viaje Europa" se creaba correctamente en la DB (confirmado por BFS
count=3 en T5) pero `waitForText("Viaje Europa")` retornaba false. Dólares, recién convertido
a contenedor, aparecía colapsado en el UI.

**Por qué:** `useState(() => new Set(accounts.map(a => a.id)))` inicializa el set una sola vez
al montar CuentasTree. `router.refresh()` actualiza las props con nuevas cuentas, pero React
no re-ejecuta el inicializador del `useState`. Las cuentas nuevas (e.g., Dólares cuando se
convierte a contenedor, Viaje Europa recién creada) no están en `expandedIds`, por lo que
Dólares renderiza colapsado.

**Qué hacer:** Agregar un `useEffect` en CuentasTree que, cuando cambian las props `accounts`,
añada los IDs nuevos a `expandedIds` sin quitar los existentes (preserva el estado collapse/expand
del usuario):
```typescript
useEffect(() => {
  setExpandedIds(prev => {
    let changed = false;
    const next = new Set(prev);
    for (const a of accounts) {
      if (!next.has(a.id)) { next.add(a.id); changed = true; }
    }
    return changed ? next : prev;
  });
}, [accounts]);
```

---

## 13. delete_expense_with_balance — residuo de $0.01 con cuotas fraccionadas

**Qué pasó:** Después de crear un gasto de $1000 en 3 cuotas con cobertura y luego eliminarlo vía RPC `delete_expense_with_balance`, la cuenta de cobertura quedó en $252500.01 en vez de $252500.00.

**Por qué:** El RPC crea 3 cuotas de $333.33 + $333.33 + $333.34 = $1000.00 (redondeado). Al revertir, puede acumular error de punto flotante en la suma parcial de cuotas que se descuenta de la cuenta cubriente.

**Qué hacer:** En producción este RPC solo se usa en eliminación de gastos, no en el flujo normal de pagos. El residuo de $0.01 es tolerable en el contexto de testing. Si se vuelve un problema en producción, investigar si el RPC usa `SUM` exacta vs iteración de cuotas al revertir el earmark. No bloquea el flujo de negocio normal (crear/confirmar earmark funciona perfectamente con montos enteros).

---

## 12. Playwright — router.refresh() completa antes que DOM refleje la eliminación

**Qué pasó:** En T5 test 3, `deleteAccount(viajeEuropaId)` eliminaba la cuenta de la DB,
`router.refresh()` completaba, pero `hasText("Viaje Europa")` seguía retornando true.
El cleanup posterior confirmaba que la cuenta SÍ fue eliminada (Dólares se borraba sin error).

**Por qué:** Hay un race entre el final del RSC re-render y el chequeo de `hasText`. React
puede pintar el DOM antiguo un frame más después de que `waitForLoadState("networkidle")`
resuelve. `waitForTimeout(800)` + `waitForLoadState` no siempre es suficiente.

**Qué hacer:** Para verificar que una eliminación funcionó, usar `page.goto(BASE + "/cuentas")`
seguido de `waitForLoadState("networkidle")` antes del chequeo. El reload garantiza que el
DOM refleja el estado real de la DB, sin depender del timing de React.
Alternativa: `page.waitForSelector(':text-is("X")', { state: "detached", timeout: 8000 })`,
pero el goto es más simple y robusto.

---

## 14. Padre+hijos — siempre RPC atómica, nunca inserts sueltos

**Qué pasó:** `handleSubmitFromBankConfig` y `handleSubmitBolsillos` creaban el padre con un
INSERT y los hijos con otro INSERT separado. Si el segundo fallaba, quedaba un padre huérfano
en la DB sin hijos y sin rollback.

**Por qué:** Los inserts sueltos desde el cliente no son atómicos. Cada roundtrip es una
transacción independiente. Si el segundo falla (RLS, CHECK, red), el primero ya committeó.

**Qué hacer:** Siempre usar una RPC PL/pgSQL en una sola función para operaciones que
crean padre + hijos. La función `create_account_with_children` (migración 020) es el patrón
correcto: un `BEGIN` implícito de PL/pgSQL envuelve todos los INSERTs; cualquier error hace
rollback total. Extensible: agregar `closing_day`/`due_day`/`earns_yield` al JSONB del hijo.

---

## 18. PostgREST — HTTP 404 por firma incompatible ≠ función inexistente

**Qué pasó:** Al verificar que los RPCs de earmark existían en Supabase (llamándolos con body `{}`),
PostgREST devolvió HTTP 404 para todos ellos, aunque se había confirmado que funcionaban correctamente durante el mismo test.

**Por qué:** PostgREST resuelve la función PL/pgSQL buscando un overload que coincida con los argumentos provistos. Si la firma no matchea (ej. `{}` cuando la función requiere `p_expense_id UUID`), devuelve HTTP 404 ("Could not find the function...") — el mismo código que si la función no existiera. No lanza 400 ni 422.

**Qué hacer:** Para verificar que un RPC existe, llamarlo con argumentos válidos (aunque incorrectos) y aceptar 400/422 como "existe", rechazar solo 404. O mejor: confirmar su existencia verificando que la app lo usa en el test real (ej. `delete_expense_with_balance` retornó OK durante cleanup → existe ✅). No confiar en llamadas con `{}` como test de existencia.

---

## 19. matchFCIRate — `.some()` en fuzzy match causaba matchear el fondo equivocado

**Qué pasó:** Al confirmar que "Cocos Rendimiento FCI" está en el feed (`rentaMixta`, como
"Cocos Rendimiento - Clase A/B/C/D"), se detectó que la gestora Cocos tiene ~20 fondos
distintos en el feed ("Cocos Ahorro", "Cocos Acciones", "Cocos Dólares Plus", "Cocos Dólar
Money Market", "Cocos Renta Dólar", "Cocos Rendimiento", etc.) repartidos en las 4 categorías.
El fuzzy match de `matchFCIRate` usaba `words.some(w => key.includes(w))`: bastaba con que
UNA palabra del nombre del holding (ej. "cocos") matcheara, así que un holding llamado
"Cocos Rendimiento FCI" podía terminar sincronizado con el VCP de "Cocos Ahorro" u otro fondo
completamente distinto, dependiendo del orden de resolución de las 4 fetches en paralelo.

**Por qué:** `.some()` retorna true con que una sola palabra matchee. Con nombres de gestoras
que tienen muchos fondos ("Cocos X", "Cocos Y", "Cocos Z"), la primera palabra genérica
("cocos") ya es suficiente para un falso positivo — el resultado es no determinístico entre
cargas de página.

**Qué hacer:** Cambiado a `words.every(w => key.includes(w))` en `src/lib/fciRates.ts` —
ahora TODAS las palabras significativas del nombre deben matchear. Sigue habiendo ambigüedad
entre clases del mismo fondo (A/B/C/D, mismo VCP aproximado), pero ya no cruza a un fondo
distinto. Para eliminar la ambigüedad de clase, nombrar el holding con el nombre exacto del
feed incluyendo la clase (ej. "Cocos Rendimiento - Clase A") — así el match exacto
(`rates.has(needle)`) gana sin pasar por el fuzzy match.

---

## 20. Atributo HTML `min` bloquea el submit antes de que corra la validación JS

**Qué pasó:** En `HoldingForm.tsx`, el input de Cantidad tenía `min="0.000001"` y el de
Precio `min="0.01"`. Al escribir "0" y enviar, el navegador bloqueaba el submit con su
propio tooltip de validación nativa (constraint validation) — el `onSubmit` de React
nunca llegaba a ejecutarse, así que el mensaje de error personalizado ("Cantidad inválida")
nunca se mostraba. El usuario veía un bloqueo sin explicación clara del navegador.

**Por qué:** Cuando un `<input type="number">` tiene `min` y el valor no lo cumple, el
formulario HTML5 detiene el submit en el browser antes de disparar el evento `onSubmit`.

**Qué hacer:** Si se quiere mostrar un mensaje de error propio y explicativo (con guía de
qué hacer, no solo "inválido"), no usar `min`/`max` nativos en inputs cuyo submit dispara
lógica de negocio custom — dejar que el JS valide y muestre el mensaje. Se sacó `min` de
Cantidad y Precio en `HoldingForm.tsx`; la validación (`parsedQty <= 0`) sigue existiendo
en JS con mensajes más claros.

---

## 17. ArgentinaDatos FCI — el campo es `vcp`, no `tna`

**Qué pasó:** El tipo `FciFondo` en el código estaba definido como `{ fondo: string; tna: number; fecha: string }` pero la API de ArgentinaDatos retorna `{ fondo, horizonte, fecha, vcp, ccp, patrimonio }`. El campo `tna` NO existe en la respuesta.

**Por qué:** La API cambió de formato (o el código nunca fue correcto). El resultado era que `FciRateCell` mostraba `HoldingPriceEdit` como fallback para todos los FCI (el matching fuzzy retornaba una entrada con `tna: undefined`, y `undefined.toFixed(1)` podría crashear si había match).

**Qué hacer:** Usar `vcp` (Valor de Cuotaparte) para el valor de cada cuotaparte. `tna` ya no existe en el feed. Ver `src/lib/fciRates.ts` para el tipo correcto.

---

## 16. Scripts de QA — token via Supabase Auth API, no cookies del browser

**Qué pasó:** Los scripts de QA intentaban extraer el token de sesión de las cookies del browser tras el login con Playwright. La cookie `sb-<ref>-auth-token` tiene formato `base64-{JSON base64url}` y el parsing falló repetidamente en distintas sesiones.

**Por qué:** El formato de la cookie puede cambiar entre versiones de `@supabase/ssr`. Parsear cookies del browser es frágil y dependiente de la implementación interna de la librería.

**Qué hacer:** Obtener el token directamente del endpoint de Supabase Auth **antes** de abrir el browser, y reutilizarlo para todas las llamadas API del script:
```javascript
const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const { access_token, user } = await res.json();
```
El browser sigue siendo necesario para los tests de UI, pero no para obtener el token de API.

---

## 21. Catálogo de fondos por institución — solo 5 de ~32 instituciones matchean, y "mercado" da falso positivo

**Qué pasó:** Al investigar (Sesión J.1.7, TAREA 2b) qué instituciones del catálogo de la
app (`institutions.ts`) tienen fondos identificables en el feed de ArgentinaDatos, se
bajaron los 4067 fondos de las 4 categorías y se cruzaron contra los ~32 nombres de
`INSTITUTIONS`. Resultado verificado (no asumido): de bancos tradicionales (Galicia,
BBVA, Santander, Nación, Provincia, Macro, ICBC, Patagonia, Supervielle, Comafi,
Hipotecario, Itaú, Brubank, Openbank) y de la mayoría de billeteras/brokers (Ualá,
Personal Pay, Naranja X, Cuenta DNI, MODO, Lemon, Belo, Prex, Ripio, Bitso, Rava, PPI),
**ninguno matchea por nombre**. Solo 5 instituciones sí: **Cocos Capital** (24 fondos,
prefijo "Cocos"), **Balanz** (209 fondos, prefijo "Balanz"), **Bull Market Brokers**
(16 fondos, prefijo "Bull Market"), **InvertirOnline/IOL** (13 fondos, prefijo "IOL"),
**Mercado Pago** (1 fondo: "Mercado Fondo").

Un intento inicial con substring simple `"mercado"` devolvió 69 falsos positivos:
"Multimercado" es un nombre de familia de fondos usado por Consultatio, Delta, Galileo,
Parakeet y Toronto Trust — gestoras sin ninguna relación con Mercado Pago.
`"provincia"` y `"nacion"` también dieron falsos positivos ("Renta Nacional", "MEGAQM
Provincial" — palabras genéricas, no nombres de banco).

**Por qué:** El feed de ArgentinaDatos no expone un campo "gestora"/administradora —
solo el string `fondo`. Un substring en cualquier posición del nombre matchea nombres
de fondo que comparten una palabra común sin relación real con la institución. Además,
bancos tradicionales gestionan sus FCI bajo una marca de sociedad gerente distinta a su
nombre de consumidor (ej. Galicia → "Fima", BBVA → "1822 Raíces" — ambos nombres
aparecen en el feed con patrones consistentes con esa asociación pública, pero no hay
forma de CONFIRMARLO mecánicamente desde este feed sin una fuente adicional que
mapee gestora→banco).

**Qué hacer:** `src/lib/fciCatalog.ts` usa matching por **prefijo** (`nombre.startsWith(keyword)`),
no substring, y solo para las 5 instituciones verificadas (`INSTITUTION_FCI_PREFIXES`).
No se agregaron bancos tradicionales al catálogo automático — es una limitación real,
documentada, no una omisión. Si en el futuro se quiere soportar Galicia/BBVA/etc., hace
falta una fuente externa que confirme la asociación gestora↔banco (o que el usuario la
confirme manualmente) antes de automatizar el match.

---

## 22. "Bug reportado" que ya no reproduce — verificar contra DB real antes de tocar código

**Qué pasó:** El usuario reportó que el selector "Cuenta / Broker" de `/inversiones/nueva`
no listaba bolsillos (ej. "Cocos Capital — Fondos"). Al leer `HoldingForm.tsx`, el código
ya usaba `getLeafAccounts()` + `accountDisplayName()` — el mismo patrón correcto usado en
otros selectores del proyecto. En vez de asumir que el bug ya estaba resuelto (o asumir
que sí existía y tocar código innecesariamente), se reprodujo el escenario exacto en la DB
de test (creó un bolsillo "Fondos" hijo de "Cocos Capital") y se verificó con Playwright:
el selector SÍ lista "Cocos Capital — Fondos" correctamente.

**Por qué:** El código probablemente ya fue corregido en una sesión anterior (el patrón
`getLeafAccounts` se introdujo en Sesión G.2 para el árbol de cuentas) y el usuario no
había vuelto a probarlo, o el bug real ocurrió en un estado de la cuenta que no se pudo
reproducir con la info disponible.

**Qué hacer:** Ante un bug reportado, reproducir contra datos reales (o un fixture que
imite el escenario exacto) ANTES de tocar código. Si no reproduce, decirlo explícitamente
con la evidencia (no "ya debería andar" sin probarlo) en vez de aplicar un fix especulativo
a código que ya es correcto — evita cambios innecesarios y falsa sensación de haber
arreglado algo que nunca estuvo roto.

---

## 23. data912.com — CEDEAR ≠ acción local; GGAL no tiene CEDEAR

**Qué pasó:** Al probar el nuevo selector de CEDEARs (Sesión J.1.8) con el ticker "GGAL"
(Grupo Galicia) como primer caso de prueba, no matcheó nada — un `curl` de verificación
mostró que "GGAL" no aparece en absoluto en `https://data912.com/live/arg_cedears` (944
símbolos totales, ninguno con ese prefijo).

**Por qué:** Un CEDEAR es un certificado que representa una acción que cotiza en el
EXTERIOR (mayormente NYSE/NASDAQ) y no cotiza en BYMA directamente — existe justamente
para que el inversor argentino acceda a esa acción extranjera en pesos. Grupo Galicia es
una empresa argentina que ya cotiza directamente en BYMA (tipo "Acción argentina" en esta
app, no "CEDEAR") — no tiene sentido que exista un CEDEAR de una acción que ya cotiza
localmente. El feed de `arg_cedears` sí tiene, por ejemplo, "AAPL", "KO", "ABEV" (Apple,
Coca-Cola, Ambev — todas extranjeras).

**Qué hacer:** El catálogo de CEDEARs (`cedearCatalog.ts`) solo aplica al `asset_type`
`"cedear"`, nunca a `"accion"` (acción argentina) — son mercados y feeds distintos, y no
hay superposición esperable entre ambos. No hay bug que corregir: el comportamiento
("GGAL no aparece") es correcto. Para pruebas de QA del selector CEDEAR, usar tickers que
sí sean CEDEARs reales (AAPL, KO, MSFT, etc.), nunca acciones locales.

---

## 24. findFciInstitutionForAccountName — matching solo por nombre propio, ignora la jerarquía

**Qué pasó:** El usuario reportó (con captura real) que al editar el bolsillo "Fondos"
(hijo de "Cocos Capital", `earns_yield=true`), en vez del selector de fondos de Cocos
aparecía el mensaje genérico "No tenés posiciones FCI".

**Por qué:** `cuentas/page.tsx` llamaba `findFciInstitutionForAccountName(a.name)` — solo
el nombre propio del bolsillo. Un bolsillo con nombre genérico ("Fondos", "Pesos",
"Dólares") nunca contiene la palabra clave de la institución (ej. "cocos"), aunque su
padre sí la tenga. El matching en sí (`INSTITUTION_ACCOUNT_NAME_HINTS`, `.includes()`)
estaba bien diseñado para recibir un string con el nombre de la institución incluido —
el problema era el input que recibía, no la función de matching.

**Qué hacer:** Pasar `accountDisplayName(a, accounts)` (que ya arma "Institución —
Bolsillo" caminando la cadena de ancestros, `src/lib/accounts.ts`) en vez de `a.name`, en
las dos llamadas de `cuentas/page.tsx`. `findFciInstitutionForAccountName` no necesitó
ningún cambio — confirmado con test unitario (`fciCatalog.test.ts`, caso "Fondos" solo →
`null`, "Cocos Capital — Fondos" → `"cocos"`) en vez de asumir que funcionaría. Investigado
si el mismo patrón (matching por nombre propio, ignorando jerarquía) aparecía en otro
lugar del código: no — es el único punto donde se intenta inferir la institución de una
cuenta EXISTENTE a partir de su nombre; los flujos de alta (`AccountsOnboarding`,
`NuevaCuentaForm`) conocen el `institutionId` de forma explícita, no lo infieren.

---

## 25. PostgREST — dos FKs entre las mismas tablas hacen el embed implícito ambiguo, y el error queda silenciado si no se chequea `error`

**Qué pasó:** El usuario vinculó un bolsillo de Cocos Capital a un holding FCI real (RPC
`create_and_link_fci_holding`, migración 023). El saldo se veía bien en `/cuentas`, pero el
holding NO aparecía en `/inversiones` — mostraba "Sin posiciones cargadas" a pesar de que
la fila existía en `holdings`. Al investigar se descubrió que esto no era un problema del
holding nuevo en particular: **ningún** holding aparecía, incluyendo uno de acciones (AAPL)
creado en una sesión anterior — la página estaba rota para todos los holdings del usuario.

**Por qué:** `inversiones/page.tsx` hacía `supabase.from("holdings").select("*, accounts(name)")`.
Desde la migración 021 (`accounts.holding_id → holdings.id`) coexisten DOS relaciones FK
entre `holdings` y `accounts`: `holdings.account_id → accounts.id` (dueño del holding) y
`accounts.holding_id → holdings.id` (cuenta que sincroniza su balance desde ese holding).
PostgREST no puede elegir sola cuál usar para un embed implícito como `accounts(name)` y
responde `HTTP 300 PGRST201` ("more than one relationship was found"). El código hacía
`const { data } = await supabase...` sin chequear `error`, así que la falla quedaba
silenciada: `data` llegaba `null`, `(data ?? [])` convertía eso en un array vacío, y la
página renderizaba el empty-state como si el usuario no tuviera ninguna posición cargada.
Confirmado en vivo con REST directo a PostgREST (no solo leyendo el código): el mismo
`select=*,accounts(name)` devuelve 300 con el detalle de las dos relaciones candidatas;
`select=id,name,accounts!holdings_account_id_fkey(name)` (FK explícita) devuelve 200 con
ambos holdings.

**Qué hacer:** Cuando una tabla tiene más de un camino FK hacia la misma tabla relacionada,
desambiguar SIEMPRE el embed con la sintaxis `tabla!nombre_de_la_fk(...)` en vez del embed
implícito `tabla(...)`. Y, regla más general: nunca descartar `error` de una llamada
`supabase.from(...).select(...)` sin al menos loguearlo — un embed ambiguo, un typo de
columna, o un problema de RLS se ven todos igual desde la UI ("no hay datos") si `error` se
ignora en silencio. Antes de asumir "no hay filas", probar la query cruda vía REST
(`{url}/rest/v1/tabla?select=...` con el token del usuario) para distinguir "no hay datos"
de "la query falló".

---

## 15. Playwright — @supabase/ssr usa cookies base64, no localStorage

**Qué pasó:** Los scripts de QA buscaban el token de sesión en `localStorage`, pero `@supabase/ssr`
con `createBrowserClient` almacena la sesión en cookies HttpOnly, no en localStorage.

**Por qué:** `@supabase/ssr` está diseñado para SSR: las cookies permiten que el servidor
también lea la sesión. El resultado es que `Object.keys(localStorage)` no devuelve ninguna
clave relacionada con auth.

**Qué hacer en scripts de QA:**
1. Usar `page.context().cookies()` de Playwright para leer las cookies desde Node.js.
2. El nombre de la cookie es `sb-<project_ref>-auth-token`. El valor tiene prefijo `base64-` seguido del JSON base64-encoded.
3. Para decodificar: `Buffer.from(val.slice(7), "base64").toString("utf8")` → JSON con `access_token`.
4. Hacer los fetch a la API de Supabase directamente desde Node.js (no desde `page.evaluate`), pasando el token como header.
5. El user_id se extrae del JWT payload: `JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf8")).sub`.
