import { groupFundsForInstitution, findFciInstitutionForAccountName } from "./fciCatalog";

const RAW = [
  { fondo: "Cocos Rendimiento - Clase A", vcp: 11405.456, fecha: "2026-07-21", patrimonio: 278525020942, categoria: "rentaMixta" as const },
  { fondo: "Cocos Rendimiento - Clase B", vcp: 11459.439, fecha: "2026-07-21", patrimonio: 1000000, categoria: "rentaMixta" as const },
  { fondo: "Cocos Rendimiento - Clase C", vcp: 1000, fecha: "2026-07-21", patrimonio: 0, categoria: "rentaMixta" as const },
  { fondo: "Cocos Ahorro - Clase A", vcp: 5000, fecha: "2026-07-21", patrimonio: 500, categoria: "mercadoDinero" as const },
  { fondo: "Cocos Ahorro Dólares - Clase A", vcp: 100, fecha: "2026-07-21", patrimonio: 200, categoria: "mercadoDinero" as const },
  // Falso positivo a evitar: "Multimercado" NO empieza con "mercado" -> no debe matchear mercadopago
  { fondo: "Consultatio Multimercado I - Clase A", vcp: 200, fecha: "2026-07-21", patrimonio: 999999, categoria: "rentaMixta" as const },
  { fondo: "Mercado Fondo - Clase A", vcp: 15, fecha: "2026-07-21", patrimonio: 50000000, categoria: "mercadoDinero" as const },
  { fondo: "Balanz Money Market USD - Clase A", vcp: 1.2, fecha: "2026-07-21", patrimonio: 3000, categoria: "mercadoDinero" as const },
];

describe("groupFundsForInstitution", () => {
  it("agrupa clases del mismo fondo y elige la de mayor patrimonio (descartando patrimonio=0)", () => {
    const groups = groupFundsForInstitution(RAW, "cocos");
    const rendimiento = groups.find((g) => g.fundFamily === "Cocos Rendimiento");
    expect(rendimiento).toBeDefined();
    // Clase A tiene mayor patrimonio que B; Clase C (patrimonio=0) se descarta
    expect(rendimiento!.representativeName).toBe("Cocos Rendimiento - Clase A");
    expect(rendimiento!.risk).toBe("Medio"); // rentaMixta
  });

  it("no matchea 'Multimercado' como fondo de Mercado Pago (evita falso positivo por substring)", () => {
    const groups = groupFundsForInstitution(RAW, "mercadopago");
    const families = groups.map((g) => g.fundFamily);
    expect(families).toEqual(["Mercado Fondo"]);
    expect(families).not.toContain("Consultatio Multimercado I");
  });

  it("detecta moneda USD por nombre del fondo", () => {
    const groups = groupFundsForInstitution(RAW, "cocos");
    const ahorroDolares = groups.find((g) => g.fundFamily === "Cocos Ahorro Dólares");
    expect(ahorroDolares!.currency).toBe("USD");
    const ahorro = groups.find((g) => g.fundFamily === "Cocos Ahorro");
    expect(ahorro!.currency).toBe("ARS");
  });

  it("devuelve vacío para institución sin catálogo verificado", () => {
    expect(groupFundsForInstitution(RAW, "galicia")).toEqual([]);
  });

  it("ordena por patrimonio descendente", () => {
    const groups = groupFundsForInstitution(RAW, "cocos");
    const patrimonios = groups.map((g) => g.patrimonio);
    expect(patrimonios).toEqual([...patrimonios].sort((a, b) => b - a));
  });
});

describe("findFciInstitutionForAccountName", () => {
  it("reconoce las 5 instituciones verificadas por nombre de cuenta", () => {
    expect(findFciInstitutionForAccountName("Cocos Capital")).toBe("cocos");
    expect(findFciInstitutionForAccountName("Mercado Pago")).toBe("mercadopago");
    expect(findFciInstitutionForAccountName("Balanz")).toBe("balanz");
    expect(findFciInstitutionForAccountName("Bull Market Brokers")).toBe("bullmarket");
    expect(findFciInstitutionForAccountName("InvertirOnline (IOL)")).toBe("iol");
  });

  it("devuelve null para instituciones sin catálogo (ej. bancos tradicionales)", () => {
    expect(findFciInstitutionForAccountName("Banco Galicia")).toBeNull();
    expect(findFciInstitutionForAccountName("Visa Test SD")).toBeNull();
  });

  it("matchea subcuentas con sufijo (ej. bolsillos)", () => {
    expect(findFciInstitutionForAccountName("Cocos Capital — Pesos")).toBe("cocos");
  });

  it("matchea un bolsillo de nombre genérico solo si se le pasa la cadena de ancestros completa", () => {
    // Bug reportado: un bolsillo llamado "Fondos" (no "Cocos Fondos") cuelga de
    // "Cocos Capital". El nombre propio solo ("Fondos") no debe matchear nada —
    // hace falta el string ya armado con accountDisplayName ("Cocos Capital — Fondos").
    expect(findFciInstitutionForAccountName("Fondos")).toBeNull();
    expect(findFciInstitutionForAccountName("Cocos Capital — Fondos")).toBe("cocos");
    expect(findFciInstitutionForAccountName("Mercado Pago — Fondos")).toBe("mercadopago");
  });
});
