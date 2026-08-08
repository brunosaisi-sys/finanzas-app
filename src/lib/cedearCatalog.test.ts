import { findCedearQuote, type CedearQuote } from "./cedearCatalog";

const quotes: CedearQuote[] = [
  { symbol: "AAPL", price: 24800, currency: "ARS", pctChange: 0.77 },
  { symbol: "AAPLC", price: 15.69, currency: "ARS", pctChange: -0.63 },
  { symbol: "AAPLD", price: 16.3, currency: "ARS", pctChange: 0.61 },
  { symbol: "GGAL", price: 5200, currency: "ARS", pctChange: 1.2 },
];

describe("findCedearQuote", () => {
  test("matchea por ticker exacto, sin importar mayúsculas/minúsculas", () => {
    expect(findCedearQuote(quotes, "aapl")).toEqual(quotes[0]);
    expect(findCedearQuote(quotes, "AAPL")).toEqual(quotes[0]);
  });

  test("no colapsa variantes con sufijo — cada símbolo es un instrumento distinto", () => {
    expect(findCedearQuote(quotes, "AAPLC")).toEqual(quotes[1]);
    expect(findCedearQuote(quotes, "AAPLD")).toEqual(quotes[2]);
    expect(findCedearQuote(quotes, "AAPL")?.price).not.toBe(
      findCedearQuote(quotes, "AAPLC")?.price
    );
  });

  test("no hace match parcial: 'AAPL' no matchea buscando 'AA'", () => {
    expect(findCedearQuote(quotes, "AA")).toBeNull();
  });

  test("retorna null si no hay match", () => {
    expect(findCedearQuote(quotes, "INEXISTENTE")).toBeNull();
  });

  test("retorna null con ticker vacío o solo espacios", () => {
    expect(findCedearQuote(quotes, "")).toBeNull();
    expect(findCedearQuote(quotes, "   ")).toBeNull();
  });

  test("tolera espacios alrededor del ticker", () => {
    expect(findCedearQuote(quotes, "  GGAL  ")).toEqual(quotes[3]);
  });
});
