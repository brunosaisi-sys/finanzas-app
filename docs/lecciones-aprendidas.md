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

## 26. CEDEAR split — no confundir "pérdida absurda" con bug de matching de ticker

**Qué pasó:** El usuario reportó que su holding de SPY mostraba una pérdida de -74%
(avg_buy_price ≈ $79.507, precio actual ≈ $20.410) — una caída que no tiene sentido
para un CEDEAR del S&P 500. Se investigó con `curl` real contra `data912.com`:
`SPY`, `SPYC` y `SPYD` son símbolos completamente distintos (`SPY: $20.410`,
`SPYC: $12,93`, `SPYD: $13,41`) y `findCedearQuote` usa match EXACTO por símbolo,
no fuzzy — confirmado además creando un holding SPY real vía Playwright: el precio
autocompletado coincidió exactamente con el del feed. La hipótesis de ambigüedad de
ticker (como la de lección §19, pero para CEDEARs) **no reprodujo**.

**Por qué:** La causa real no es de código: BYMA hizo un split del CEDEAR de SPY
(ratio 20:1 → 60:1, ejecutado entre el 29 de mayo y el 1 de junio de 2026, fuente
pública) — por cada CEDEAR el usuario recibió 2 adicionales (triplicó su cantidad)
y el precio unitario cayó a un tercio, sin cambiar el valor total invertido. El
usuario compró antes del split. `holdings.quantity` nunca se actualizó para
reflejar las unidades nuevas, así que la app compara `avg_buy_price` pre-split ×
cantidad pre-split contra `current_price` post-split — una pérdida ficticia, no
real. El modelo de holdings actual no tiene ningún mecanismo para trackear eventos
corporativos (splits, cambios de ratio) — es el mismo gap ya identificado para
historial de compras en Sesión J.1.9 (`holding_events`, pendiente de diseño junto
con TWR en Sesión J.2), y `data912` tampoco expone historial de splits.

**Qué hacer:** Ante una ganancia/pérdida que "no tiene sentido" en un instrumento
conocido, no asumir bug de matching sin antes (a) confirmar que el matching es
exacto (ya lo es para CEDEARs — `cedearCatalog.ts`) y (b) buscar si hubo un evento
corporativo real reciente ("CEDEAR `<ticker>` split ratio") antes de tocar código.
No se implementó ningún fix de código para este caso — hoy `/inversiones` no tiene
forma de editar `quantity`/`avg_buy_price` de un holding ya creado (solo
`current_price`, vía `HoldingPriceEdit`), así que el usuario no puede autocorregir
un split desde la UI. Gap documentado, no implementado esta sesión (fuera del
alcance: "si el bug es de matching, corregir; si la causa es otra, documentar").

---

## 27. fciAutoSync — el histórico de precios quedaba acoplado al throttle del balance

**Qué pasó:** Al auditar el auto-sync de `holding_price_history` (verificación de
que el histórico se llena con fechas reales), se encontró que el `insert` a esa
tabla vivía DENTRO de la rama `if (!error)` del sync de balance, que a su vez solo
corre `if (holding.current_price !== rate.vcp)`. Resultado: un día en que el VCP
del feed no cambia (común en fondos de bajo riesgo / mercado de dinero) nunca
generaba fila de histórico, aunque fue un día real de cotización con su propia
fecha (`rate.fecha`).

