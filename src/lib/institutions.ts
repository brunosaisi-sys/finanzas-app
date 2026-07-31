import type { AccountType, Currency } from "@/types";

export type InstitutionGroup = "banco" | "billetera" | "broker" | "efectivo" | "usd_reserva" | "credito";

export interface Institution {
  id: string;
  name: string;
  group: InstitutionGroup;
  dbType: AccountType;
  defaultCurrency: Currency;
}

// Para agregar un banco, billetera o broker en el futuro: agregar un objeto a este array.
// El resto de la UI se actualiza solo.
export const INSTITUTIONS: Institution[] = [
  // Bancos
  { id: "galicia", name: "Banco Galicia", group: "banco", dbType: "banco", defaultCurrency: "ARS" },
  { id: "nacion", name: "Banco Nación", group: "banco", dbType: "banco", defaultCurrency: "ARS" },
  { id: "santander", name: "Santander", group: "banco", dbType: "banco", defaultCurrency: "ARS" },
  { id: "bbva", name: "BBVA", group: "banco", dbType: "banco", defaultCurrency: "ARS" },
  { id: "macro", name: "Banco Macro", group: "banco", dbType: "banco", defaultCurrency: "ARS" },
  { id: "ciudad", name: "Banco Ciudad", group: "banco", dbType: "banco", defaultCurrency: "ARS" },
  { id: "provincia", name: "Banco Provincia (BAPRO)", group: "banco", dbType: "banco", defaultCurrency: "ARS" },
  { id: "icbc", name: "ICBC", group: "banco", dbType: "banco", defaultCurrency: "ARS" },
  { id: "patagonia", name: "Banco Patagonia", group: "banco", dbType: "banco", defaultCurrency: "ARS" },
  { id: "supervielle", name: "Supervielle", group: "banco", dbType: "banco", defaultCurrency: "ARS" },
  { id: "comafi", name: "Banco Comafi", group: "banco", dbType: "banco", defaultCurrency: "ARS" },
  { id: "hipotecario", name: "Banco Hipotecario", group: "banco", dbType: "banco", defaultCurrency: "ARS" },
  { id: "itau", name: "Itaú", group: "banco", dbType: "banco", defaultCurrency: "ARS" },
  { id: "brubank", name: "Brubank", group: "banco", dbType: "banco", defaultCurrency: "ARS" },
  { id: "openbank", name: "Openbank", group: "banco", dbType: "banco", defaultCurrency: "ARS" },
  // Billeteras virtuales
  { id: "mercadopago", name: "Mercado Pago", group: "billetera", dbType: "banco", defaultCurrency: "ARS" },
  { id: "uala", name: "Ualá", group: "billetera", dbType: "banco", defaultCurrency: "ARS" },
  { id: "personalpay", name: "Personal Pay", group: "billetera", dbType: "banco", defaultCurrency: "ARS" },
  { id: "naranjax", name: "Naranja X", group: "billetera", dbType: "banco", defaultCurrency: "ARS" },
  { id: "cuentadni", name: "Cuenta DNI", group: "billetera", dbType: "banco", defaultCurrency: "ARS" },
  { id: "modo", name: "MODO", group: "billetera", dbType: "banco", defaultCurrency: "ARS" },
  { id: "lemon", name: "Lemon Cash", group: "billetera", dbType: "banco", defaultCurrency: "ARS" },
  { id: "belo", name: "Belo", group: "billetera", dbType: "banco", defaultCurrency: "ARS" },
  { id: "prex", name: "Prex", group: "billetera", dbType: "banco", defaultCurrency: "ARS" },
  { id: "ripio", name: "Ripio", group: "billetera", dbType: "banco", defaultCurrency: "ARS" },
  { id: "bitso", name: "Bitso", group: "billetera", dbType: "banco", defaultCurrency: "ARS" },
  // Brokers / Inversiones
  { id: "cocos", name: "Cocos Capital", group: "broker", dbType: "inversion", defaultCurrency: "ARS" },
  { id: "iol", name: "InvertirOnline (IOL)", group: "broker", dbType: "inversion", defaultCurrency: "ARS" },
  { id: "balanz", name: "Balanz", group: "broker", dbType: "inversion", defaultCurrency: "ARS" },
  { id: "ppi", name: "Portfolio Personal (PPI)", group: "broker", dbType: "inversion", defaultCurrency: "ARS" },
  { id: "bullmarket", name: "Bull Market Brokers", group: "broker", dbType: "inversion", defaultCurrency: "ARS" },
  { id: "rava", name: "Rava Bursátil", group: "broker", dbType: "inversion", defaultCurrency: "ARS" },
  // Efectivo
  { id: "efectivo_ars", name: "Efectivo ARS", group: "efectivo", dbType: "efectivo", defaultCurrency: "ARS" },
  // Reservas USD
  { id: "dolares_billete", name: "Dólares billete", group: "usd_reserva", dbType: "usd_reserva", defaultCurrency: "USD" },
  // Tarjetas de crédito
  { id: "visa", name: "Visa", group: "credito", dbType: "credito", defaultCurrency: "ARS" },
  { id: "mastercard", name: "Mastercard", group: "credito", dbType: "credito", defaultCurrency: "ARS" },
  { id: "amex", name: "American Express", group: "credito", dbType: "credito", defaultCurrency: "ARS" },
  { id: "naranja", name: "Tarjeta Naranja", group: "credito", dbType: "credito", defaultCurrency: "ARS" },
];

export const INSTITUTION_GROUPS: { key: InstitutionGroup; label: string }[] = [
  { key: "banco", label: "Bancos" },
  { key: "billetera", label: "Billeteras virtuales" },
  { key: "broker", label: "Brokers / Inversiones" },
  { key: "efectivo", label: "Efectivo" },
  { key: "usd_reserva", label: "Dólares / Reservas" },
  // "credito" no aparece en el selector de nivel 1 — las tarjetas se agregan como
  // hijas de un banco desde el paso bank_config del wizard.
];

// Marcas de tarjetas disponibles para asociar a un banco durante la creación.
export const CREDIT_CARDS = INSTITUTIONS.filter((i) => i.group === "credito");
