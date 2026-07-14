import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync } from "fs";
import path from "path";

const BASE = "http://localhost:3000";

// Leer credenciales desde test-credentials.txt
const credsPath = path.join(process.cwd(), "test-credentials.txt");
const creds = Object.fromEntries(
  readFileSync(credsPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => l.split("=").map((s) => s.trim()))
);
const EMAIL = creds.EMAIL;
const PASSWORD = creds.PASSWORD;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

mkdirSync("screenshots", { recursive: true });

async function shot(name) {
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: false });
  console.log(`✓ ${name}.png`);
}

// ── Login ─────────────────────────────────────────────
await page.goto(BASE + "/login");
await page.waitForLoadState("networkidle");
await shot("01-login");

await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await shot("02-login-filled");
await page.click('button[type="submit"]');
await page.waitForURL(BASE + "/", { timeout: 10000 });
await page.waitForLoadState("networkidle");
await shot("03-dashboard");

// Verificar nav
const navText = await page.locator("nav").textContent();
console.log("Nav:", navText?.replace(/\s+/g, " ").trim());

// ── Bienes ────────────────────────────────────────────
await page.goto(BASE + "/bienes");
await page.waitForLoadState("networkidle");
await shot("04-bienes-lista");

await page.goto(BASE + "/bienes/nuevo");
await page.waitForLoadState("networkidle");
await shot("05-bienes-nuevo-vacio");

// Seleccionar categoría Smartphone
await page.selectOption("select:has(option[value='smartphone'])", "smartphone");
await page.waitForTimeout(400);
await shot("06-bienes-nuevo-smartphone");

// Completar nombre, fecha, precios
await page.fill('input[placeholder="ej: Heladera Samsung"]', "iPhone 14");
await page.fill('input[type="date"]', "2025-07-01");
// precio compra y costo reposición (primeros dos inputs numéricos)
const nums = page.locator('input[type="number"]');
await nums.nth(0).fill("800");
await nums.nth(1).fill("1000");
await page.waitForTimeout(600);
await shot("07-bienes-nuevo-preview");

// ── Ingresos nuevo ────────────────────────────────────
await page.goto(BASE + "/ingresos/nuevo");
await page.waitForLoadState("networkidle");
await shot("08-ingresos-nuevo");

// Completar monto
const montoInput = page.locator('input[type="number"]').first();
await montoInput.fill("500000");
await page.waitForTimeout(200);
await shot("09-ingresos-sueldo-completo");

// ── Regla de distribución ─────────────────────────────
await page.goto(BASE + "/ingresos/regla");
await page.waitForLoadState("networkidle");
await shot("10-ingresos-regla");

// ── Cuentas ───────────────────────────────────────────
await page.goto(BASE + "/cuentas");
await page.waitForLoadState("networkidle");
await shot("11-cuentas");

// ── Gastos ────────────────────────────────────────────
await page.goto(BASE + "/gastos");
await page.waitForLoadState("networkidle");
await shot("12-gastos");

await browser.close();
console.log("\nDone — screenshots en /screenshots");
