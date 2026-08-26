/**
 * Carga datos de demo ricos en la cuenta del usuario autenticado.
 * Uso:
 *   node scripts/seed-demo-data.mjs
 * Abre Playwright headed → login con Google → siembra cuentas, gastos,
 * cuotas, inversiones, bienes, metas, compartidos e ingresos.
 *
 * Lee URL/anon de .env.local. No usa service_role.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

function loadEnvLocal() {
  const raw = readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

function isoDate(d) {
  return d.toISOString().split("T")[0];
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return isoDate(d);
}

function getInstallmentDueDates(expenseDateStr, count, closingDay, dueDay) {
  if (!closingDay) {
    const base = new Date(expenseDateStr + "T12:00:00");
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + 30 * (i + 1));
      return isoDate(d);
    });
  }
  const effectiveDueDay = dueDay ?? closingDay;
  const expDate = new Date(expenseDateStr + "T12:00:00");
  const expDay = expDate.getDate();
  let closingMonth = expDate.getMonth();
  let closingYear = expDate.getFullYear();
  if (expDay > closingDay) {
    closingMonth++;
    if (closingMonth > 11) {
      closingMonth = 0;
      closingYear++;
    }
  }
  return Array.from({ length: count }, (_, i) => {
    let dueMonth = closingMonth + 1 + i;
    let dueYear = closingYear;
    while (dueMonth > 11) {
      dueMonth -= 12;
      dueYear++;
    }
    const maxDay = new Date(dueYear, dueMonth + 1, 0).getDate();
    return isoDate(new Date(dueYear, dueMonth, Math.min(effectiveDueDay, maxDay)));
  });
}

function decodeAuthCookie(value) {
  // Formato @supabase/ssr: "base64-<json-base64>"
  if (!value) return null;
  let payload = value;
  if (payload.startsWith("base64-")) payload = payload.slice(7);
  try {
    const json = Buffer.from(payload, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    try {
      return JSON.parse(decodeURIComponent(value));
    } catch {
      return null;
    }
  }
}

async function waitForAccessToken(page, projectRef, timeoutMs = 5 * 60 * 1000) {
  const cookieName = `sb-${projectRef}-auth-token`;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const cookies = await page.context().cookies();
      const authCookies = cookies.filter(
        (c) => c.name === cookieName || c.name.startsWith(`${cookieName}.`)
      );
      if (authCookies.length === 1) {
        const session = decodeAuthCookie(authCookies[0].value);
        if (session?.access_token) return session;
      } else if (authCookies.length > 1) {
        authCookies.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        const joined = authCookies.map((c) => c.value).join("");
        const session = decodeAuthCookie(joined);
        if (session?.access_token) return session;
      }
      // Fallback: cualquier cookie sb-*-auth-token
      for (const c of cookies) {
        if (!c.name.includes("auth-token")) continue;
        const session = decodeAuthCookie(c.value);
        if (session?.access_token) return session;
      }
    } catch {
      // navegación en curso (Google OAuth) — reintentar
    }
    await page.waitForTimeout(1500);
  }
  throw new Error("Timeout esperando login con Google (5 min).");
}

async function ensureLoginAndToken(url, anonKey) {
  const projectRef = new URL(url).hostname.split(".")[0];
  console.log("\n→ Abriendo navegador. Entrá con Google (fransalvatierra16@gmail.com)...\n");

  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await context.newPage();
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });

  // Si ya hay sesión, ir al home
  await page.waitForTimeout(800);
  if (!page.url().includes("/login")) {
    console.log("Sesión ya activa:", page.url());
  } else {
    console.log("Esperando que completes el login con Google en la ventana…");
  }

  const session = await waitForAccessToken(page, projectRef);
  await browser.close();
  return session;
}

async function createExpense(supabase, userId, {
  amount, currency, categoryId, accountId, merchant, description, date,
  paymentMethod, installmentsTotal = 1, coveringAccountId = null,
  fundingAccountId = null, closingDay = null, dueDay = null,
  coveringCurrency = null, participants = [],
}) {
  const isCredito = paymentMethod === "credito";
  const cuotas = isCredito ? Math.max(1, installmentsTotal) : 1;
  const installmentAmount = isCredito ? amount / cuotas : null;

  const p_expense = {
    user_id: userId,
    amount,
    currency,
    category_id: categoryId ?? "",
    account_id: accountId ?? "",
    merchant: merchant ?? null,
    description: description ?? null,
    date,
    source: "app",
    payment_method: paymentMethod,
    installments_total: isCredito ? String(cuotas) : "",
    installment_amount: installmentAmount != null ? String(installmentAmount) : "",
    covering_account_id: isCredito && coveringAccountId ? coveringAccountId : "",
    funding_account_id: isCredito && coveringAccountId && fundingAccountId ? fundingAccountId : "",
  };

  const p_installments = isCredito
    ? getInstallmentDueDates(date, cuotas, closingDay, dueDay).map((due, i) => ({
        installment_number: i + 1,
        amount: installmentAmount,
        due_date: due,
      }))
    : [];

  let p_earmark = null;
  if (isCredito && coveringAccountId) {
    const last = p_installments.at(-1)?.due_date ?? "";
    p_earmark = {
      user_id: userId,
      account_id: coveringAccountId,
      amount,
      currency: coveringCurrency ?? currency,
      reason: `Cuotas: ${merchant ?? description ?? "gasto"} (${cuotas}x)`,
      release_date: last,
    };
  }

  const { data, error } = await supabase.rpc("create_expense_with_balance", {
    p_expense,
    p_installments,
    p_earmark,
  });
  if (error) throw new Error(`gasto ${merchant}: ${error.message}`);

  if (participants.length > 0) {
    await supabase.from("expense_participants").insert(
      participants.map((p) => ({ expense_id: data, name: p.name, amount: p.amount }))
    );
  }
  return data;
}

async function main() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Falta .env.local con URL y anon key");

  let accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  let refreshToken = process.env.SUPABASE_REFRESH_TOKEN;
  let userId = process.env.SUPABASE_USER_ID;

  if (!accessToken) {
    const session = await ensureLoginAndToken(url, anon);
    accessToken = session.access_token;
    refreshToken = session.refresh_token;
    userId = session.user?.id;
  }

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (refreshToken) {
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser(accessToken);
  if (userErr || !userData?.user) throw new Error("No se pudo validar el usuario: " + (userErr?.message ?? "sin user"));
  const user = userData.user;
  userId = user.id;
  console.log(`✓ Autenticado como ${user.email} (${userId})`);

  if (user.email && !user.email.toLowerCase().includes("fransalvatierra")) {
    console.warn(`⚠ El email logueado es ${user.email}, no fransalvatierra16@gmail.com — se siembra igual en esa cuenta.`);
  }

  // ── Categorías ─────────────────────────────────────────────
  const catDefs = [
    ["Supermercado", "🛒"], ["Transporte", "🚌"], ["Alquiler", "🏠"],
    ["Salud y Farmacia", "💊"], ["Nafta", "⛽"], ["Delivery y Restaurantes", "🍕"],
    ["Servicios", "💡"], ["Ropa", "👕"], ["Entretenimiento", "🎬"],
    ["Telefonía e Internet", "📱"], ["Viajes", "✈️"], ["Educación", "📚"],
  ];
  const { data: existingCats } = await supabase.from("categories").select("id, name");
  const catByName = new Map((existingCats ?? []).map((c) => [c.name, c.id]));
  for (const [name, icon] of catDefs) {
    if (catByName.has(name)) continue;
    const { data, error } = await supabase.from("categories").insert({ user_id: userId, name, icon }).select("id").single();
    if (error) throw error;
    catByName.set(name, data.id);
  }
  console.log(`✓ Categorías: ${catByName.size}`);

  // ── Cuentas (árbol) ────────────────────────────────────────
  async function rpcAccount(parent, children) {
    const { data, error } = await supabase.rpc("create_account_with_children", {
      p_parent: parent,
      p_children: children,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  const { data: existingAccounts } = await supabase.from("accounts").select("*");
  const hasSeed = (existingAccounts ?? []).some((a) => a.name === "BBVA" || a.name === "Cocos Capital");

  let ids = {};
  if (hasSeed) {
    console.log("→ Ya hay cuentas (BBVA/Cocos). Reuso las existentes y agrego más datos encima.");
    for (const a of existingAccounts) {
      const key = a.parent_id ? `${a.name}` : a.name;
      ids[`${a.name}:${a.currency}:${a.type}`] = a.id;
      ids[a.name] = a.id;
    }
  } else {
    const bbva = await rpcAccount(
      { name: "BBVA", type: "banco", currency: "ARS", balance: 0, earns_yield: false },
      [
        { name: "Pesos", type: "banco", currency: "ARS", balance: 850000, earns_yield: false },
        { name: "Dólares", type: "banco", currency: "USD", balance: 1200, earns_yield: false },
        { name: "Visa", type: "credito", currency: "ARS", balance: 0, earns_yield: false, closing_day: 7, due_day: 18 },
      ]
    );
    const galicia = await rpcAccount(
      { name: "Galicia", type: "banco", currency: "ARS", balance: 0, earns_yield: false },
      [
        { name: "Caja de ahorro", type: "banco", currency: "ARS", balance: 420000, earns_yield: false },
        { name: "Mastercard", type: "credito", currency: "ARS", balance: 0, earns_yield: false, closing_day: 12, due_day: 22 },
      ]
    );
    const cocos = await rpcAccount(
      { name: "Cocos Capital", type: "inversion", currency: "ARS", balance: 0, earns_yield: true },
      [
        { name: "Fondos", type: "inversion", currency: "ARS", balance: 0, earns_yield: true },
        { name: "CEDEARs", type: "inversion", currency: "ARS", balance: 0, earns_yield: false },
      ]
    );
    const mp = await rpcAccount(
      { name: "Mercado Pago", type: "banco", currency: "ARS", balance: 0, earns_yield: true },
      [{ name: "Pesos", type: "banco", currency: "ARS", balance: 185000, earns_yield: true }]
    );
    const { data: cash } = await supabase.from("accounts").insert({
      user_id: userId, name: "Efectivo", type: "efectivo", currency: "ARS", balance: 45000, earns_yield: false,
    }).select("id").single();
    const { data: usdRes } = await supabase.from("accounts").insert({
      user_id: userId, name: "Caja fuerte USD", type: "usd_reserva", currency: "USD", balance: 2500, earns_yield: false,
    }).select("id").single();

    void bbva; void galicia; void cocos; void mp;
    const { data: all } = await supabase.from("accounts").select("*");
    for (const a of all ?? []) {
      ids[`${a.name}:${a.currency}:${a.type}`] = a.id;
      ids[a.name] = a.id;
    }
    ids.cash = cash.id;
    ids.usdRes = usdRes.id;
    console.log(`✓ Cuentas creadas: ${(all ?? []).length}`);
  }

  const { data: accounts } = await supabase.from("accounts").select("*");
  const by = (pred) => (accounts ?? []).find(pred);
  const pesosBBVA = by((a) => a.name === "Pesos" && a.currency === "ARS" && accounts.some((p) => p.id === a.parent_id && p.name === "BBVA"))
    ?? by((a) => a.name === "Pesos" && a.currency === "ARS");
  const usdBBVA = by((a) => a.name === "Dólares" && a.currency === "USD");
  const visa = by((a) => a.name === "Visa" && a.type === "credito");
  const mastercard = by((a) => a.name === "Mastercard" && a.type === "credito");
  const galiciaCA = by((a) => a.name === "Caja de ahorro");
  const cocosFondos = by((a) => a.name === "Fondos");
  const cocosCedears = by((a) => a.name === "CEDEARs");
  const mpPesos = by((a) => a.name === "Pesos" && accounts.some((p) => p.id === a.parent_id && p.name === "Mercado Pago")) ?? pesosBBVA;
  const cash = by((a) => a.name === "Efectivo") ?? pesosBBVA;
  const covering = cocosFondos ?? pesosBBVA;

  if (!pesosBBVA || !visa) {
    throw new Error("No encontré cuentas Pesos/Visa — aborto para no dejar data a medias.");
  }

  // ── Ingresos ───────────────────────────────────────────────
  const incomes = [
    { amount: 1850000, currency: "ARS", type: "sueldo", date: daysAgo(25), account_id: pesosBBVA.id, note: "Sueldo marzo", distributed: false },
    { amount: 1850000, currency: "ARS", type: "sueldo", date: daysAgo(5), account_id: pesosBBVA.id, note: "Sueldo abril", distributed: false },
    { amount: 320000, currency: "ARS", type: "freelance", date: daysAgo(12), account_id: mpPesos.id, note: "Proyecto freelance", distributed: false },
    { amount: 450, currency: "USD", type: "otro", date: daysAgo(18), account_id: usdBBVA?.id ?? pesosBBVA.id, note: "Reembolso viaje", distributed: false },
  ];
  for (const inc of incomes) {
    const { error } = await supabase.rpc("create_income_with_balance", {
      p_amount: inc.amount,
      p_currency: inc.currency,
      p_type: inc.type,
      p_account_id: inc.account_id,
      p_date: inc.date,
      p_note: inc.note,
    });
    if (error) console.warn("  ingreso:", error.message);
  }
  console.log("✓ Ingresos");

  // ── Gastos débito / efectivo ───────────────────────────────
  const debitExpenses = [
    { amount: 87500.5, cat: "Supermercado", account: pesosBBVA, merchant: "Coto", days: 2, method: "debito" },
    { amount: 42300, cat: "Supermercado", account: mpPesos, merchant: "Carrefour", days: 8, method: "debito" },
    { amount: 18500, cat: "Nafta", account: pesosBBVA, merchant: "YPF", days: 3, method: "debito" },
    { amount: 9200, cat: "Delivery y Restaurantes", account: mpPesos, merchant: "PedidosYa", days: 1, method: "debito" },
    { amount: 14500, cat: "Delivery y Restaurantes", account: cash, merchant: "Parrilla Don Julio", days: 6, method: "efectivo" },
    { amount: 28000, cat: "Telefonía e Internet", account: pesosBBVA, merchant: "Personal", days: 10, method: "debito" },
    { amount: 65000, cat: "Servicios", account: galiciaCA ?? pesosBBVA, merchant: "EDENOR", days: 14, method: "debito" },
    { amount: 22000, cat: "Transporte", account: mpPesos, merchant: "Uber", days: 4, method: "debito" },
    { amount: 38000, cat: "Salud y Farmacia", account: pesosBBVA, merchant: "Farmacity", days: 9, method: "debito" },
    { amount: 125000, cat: "Alquiler", account: pesosBBVA, merchant: "Alquiler depto", days: 20, method: "debito" },
    { amount: 56000, cat: "Entretenimiento", account: pesosBBVA, merchant: "Spotify+Netflix+Disney", days: 11, method: "debito" },
    { amount: 89000, cat: "Ropa", account: pesosBBVA, merchant: "Zara", days: 16, method: "debito" },
  ];

  for (const e of debitExpenses) {
    await createExpense(supabase, userId, {
      amount: e.amount,
      currency: "ARS",
      categoryId: catByName.get(e.cat),
      accountId: e.account.id,
      merchant: e.merchant,
      description: null,
      date: daysAgo(e.days),
      paymentMethod: e.method,
    });
  }

  // Gasto compartido
  await createExpense(supabase, userId, {
    amount: 48000,
    currency: "ARS",
    categoryId: catByName.get("Delivery y Restaurantes"),
    accountId: pesosBBVA.id,
    merchant: "Asado con amigos",
    description: "Gasto compartido demo",
    date: daysAgo(3),
    paymentMethod: "debito",
    participants: [
      { name: "Martín", amount: 16000 },
      { name: "Lucía", amount: 16000 },
    ],
  });
  console.log("✓ Gastos débito + compartido");

  // ── Cuotas crédito ─────────────────────────────────────────
  const creditBuys = [
    { amount: 360000, merchant: "Frávega — Heladera", cuotas: 12, days: 40, card: visa, cat: "Servicios" },
    { amount: 180000, merchant: "Garbarino — Aire", cuotas: 6, days: 25, card: visa, cat: "Servicios" },
    { amount: 96000, merchant: "Musimundo — Auriculares", cuotas: 3, days: 10, card: mastercard ?? visa, cat: "Entretenimiento" },
    { amount: 240000, merchant: "Despegar — Pasajes", cuotas: 6, days: 15, card: visa, cat: "Viajes" },
    { amount: 75000, merchant: "Nike Store", cuotas: 3, days: 5, card: mastercard ?? visa, cat: "Ropa" },
  ];

  for (const c of creditBuys) {
    const card = c.card;
    if (!card) continue;
    await createExpense(supabase, userId, {
      amount: c.amount,
      currency: "ARS",
      categoryId: catByName.get(c.cat),
      accountId: card.id,
      merchant: c.merchant,
      description: null,
      date: daysAgo(c.days),
      paymentMethod: "credito",
      installmentsTotal: c.cuotas,
      coveringAccountId: covering?.id ?? null,
      fundingAccountId: pesosBBVA.id,
      closingDay: card.closing_day,
      dueDay: card.due_day,
      coveringCurrency: covering?.currency ?? "ARS",
    });
  }
  console.log("✓ Gastos en cuotas");

  // ── Inversiones / holdings ─────────────────────────────────
  if (cocosFondos) {
    const { error: fciErr } = await supabase.rpc("create_and_link_fci_holding", {
      p_account_id: cocosFondos.id,
      p_name: "Cocos Rendimiento - Clase A",
      p_quantity: 8500,
      p_price: 1250.5,
      p_currency: "ARS",
      p_purchase_date: monthsAgo(4),
    });
    if (fciErr) console.warn("  FCI link:", fciErr.message);
  }

  const holdings = [
    { name: "Apple", ticker: "AAPL", type: "cedear", qty: 12, buy: 18500, cur: 24800, account: cocosCedears, daysHist: [40, 25, 10, 0] },
    { name: "SPDR S&P 500", ticker: "SPY", type: "cedear", qty: 8, buy: 22000, cur: 20410, account: cocosCedears, daysHist: [35, 20, 7, 0] },
    { name: "MercadoLibre", ticker: "MELI", type: "cedear", qty: 3, buy: 420000, cur: 510000, account: cocosCedears, daysHist: [30, 15, 5, 0] },
    { name: "Coca-Cola", ticker: "KO", type: "cedear", qty: 25, buy: 9800, cur: 11200, account: cocosCedears, daysHist: [28, 14, 3, 0] },
    { name: "Al30", ticker: "AL30", type: "bono", qty: 100, buy: 68.5, cur: 72.1, account: cocosCedears, daysHist: [20, 10, 0] },
  ];

  for (const h of holdings) {
    if (!h.account) continue;
    const { data: holding, error } = await supabase.from("holdings").insert({
      user_id: userId,
      account_id: h.account.id,
      name: h.name,
      ticker: h.ticker,
      asset_type: h.type,
      quantity: h.qty,
      avg_buy_price: h.buy,
      currency: "ARS",
      current_price: h.cur,
      purchase_date: monthsAgo(3),
      notes: "seed-demo",
    }).select("id").single();
    if (error) {
      console.warn(`  holding ${h.ticker}:`, error.message);
      continue;
    }
    // Histórico para gráfico
    const hist = h.daysHist.map((d, i) => ({
      holding_id: holding.id,
      price: h.buy + ((h.cur - h.buy) * (i / Math.max(1, h.daysHist.length - 1))),
      recorded_at: daysAgo(d || 0),
    }));
    await supabase.from("holding_price_history").upsert(hist, { onConflict: "holding_id,recorded_at" });
  }
  console.log("✓ Holdings + histórico");

  // ── Bienes ─────────────────────────────────────────────────
  const assets = [
    {
      name: "Toyota Corolla 2018", category: "auto", purchase_price: 18000, purchase_date: monthsAgo(48),
      currency: "USD", useful_life_months: 120, residual_pct: 0.25, maintenance_pct_annual: 0.04,
      replacement_horizon_months: 36, replacement_cost: 28000, current_value: 14500,
      car_segment: "popular", bought_used: true, savings_goal_mode: "calculated",
    },
    {
      name: "iPhone 15", category: "celular", purchase_price: 1100, purchase_date: monthsAgo(10),
      currency: "USD", useful_life_months: 36, residual_pct: 0.2, maintenance_pct_annual: 0.01,
      replacement_horizon_months: 24, replacement_cost: 1200, current_value: 850,
      savings_goal_mode: "manual", savings_goal_amount: 1200, savings_goal_months: 18,
    },
    {
      name: "Heladera Samsung", category: "heladera", purchase_price: 900, purchase_date: monthsAgo(24),
      currency: "USD", useful_life_months: 120, residual_pct: 0.1, maintenance_pct_annual: 0.02,
      replacement_horizon_months: 60, replacement_cost: 1100, current_value: 700,
      savings_goal_mode: "calculated",
    },
    {
      name: "Notebook MacBook Air", category: "notebook", purchase_price: 1400, purchase_date: monthsAgo(18),
      currency: "USD", useful_life_months: 48, residual_pct: 0.15, maintenance_pct_annual: 0.01,
      replacement_horizon_months: 30, replacement_cost: 1600, current_value: 1050,
      savings_goal_mode: "calculated",
    },
  ];

  for (const a of assets) {
    const { error } = await supabase.from("assets").insert({ user_id: userId, account_id: covering?.id ?? null, ...a });
    if (error) console.warn("  asset:", error.message);
  }
  console.log("✓ Bienes");

  // ── Metas de ahorro ────────────────────────────────────────
  const goals = [
    { name: "Viaje a Bariloche", target_amount: 800000, currency: "ARS", target_months: 8, account_id: pesosBBVA.id },
    { name: "Fondo emergencia 6 meses", target_amount: 3000000, currency: "ARS", target_months: 18, account_id: pesosBBVA.id },
    { name: "Entrada depto", target_amount: 15000, currency: "USD", target_months: 36, account_id: usdBBVA?.id ?? null },
    { name: "Curso de inglés", target_amount: 450000, currency: "ARS", target_months: 6, account_id: mpPesos.id },
  ];

  for (const g of goals) {
    const { data: goal, error } = await supabase.from("savings_goals").insert({
      user_id: userId,
      name: g.name,
      target_amount: g.target_amount,
      currency: g.currency,
      target_months: g.target_months,
      start_date: monthsAgo(2),
      account_id: g.account_id,
      archived: false,
    }).select("id").single();
    if (error) {
      console.warn("  goal:", error.message);
      continue;
    }
    // aportes
    const contrib = Math.round(g.target_amount * 0.12);
    await supabase.from("savings_contributions").insert({
      user_id: userId,
      goal_id: goal.id,
      asset_id: null,
      amount: contrib,
      currency: g.currency,
      account_id: g.account_id,
      date: daysAgo(20),
      note: "Aporte inicial demo",
    });
  }
  console.log("✓ Metas + aportes");

  // Resumen
  const counts = {};
  for (const t of ["accounts", "expenses", "incomes", "holdings", "assets", "savings_goals", "categories"]) {
    const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
    counts[t] = count;
  }
  console.log("\n✅ Demo lista. Totales en tu cuenta:");
  console.log(counts);
  console.log("\nAbrí http://localhost:3000 y explorá Inicio, Movimientos, Cuentas, Inversiones, Cuotas, Bienes y Metas.");
}

main().catch((err) => {
  console.error("\n❌", err.message || err);
  process.exit(1);
});