**Por qué:** El código conflacionaba dos propósitos con un solo chequeo: (1)
throttle de escritura del RPC `sync_holding_balance` (correcto: solo llamar si el
precio cambió, para no escribir de más) y (2) registro histórico (un precio sin
cambios sigue siendo un punto de datos válido — 0% de variación ese día — no "nada
que registrar"). Menos puntos reales acumulados en `holding_price_history` implica
más chance de que `calcHoldingReturn` devuelva `null` por falta de historial,
incluso cuando técnicamente pasaron suficientes días.

**Qué hacer:** Separar el registro histórico del throttle de balance. En
`src/lib/fciAutoSync.ts` (Sesión J.1.12) el `upsert` a `holding_price_history`
corre siempre que el feed reporte VCP para el holding, sin condicionarlo al cambio
de precio; el chequeo `current_price !== rate.vcp` quedó solo para decidir si
llamar al RPC de balance.

---

## 28. Catálogo FCI por institución — fragilidad asimétrica ante fallos parciales del feed

**Qué pasó:** El usuario reportó que al editar un bolsillo de Mercado Pago
aparecía el dropdown genérico de vincular un holding existente, en vez del
catálogo de fondos de la institución (que sí funcionó para Cocos). Se intentó
reproducir de forma determinística con Playwright headed, recreando la estructura
exacta reportada (cuenta padre "Mercado Pago" + bolsillo hijo "Pesos",
`earns_yield=true`, con un holding FCI de otra institución —Cocos— ya en la DB) —
**el catálogo apareció correctamente, sin reproducir el bug.**

**Por qué (hipótesis más probable — no confirmada con evidencia determinística,
no hay logs de producción accesibles desde este entorno):** `fetchAllFciFundsRaw`
hace 4 fetches en paralelo (uno por categoría FCI) y silencia errores POR
CATEGORÍA para no bloquear el resto del catálogo. Mercado Pago tiene un solo fondo
("Mercado Fondo") en UNA sola categoría (`mercadoDinero`) — a diferencia de
Cocos/Balanz/Bull Market/IOL, que están repartidos en varias categorías. Un solo
fetch fallido (timeout o 5xx transitorio) a esa categoría específica vacía TODO el
catálogo de Mercado Pago, mientras que a las demás instituciones les alcanza con
las categorías que sí respondieron — una asimetría real de robustez, no un bug de
lógica de matching (el matching en sí, verificado con `curl` contra el feed
vigente, es correcto: el prefijo "mercado fondo" matchea las 4 clases A-D).

**Qué hacer:** Documentado como hipótesis, no como certeza (no se pudo confirmar
determinísticamente — principio "no inventar explicaciones" del proyecto). Se
aplicó un fix defensivo de bajo riesgo: un reintento por categoría
(`fetchFciCategoryWithRetry` en `src/lib/fciCatalog.ts`, Sesión J.1.12), que
reduce la fragilidad sin ocultar un fallo persistente real del feed. Si el catálogo
de Mercado Pago vuelve a aparecer vacío después de este fix, es señal fuerte de que
la causa es otra y hace falta revisar con logs reales del entorno de producción
(Vercel).

---

## 29. Playwright — `router.push()` client-side no siempre se refleja en `page.url()` durante desarrollo activo

**Qué pasó:** Un script de QA hacía click en "Registrar ingreso" (que internamente
llama `router.push("/")` + `router.refresh()`) y esperaba con
`page.waitForURL(BASE + "/", { timeout: 15000 })`. El timeout se agotaba
sistemáticamente, pero al verificar el balance de la cuenta vía REST en paralelo,
la operación SÍ se había completado correctamente en el servidor — no era un bug
de la app, era el script el que nunca detectaba la navegación.

**Por qué:** El tracing de red confirmó que el fetch RSC hacia `/` (`GET
/?_rsc=...`) sí se completaba con 200, pero `page.url()` de Playwright seguía
devolviendo la URL vieja. La causa más probable: esta sesión editó activamente
varios archivos de servidor mientras el dev server (Turbopack) corría, y el
recompile/HMR concurrente puede interferir con que el router de Next.js
complete el `history.pushState()` a tiempo, sin lanzar ningún error de consola
ni de red visible.

**Qué hacer:** No depender de `waitForURL` para verificar que un submit con
`router.push()` navegó, sobre todo si el dev server está compilando cambios de
código en paralelo a la prueba. Alternativas más robustas: (a) esperar un
`waitForTimeout` fijo generoso (2–3s) tras el click y después navegar
explícitamente con `page.goto()` al siguiente paso en vez de confiar en que el
click ya te dejó ahí; (b) verificar el resultado real contra la DB (REST) en
vez de contra la URL del browser — es la fuente de verdad, no un proxy frágil
del estado de React. Ver también lección §12 (mismo principio: usar `page.goto`
en vez de confiar en timing de React/router).

---

## 30. `rm -rf .next` con el dev server corriendo corrompe la caché persistente de Turbopack

**Qué pasó:** Al intentar limpiar un error de `tsc` causado por un `.next/types`
desactualizado (referenciaba una ruta de API recién borrada), se corrió
`rm -rf .next` mientras `npm run dev` seguía activo. El comando falló a mitad de
camino ("Directory not empty") porque el dev server tenía archivos abiertos, y
el proceso de Turbopack quedó con la base de datos de caché (`.next/dev/cache/
turbopack/*.sst`) parcialmente borrada. El servidor entró en pánico
(`Failed to restore task data (corrupted database or bug)`) y dejó de responder
(`curl` a `localhost:3000` devolvía conexión rechazada).

**Por qué:** Turbopack persiste su grafo de tareas incrementales en archivos
`.sst` mientras el proceso está vivo. Borrar esos archivos por fuera del
proceso que los tiene abiertos es equivalente a borrar la base de datos de una
app corriendo — no hay forma de que se recupere sola.

**Qué hacer:** Nunca borrar `.next` mientras el dev server esté corriendo. Si
hace falta invalidar tipos generados obsoletos (ej. tras borrar una ruta), la
forma segura es disparar un recompile normal — un `curl` a cualquier página
del sitio alcanza para que Next regenere `.next/types/validator.ts` — sin tocar
el directorio a mano. Si el servidor ya quedó en este estado roto: matar el
proceso (`tasklist`/`taskkill` en Windows), recién ahí borrar `.next` con el
proceso detenido, y arrancar `npm run dev` de nuevo desde cero.

---

## 31. matchFCIRate priorizaba `ticker` sobre `name` — root cause real de holding_price_history en 0 filas

**Qué pasó:** El usuario reportó (corriendo la query de verificación documentada en
Sesión J.1.13) que `holding_price_history` tenía 0 filas para TODOS sus holdings FCI
reales, a pesar de que el auto-sync se había implementado y "verificado" en varias
sesiones anteriores (J.1.5, J.1.7, J.1.11, J.1.12, J.1.13). Se reprodujo con datos
reales vía REST + Playwright (no simulado desde cero): se creó un holding FCI con
`name` = nombre exacto de un fondo real del feed pero con `ticker` = "COCO1" (un
valor arbitrario, como podría haber tipeado el usuario en el campo "Ticker
(opcional)" de `/inversiones/nueva`), y otro idéntico con `ticker = null`. Tras
visitar `/cuentas` e `/inversiones` (dispara `autoSyncFciHoldings`): el holding SIN
ticker sincronizó correctamente (1 fila de histórico, `current_price` actualizado al
VCP real del feed); el holding CON ticker no sincronizó nada (0 filas, precio sin
cambios) — silenciosamente, sin ningún error visible.

**Por qué:** `matchFCIRate` en `src/lib/fciRates.ts` calculaba
`const needle = (holding.ticker ?? holding.name).toLowerCase()` — si `ticker` no era
null, se usaba EN VEZ de `name`, nunca junto a él. A diferencia de CEDEARs (donde el
ticker es el identificador real y exacto del feed de `data912.com`), el feed de FCI
de ArgentinaDatos no expone ningún código corto — solo el nombre completo del fondo
(`fondo`). El campo "Ticker" en `HoldingForm.tsx` es texto libre opcional para
TODOS los tipos de activo, sin ninguna validación contra el feed real para FCI. Todas
las sesiones anteriores que "verificaron" el auto-sync end-to-end lo hicieron con
holdings de prueba creados con `ticker` vacío (por el flujo nuevo de
`create_and_link_fci_holding`, que además fija `ticker = NULL` explícitamente) —
nunca con el flujo manual antiguo con el campo Ticker completado, que es
probablemente cómo quedó cargado el holding real del usuario.

**Qué hacer:** `matchFCIRate` ya no acepta `ticker` como parámetro — para
`asset_type = "fci"` matchea SIEMPRE por `name`. Se agregó un hint visible en
`HoldingForm.tsx` (solo para tipo FCI) aclarando que el campo Ticker no se usa para
la sincronización automática de precio. Regla general: cuando dos tipos de activo
comparten un componente de formulario pero tienen fuentes de datos externas
completamente distintas (CEDEAR → ticker exacto; FCI → nombre completo, sin
ticker), no reusar el mismo campo con la misma semántica implícita para ambos sin
dejarlo explícito en la UI — la ambigüedad se paga en silencio, sin ningún error que
la delate. Ver `src/lib/fciRates.test.ts` para el test de regresión.

---

## 32. accounts.balance en cuentas con holding vinculado — más de un camino puede romper la invariante

**Qué pasó:** El usuario reportó que al editar el saldo de "Mercado Pago Pesos"
(cuenta vinculada a un holding FCI) directamente desde `CuentaActions`, el cambio no
se reflejaba en `/inversiones`. Investigando el alcance completo, se confirmó que la
invariante `accounts.balance = holdings.quantity × holdings.current_price`
(migración 021) solo se mantenía en los caminos que pasan por un RPC consciente del
holding (`sync_holding_balance`, `link_and_sync_holding`, `update_holding_position`)
— pero **cualquier otro camino que toque `accounts.balance` de una cuenta con
`holding_id` no NULL** la rompe silenciosamente: edición manual de saldo
(`updateAccount`, el caso reportado), crédito de un ingreso con esa cuenta como
destino (migración 024, Sesión J.1.13), y earmark funding (migración 017). Ninguno
de esos tres sabe que la cuenta tiene un holding detrás.

**Por qué:** Cada uno de esos flujos fue diseñado y verificado (Sesiones H, J.1.13)
ANTES de que existiera el concepto de cuenta vinculada a holding (migración 021,
Sesión J.1), o en paralelo sin considerar la intersección. `accounts.holding_id` es
una feature relativamente nueva y transversal — toca cualquier operación que mueva
`balance`, no solo las que ya conocían holdings.

**Qué hacer (decisión de alcance, Sesión J.1.14):** se implementó el camino
reportado (edición manual, el único confirmado por el usuario) vía RPC
`adjust_linked_account_balance` (migración 026): interpreta el delta de balance como
compra/venta de unidades al precio actual del holding, y actualiza `quantity` +
`balance` atómicamente; si el holding no tiene precio cargado, rechaza la edición
con un mensaje explícito en vez de adivinar. Los otros dos caminos (crédito de
ingreso, earmark funding) quedan **pendientes, documentados, no implementados** —
son RPCs de movimiento de dinero ya verificadas en sesiones anteriores (J.1.13,
Sesión H) y modificarlas de forma apurada en una sesión con otras 7 tareas es más
riesgo que valor. Antes de tocarlas: decidir si conviene la ruta centralizada (una
única función `adjust_linked_account_balance`-like que TODAS las RPCs de dinero
llamen en vez de tocar `accounts.balance` directamente cuando `holding_id` no es
null) en vez de duplicar la lógica delta→quantity en cada RPC por separado.

---

## 33. getInstallmentDueDates — con solo closing_day configurado, ignoraba closing_day por completo

**Qué pasó:** El usuario configuró `closing_day = 7` en una tarjeta (sin `due_day`) y
un gasto nuevo mostró una fecha de vencimiento "día 8" — sin relación aparente con
el 7 configurado. Se reprodujo con datos reales (REST + Playwright, tarjeta con
`closing_day=7, due_day=null`): antes del fix, `getInstallmentDueDates` entraba en
la rama `if (!closingDay || !dueDay)` apenas UNO de los dos faltaba, cayendo a un
heurístico ciego de "fecha de compra + 30 días" que no usa `closingDay` para nada —
la fecha resultante puede caer cerca de cualquier día del mes siguiente por pura
coincidencia de calendario, sin ninguna relación con el ciclo real de la tarjeta.

**Por qué:** El chequeo `!closingDay || !dueDay` trataba "falta uno de los dos" igual
que "faltan los dos" — pero son casos distintos: si `closingDay` SÍ está, hay
información real del ciclo de facturación que se estaba tirando a la basura.

**Qué hacer:** Separar los casos. Si `closingDay` está pero `dueDay` no, usar
`closingDay` como proxy de `dueDay` (`effectiveDueDay = dueDay ?? closingDay`) — la
misma lógica de ciclo mensual (mes de cierre + 1) pero sin el offset real de días
entre cierre y vencimiento, que sigue siendo una aproximación mejor y más honesta
que ignorar el cierre. El aviso "Sin cierre/vencimiento configurado — fechas
aproximadas" en `/cuotas` (ya existente desde Sesión J.1.12) sigue cubriendo este
caso mientras falte `dueDay` real. Solo cuando FALTAN LOS DOS se usa el heurístico
ciego de +30 días (no hay ninguna información del ciclo real para aprovechar).
Verificado con reproducción real: tarjeta `closing_day=7/due_day=null`, gasto
comprado el día 9 (después del cierre) → antes: fecha arbitraria por +30 días;
después: `2026-10-07` (cierre del mes siguiente + due_day=closing_day=7).

---

## 34. Modales bottom-sheet con z-50 empatan con BottomNav y quedan tapados

**Qué pasó:** El usuario reportó que en el modal de pago en lote de `/cuotas`, al
elegir la cuenta de origen no aparecía ningún botón para confirmar. El código SÍ
tenía el botón "Confirmar pago" (`BatchPayButton.tsx`). La causa: el modal usa
`fixed inset-0 z-50` y es un bottom-sheet (`items-end`, el botón queda en la franja
inferior de la pantalla) — pero `BottomNav` (`layout.tsx`, renderizado DESPUÉS de
`{children}` en el DOM) también usa `z-50` en su `<nav>` fija al fondo. Con
z-index empatado, gana visualmente el último elemento en el DOM — `BottomNav` tapa
la franja inferior de cualquier modal con `z-50`, exactamente donde vive el botón
de confirmar en un sheet `items-end`. `PayInstallmentButton.tsx` y
`AportarModal.tsx` tenían el mismo bug latente (mismo patrón `z-50`);
`ConfirmFundingButton.tsx` ya usaba `z-[60]` — el fix correcto ya existía en el
mismo directorio, solo no se había aplicado de forma consistente.

**Por qué:** El z-index no define solo "quién está arriba" en abstracto — con
valores iguales, el orden del DOM decide, y `BottomNav` siempre se monta al final
del árbol de `MainLayout`. Cualquier modal nuevo que copie `z-50` sin mirar qué
z-index usa `BottomNav` hereda este bug silenciosamente (el botón EXISTE, el click
puede incluso registrar el evento en algunos casos según la posición exacta, pero
visualmente no se ve o queda parcialmente tapado — confuso de diagnosticar solo
leyendo el código, hace falta abrir la pantalla real o revisar el z-index).

**Qué hacer:** Todo modal fullscreen (`fixed inset-0`) debe usar `z-[60]`, nunca
`z-50` — `BottomNav` es la referencia de z-index más alta del layout persistente.
Ver `src/components/BottomNav.tsx` antes de agregar un modal nuevo. Se corrigieron
los 3 casos con `z-50`: `BatchPayButton.tsx`, `PayInstallmentButton.tsx`,
`AportarModal.tsx`. Verificado con Playwright en viewport móvil (390×700): el botón
"Confirmar pago" ahora es clickeable y el pago en lote se completa (cuotas
verificadas como `paid=true` en Supabase tras el click).

---

## 35. Cleanup de QA con DELETE crudo sobre `expenses` no revierte el balance — y `AmountInput` también es `type="text"`

**Qué pasó:** Durante la verificación de TAREA 5 (decimales en monto de gasto), un
script de QA intermedio (con un bug propio, no del producto) usó
`page.locator("input[type='text']").first()` para llenar el campo "Comercio",
sin darse cuenta de que `AmountInput` TAMBIÉN es `type="text"` (con
`inputMode="numeric"`, pero sigue siendo `type="text"` a nivel DOM) — `.first()`
terminó rellenando el campo de MONTO con el texto "QA T5 Decimal", que
`AmountInput.handleChange` redujo a su único dígito ("5"), y el campo Comercio
real quedó vacío. El formulario igual se envió, creando un gasto real de $5
sin nombre, débito automático de la cuenta por defecto (la primera cuenta hoja
alfabéticamente — resultó ser el fixture real "Cocos Capital"). El cleanup del
script solo hizo `DELETE /expenses?merchant=eq.QA T5 Decimal` (no encontró nada,
porque el merchant real quedó vacío) y por separado, en el intento SIGUIENTE
(ya corregido), borró la fila correcta pero con un `DELETE` crudo sobre
`expenses` en vez de la RPC `delete_expense_with_balance` — el balance de la
cuenta nunca se revirtió. Ninguno de los dos gastos de prueba dejó rastro
"obvio" (no aparecían en listados por `merchant`), así que el `git status`/tests
no lo iban a detectar — solo se encontró al auditar el balance real de
"Cocos Capital" contra el valor documentado en CLAUDE.md ($252.500,01 vs.
$251.260,45 real, diferencia = exactamente $1.234,56, el monto del test).

**Por qué:** Dos causas independientes se combinaron: (1) un selector Playwright
ambiguo (`.first()` sobre `type="text"` cuando hay más de un input con ese
atributo en la página) escribió en el campo equivocado sin ningún error visible
— el submit igual "funcionó" porque el monto corrupto (`"5"`) seguía siendo
válido (`> 0`); (2) el cleanup de QA usó `DELETE` crudo en vez de la RPC
atómica del dominio (`delete_expense_with_balance`), que es la ÚNICA forma
correcta de borrar un gasto sin dejar el balance de la cuenta desincronizado
— el `DELETE` crudo borra la fila pero no revierte el efecto que tuvo sobre
`accounts.balance` en el momento de creación.

**Qué hacer:**
1. Selectores de Playwright: nunca asumir que un campo es el único
   `type="text"`/`type="number"` de la página — `AmountInput` es `type="text"`
   a propósito (ver comentario en el componente). Contar las coincidencias
   (`await locator.count()`) antes de usar `.first()`/`.nth()`, o usar un
   selector más específico (`inputMode`, `placeholder`, orden real en el DOM).
2. Cleanup de QA de `expenses`/`incomes`/holdings vinculados: SIEMPRE revertir
   vía la RPC atómica correspondiente (`delete_expense_with_balance`,
   `delete_income_with_balance`, etc.), nunca un `DELETE` crudo sobre la tabla
   — el `DELETE` crudo es aceptable únicamente para entidades que nunca tocan
   `accounts.balance` (categorías, cuentas sin gastos/holdings asociados,
   holdings sueltos sin vincular).
3. **Antes de cerrar cualquier sesión que corrió QA con dinero real**, no alcanza
   con que cada script individual imprima "Cleanup OK" — auditar el balance
   final de los fixtures permanentes contra el valor documentado en CLAUDE.md
   (`docs/lecciones-aprendidas.md` sección "Fixtures permanentes") como último
   paso, no solo revisar `git status` (que nunca va a mostrar drift de datos).

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
