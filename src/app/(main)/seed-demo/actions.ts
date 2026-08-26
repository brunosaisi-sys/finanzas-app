"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return isoDate(d);
}

function getInstallmentDueDates(
  expenseDateStr: string,
  count: number,
  closingDay?: number | null,
  dueDay?: number | null
): string[] {
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

type AccountRow = {
  id: string;
  name: string;
  type: string;
  currency: string;
  parent_id: string | null;
  closing_day: number | null;
  due_day: number | null;
};

async function createExpense(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  input: {
    amount: number;
    currency: string;
    categoryId: string | null;
    accountId: string | null;
    merchant: string | null;
    description: string | null;
    date: string;
    paymentMethod: string;
    installmentsTotal?: number;
    coveringAccountId?: string | null;
    fundingAccountId?: string | null;
    closingDay?: number | null;
    dueDay?: number | null;
    coveringCurrency?: string | null;
    participants?: { name: string; amount: number }[];
  }
) {
  const isCredito = input.paymentMethod === "credito";
  const cuotas = isCredito ? Math.max(1, input.installmentsTotal ?? 1) : 1;
  const installmentAmount = isCredito ? input.amount / cuotas : null;

  const p_expense = {
    user_id: userId,
    amount: input.amount,
    currency: input.currency,
    category_id: input.categoryId ?? "",
    account_id: input.accountId ?? "",
    merchant: input.merchant ?? null,
    description: input.description ?? null,
    date: input.date,
    source: "app",
    payment_method: input.paymentMethod,
    installments_total: isCredito ? String(cuotas) : "",
    installment_amount: installmentAmount != null ? String(installmentAmount) : "",
    covering_account_id:
      isCredito && input.coveringAccountId ? input.coveringAccountId : "",
    funding_account_id:
      isCredito && input.coveringAccountId && input.fundingAccountId
        ? input.fundingAccountId
        : "",
  };

  const p_installments = isCredito
    ? getInstallmentDueDates(input.date, cuotas, input.closingDay, input.dueDay).map(
        (due, i) => ({
          installment_number: i + 1,
          amount: installmentAmount!,
          due_date: due,
        })
      )
    : [];

  let p_earmark: object | null = null;
  if (isCredito && input.coveringAccountId) {
    const last = p_installments.at(-1)?.due_date ?? "";
    p_earmark = {
      user_id: userId,
      account_id: input.coveringAccountId,
      amount: input.amount,
      currency: input.coveringCurrency ?? input.currency,
      reason: `Cuotas: ${input.merchant ?? input.description ?? "gasto"} (${cuotas}x)`,
      release_date: last,
    };
  }

  const { data, error } = await supabase.rpc("create_expense_with_balance", {
    p_expense,
    p_installments,
    p_earmark,
  });
  if (error) throw new Error(`Gasto ${input.merchant}: ${error.message}`);

  if (input.participants && input.participants.length > 0) {
    await supabase.from("expense_participants").insert(
      input.participants.map((p) => ({
        expense_id: data,
        name: p.name,
        amount: p.amount,
      }))
    );
  }
  return data as string;
}

export async function seedDemoData(): Promise<{ ok: true; summary: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado. Entrá con Google primero." };

  const userId = user.id;
  const logs: string[] = [];

  try {
    // Categorías
    const catDefs = [
      ["Supermercado", "🛒"],
      ["Transporte", "🚌"],
      ["Alquiler", "🏠"],
      ["Salud y Farmacia", "💊"],
      ["Nafta", "⛽"],
      ["Delivery y Restaurantes", "🍕"],
      ["Servicios", "💡"],
      ["Ropa", "👕"],
      ["Entretenimiento", "🎬"],
      ["Telefonía e Internet", "📱"],
      ["Viajes", "✈️"],
      ["Educación", "📚"],
    ] as const;
    const { data: existingCats } = await supabase.from("categories").select("id, name");
    const catByName = new Map((existingCats ?? []).map((c) => [c.name, c.id]));
    for (const [name, icon] of catDefs) {
      if (catByName.has(name)) continue;
      const { data, error } = await supabase
        .from("categories")
        .insert({ user_id: userId, name, icon })
        .select("id")
        .single();
      if (error) throw error;
      catByName.set(name, data.id);
    }
    logs.push(`categorías ${catByName.size}`);

    // Cuentas
    const { data: existingAccounts } = await supabase.from("accounts").select("*");
    const hasSeed = (existingAccounts ?? []).some(
      (a) => a.name === "BBVA" || a.name === "Cocos Capital"
    );

    if (!hasSeed) {
      const { error: e1 } = await supabase.rpc("create_account_with_children", {
        p_parent: {
          name: "BBVA",
          type: "banco",
          currency: "ARS",
          balance: 0,
          earns_yield: false,
        },
        p_children: [
          { name: "Pesos", type: "banco", currency: "ARS", balance: 850000, earns_yield: false },
          { name: "Dólares", type: "banco", currency: "USD", balance: 1200, earns_yield: false },
          {
            name: "Visa",
            type: "credito",
            currency: "ARS",
            balance: 0,
            earns_yield: false,
            closing_day: 7,
            due_day: 18,
          },
        ],
      });
      if (e1) throw new Error(`BBVA: ${e1.message}`);

      const { error: e2 } = await supabase.rpc("create_account_with_children", {
        p_parent: {
          name: "Galicia",
          type: "banco",
          currency: "ARS",
          balance: 0,
          earns_yield: false,
        },
        p_children: [
          {
            name: "Caja de ahorro",
            type: "banco",
            currency: "ARS",
            balance: 420000,
            earns_yield: false,
          },
          {
            name: "Mastercard",
            type: "credito",
            currency: "ARS",
            balance: 0,
            earns_yield: false,
            closing_day: 12,
            due_day: 22,
          },
        ],
      });
      if (e2) throw new Error(`Galicia: ${e2.message}`);

      const { error: e3 } = await supabase.rpc("create_account_with_children", {
        p_parent: {
          name: "Cocos Capital",
          type: "inversion",
          currency: "ARS",
          balance: 0,
          earns_yield: true,
        },
        p_children: [
          { name: "Fondos", type: "inversion", currency: "ARS", balance: 0, earns_yield: true },
          { name: "CEDEARs", type: "inversion", currency: "ARS", balance: 0, earns_yield: false },
        ],
      });
      if (e3) throw new Error(`Cocos: ${e3.message}`);

      const { error: e4 } = await supabase.rpc("create_account_with_children", {
        p_parent: {
          name: "Mercado Pago",
          type: "banco",
          currency: "ARS",
          balance: 0,
          earns_yield: true,
        },
        p_children: [
          { name: "Pesos", type: "banco", currency: "ARS", balance: 185000, earns_yield: true },
        ],
      });
      if (e4) throw new Error(`MP: ${e4.message}`);

      await supabase.from("accounts").insert([
        {
          user_id: userId,
          name: "Efectivo",
          type: "efectivo",
          currency: "ARS",
          balance: 45000,
          earns_yield: false,
        },
        {
          user_id: userId,
          name: "Caja fuerte USD",
          type: "usd_reserva",
          currency: "USD",
          balance: 2500,
          earns_yield: false,
        },
      ]);
      logs.push("cuentas nuevas");
    } else {
      logs.push("cuentas existentes reutilizadas");
    }

    const { data: accountsRaw } = await supabase.from("accounts").select("*");
    const accounts = (accountsRaw ?? []) as AccountRow[];
    const parentName = (a: AccountRow) =>
      accounts.find((p) => p.id === a.parent_id)?.name ?? null;

    const pesosBBVA =
      accounts.find((a) => a.name === "Pesos" && a.currency === "ARS" && parentName(a) === "BBVA") ??
      accounts.find((a) => a.name === "Pesos" && a.currency === "ARS");
    const usdBBVA = accounts.find((a) => a.name === "Dólares" && a.currency === "USD");
    const visa = accounts.find((a) => a.name === "Visa" && a.type === "credito");
    const mastercard = accounts.find((a) => a.name === "Mastercard" && a.type === "credito");
    const galiciaCA = accounts.find((a) => a.name === "Caja de ahorro");
    const cocosFondos = accounts.find((a) => a.name === "Fondos");
    const cocosCedears = accounts.find((a) => a.name === "CEDEARs");
    const mpPesos =
      accounts.find((a) => a.name === "Pesos" && parentName(a) === "Mercado Pago") ?? pesosBBVA;
    const cash = accounts.find((a) => a.name === "Efectivo") ?? pesosBBVA;
    const covering = cocosFondos ?? pesosBBVA;

    if (!pesosBBVA || !visa) {
      return { error: "No encontré cuentas Pesos/Visa para sembrar gastos." };
    }

    // Ingresos
    for (const inc of [
      {
        amount: 1850000,
        currency: "ARS",
        type: "sueldo",
        date: daysAgo(25),
        account_id: pesosBBVA.id,
        note: "Sueldo mes anterior",
      },
      {
        amount: 1850000,
        currency: "ARS",
        type: "sueldo",
        date: daysAgo(5),
        account_id: pesosBBVA.id,
        note: "Sueldo este mes",
      },
      {
        amount: 320000,
        currency: "ARS",
        type: "freelance",
        date: daysAgo(12),
        account_id: mpPesos!.id,
        note: "Proyecto freelance",
      },
      {
        amount: 450,
        currency: "USD",
        type: "otro",
        date: daysAgo(18),
        account_id: usdBBVA?.id ?? pesosBBVA.id,
        note: "Reembolso viaje",
      },
    ]) {
      const { error } = await supabase.rpc("create_income_with_balance", {
        p_amount: inc.amount,
        p_currency: inc.currency,
        p_type: inc.type,
        p_account_id: inc.account_id,
        p_date: inc.date,
        p_note: inc.note,
      });
      if (error) throw new Error(`Ingreso: ${error.message}`);
    }
    logs.push("ingresos");

    // Gastos débito
    const debitExpenses = [
      { amount: 87500.5, cat: "Supermercado", account: pesosBBVA, merchant: "Coto", days: 2, method: "debito" },
      { amount: 42300, cat: "Supermercado", account: mpPesos!, merchant: "Carrefour", days: 8, method: "debito" },
      { amount: 18500, cat: "Nafta", account: pesosBBVA, merchant: "YPF", days: 3, method: "debito" },
      { amount: 9200, cat: "Delivery y Restaurantes", account: mpPesos!, merchant: "PedidosYa", days: 1, method: "debito" },
      { amount: 14500, cat: "Delivery y Restaurantes", account: cash!, merchant: "Parrilla Don Julio", days: 6, method: "efectivo" },
      { amount: 28000, cat: "Telefonía e Internet", account: pesosBBVA, merchant: "Personal", days: 10, method: "debito" },
      { amount: 65000, cat: "Servicios", account: galiciaCA ?? pesosBBVA, merchant: "EDENOR", days: 14, method: "debito" },
      { amount: 22000, cat: "Transporte", account: mpPesos!, merchant: "Uber", days: 4, method: "debito" },
      { amount: 38000, cat: "Salud y Farmacia", account: pesosBBVA, merchant: "Farmacity", days: 9, method: "debito" },
      { amount: 450000, cat: "Alquiler", account: pesosBBVA, merchant: "Alquiler depto", days: 20, method: "debito" },
      { amount: 18900, cat: "Entretenimiento", account: pesosBBVA, merchant: "Spotify+Netflix", days: 11, method: "debito" },
      { amount: 89000, cat: "Ropa", account: pesosBBVA, merchant: "Zara", days: 16, method: "debito" },
    ] as const;

    for (const e of debitExpenses) {
      await createExpense(supabase, userId, {
        amount: e.amount,
        currency: "ARS",
        categoryId: catByName.get(e.cat) ?? null,
        accountId: e.account.id,
        merchant: e.merchant,
        description: null,
        date: daysAgo(e.days),
        paymentMethod: e.method,
      });
    }

    await createExpense(supabase, userId, {
      amount: 48000,
      currency: "ARS",
      categoryId: catByName.get("Delivery y Restaurantes") ?? null,
      accountId: pesosBBVA.id,
      merchant: "Asado con amigos",
      description: "Gasto compartido",
      date: daysAgo(3),
      paymentMethod: "debito",
      participants: [
        { name: "Martín", amount: 16000 },
        { name: "Lucía", amount: 16000 },
      ],
    });
    logs.push("gastos + compartido");

    // Cuotas
    for (const c of [
      { amount: 360000, merchant: "Frávega — Heladera", cuotas: 12, days: 40, card: visa, cat: "Servicios" },
      { amount: 180000, merchant: "Garbarino — Aire", cuotas: 6, days: 25, card: visa, cat: "Servicios" },
      { amount: 96000, merchant: "Musimundo — Auriculares", cuotas: 3, days: 10, card: mastercard ?? visa, cat: "Entretenimiento" },
      { amount: 240000, merchant: "Despegar — Pasajes", cuotas: 6, days: 15, card: visa, cat: "Viajes" },
      { amount: 75000, merchant: "Nike Store", cuotas: 3, days: 5, card: mastercard ?? visa, cat: "Ropa" },
    ]) {
      const card = c.card;
      if (!card) continue;
      await createExpense(supabase, userId, {
        amount: c.amount,
        currency: "ARS",
        categoryId: catByName.get(c.cat) ?? null,
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
        coveringCurrency: "ARS",
      });
    }
    logs.push("cuotas");

    // FCI
    if (cocosFondos) {
      const { error: fciErr } = await supabase.rpc("create_and_link_fci_holding", {
        p_account_id: cocosFondos.id,
        p_name: "Cocos Rendimiento - Clase A",
        p_quantity: 8500,
        p_price: 1250.5,
        p_currency: "ARS",
        p_purchase_date: monthsAgo(4),
      });
      if (fciErr) logs.push(`FCI aviso: ${fciErr.message}`);
    }

    // Holdings
    for (const h of [
      { name: "Apple", ticker: "AAPL", type: "cedear", qty: 12, buy: 18500, cur: 24800 },
      { name: "SPDR S&P 500", ticker: "SPY", type: "cedear", qty: 8, buy: 22000, cur: 20410 },
      { name: "MercadoLibre", ticker: "MELI", type: "cedear", qty: 3, buy: 420000, cur: 510000 },
      { name: "Coca-Cola", ticker: "KO", type: "cedear", qty: 25, buy: 9800, cur: 11200 },
      { name: "Al30", ticker: "AL30", type: "bono", qty: 100, buy: 68.5, cur: 72.1 },
    ]) {
      if (!cocosCedears) break;
      const { data: holding, error } = await supabase
        .from("holdings")
        .insert({
          user_id: userId,
          account_id: cocosCedears.id,
          name: h.name,
          ticker: h.ticker,
          asset_type: h.type,
          quantity: h.qty,
          avg_buy_price: h.buy,
          currency: "ARS",
          current_price: h.cur,
          purchase_date: monthsAgo(3),
          notes: "seed-demo",
        })
        .select("id")
        .single();
      if (error || !holding) continue;
      const hist = [40, 25, 10, 0].map((d, i) => ({
        holding_id: holding.id,
        price: h.buy + ((h.cur - h.buy) * i) / 3,
        recorded_at: daysAgo(d),
      }));
      await supabase.from("holding_price_history").upsert(hist, {
        onConflict: "holding_id,recorded_at",
      });
    }
    logs.push("inversiones");

    // Bienes
    for (const a of [
      {
        name: "Toyota Corolla 2018",
        category: "auto",
        purchase_price: 18000,
        purchase_date: monthsAgo(48),
        currency: "USD",
        useful_life_months: 120,
        residual_pct: 0.25,
        maintenance_pct_annual: 0.04,
        replacement_horizon_months: 36,
        replacement_cost: 28000,
        current_value: 14500,
        car_segment: "popular",
        bought_used: true,
        savings_goal_mode: "calculated",
      },
      {
        name: "iPhone 15",
        category: "celular",
        purchase_price: 1100,
        purchase_date: monthsAgo(10),
        currency: "USD",
        useful_life_months: 36,
        residual_pct: 0.2,
        maintenance_pct_annual: 0.01,
        replacement_horizon_months: 24,
        replacement_cost: 1200,
        current_value: 850,
        savings_goal_mode: "manual",
        savings_goal_amount: 1200,
        savings_goal_months: 18,
      },
      {
        name: "Heladera Samsung",
        category: "heladera",
        purchase_price: 900,
        purchase_date: monthsAgo(24),
        currency: "USD",
        useful_life_months: 120,
        residual_pct: 0.1,
        maintenance_pct_annual: 0.02,
        replacement_horizon_months: 60,
        replacement_cost: 1100,
        current_value: 700,
        savings_goal_mode: "calculated",
      },
      {
        name: "Notebook MacBook Air",
        category: "notebook",
        purchase_price: 1400,
        purchase_date: monthsAgo(18),
        currency: "USD",
        useful_life_months: 48,
        residual_pct: 0.15,
        maintenance_pct_annual: 0.01,
        replacement_horizon_months: 30,
        replacement_cost: 1600,
        current_value: 1050,
        savings_goal_mode: "calculated",
      },
    ]) {
      const { error } = await supabase.from("assets").insert({
        user_id: userId,
        account_id: covering?.id ?? null,
        ...a,
      });
      if (error) throw new Error(`Bien: ${error.message}`);
    }
    logs.push("bienes");

    // Metas
    for (const g of [
      { name: "Viaje a Bariloche", target_amount: 800000, currency: "ARS", target_months: 8, account_id: pesosBBVA.id },
      { name: "Fondo emergencia 6 meses", target_amount: 3000000, currency: "ARS", target_months: 18, account_id: pesosBBVA.id },
      { name: "Entrada depto", target_amount: 15000, currency: "USD", target_months: 36, account_id: usdBBVA?.id ?? null },
      { name: "Curso de inglés", target_amount: 450000, currency: "ARS", target_months: 6, account_id: mpPesos!.id },
    ]) {
      const { data: goal, error } = await supabase
        .from("savings_goals")
        .insert({
          user_id: userId,
          name: g.name,
          target_amount: g.target_amount,
          currency: g.currency,
          target_months: g.target_months,
          start_date: monthsAgo(2),
          account_id: g.account_id,
          archived: false,
        })
        .select("id")
        .single();
      if (error || !goal) throw new Error(`Meta: ${error?.message}`);
      await supabase.from("savings_contributions").insert({
        user_id: userId,
        goal_id: goal.id,
        asset_id: null,
        amount: Math.round(g.target_amount * 0.12),
        currency: g.currency,
        account_id: g.account_id,
        date: daysAgo(20),
        note: "Aporte inicial",
      });
    }
    logs.push("metas");

    // Grupos familiares / amigos / trabajo (migración 030)
    const { data: existingGroups, error: gListErr } = await supabase
      .from("share_groups")
      .select("id")
      .limit(1);
    if (gListErr) {
      logs.push("grupos: falta migración 030");
    } else if ((existingGroups ?? []).length === 0) {
      const defaults = [
        { name: "Familiares", icon: "👨‍👩‍👧‍👦", members: ["Mamá", "Papá", "Hermana", "Cuñado"] },
        { name: "Amigos", icon: "🍻", members: ["Martín", "Lucía", "Sofía"] },
        { name: "Trabajo", icon: "💼", members: ["Ana", "Diego"] },
      ];
      for (const g of defaults) {
        const { data: group, error: gErr } = await supabase
          .from("share_groups")
          .insert({ user_id: userId, name: g.name, icon: g.icon })
          .select("id")
          .single();
        if (gErr || !group) continue;
        await supabase.from("share_group_members").insert(
          g.members.map((m) => ({ group_id: group.id, name: m }))
        );
      }
      logs.push("grupos Familiares/Amigos/Trabajo");

      // Gastos compartidos tipicos usando esos nombres
      await createExpense(supabase, userId, {
        amount: 125000,
        currency: "ARS",
        categoryId: catByName.get("Delivery y Restaurantes") ?? null,
        accountId: pesosBBVA.id,
        merchant: "Asado familiar",
        description: "Grupo Familiares",
        date: daysAgo(7),
        paymentMethod: "debito",
        participants: [
          { name: "Mamá", amount: 25000 },
          { name: "Papá", amount: 25000 },
          { name: "Hermana", amount: 25000 },
          { name: "Cuñado", amount: 25000 },
        ],
      });
      await createExpense(supabase, userId, {
        amount: 60000,
        currency: "ARS",
        categoryId: catByName.get("Entretenimiento") ?? null,
        accountId: pesosBBVA.id,
        merchant: "Cine con amigos",
        description: "Grupo Amigos",
        date: daysAgo(2),
        paymentMethod: "debito",
        participants: [
          { name: "Martín", amount: 20000 },
          { name: "Lucía", amount: 20000 },
        ],
      });
      if (visa) {
        await createExpense(supabase, userId, {
          amount: 180000,
          currency: "ARS",
          categoryId: catByName.get("Viajes") ?? null,
          accountId: visa.id,
          merchant: "Airbnb fin de semana",
          description: "Cuotas compartidas — Familiares",
          date: daysAgo(12),
          paymentMethod: "credito",
          installmentsTotal: 3,
          coveringAccountId: covering?.id ?? null,
          fundingAccountId: pesosBBVA.id,
          closingDay: visa.closing_day,
          dueDay: visa.due_day,
          coveringCurrency: "ARS",
          participants: [
            { name: "Hermana", amount: 60000 },
            { name: "Cuñado", amount: 60000 },
          ],
        });
      }
      logs.push("gastos de grupos");
    } else {
      logs.push("grupos ya existían");
    }

    revalidatePath("/");
    revalidatePath("/movimientos");
    revalidatePath("/cuentas");
    revalidatePath("/inversiones");
    revalidatePath("/cuotas");
    revalidatePath("/bienes");
    revalidatePath("/objetivos");
    revalidatePath("/compartidos");
    revalidatePath("/grupos");

    return { ok: true, summary: logs.join(" · ") };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
