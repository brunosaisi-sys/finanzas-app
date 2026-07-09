import { NextResponse } from "next/server";

const ARGENTINADATOS_URL =
  "https://api.argentinadatos.com/v1/finanzas/fci/mercadoDinero/ultimo";

export async function GET() {
  try {
    const res = await fetch(ARGENTINADATOS_URL, {
      next: { revalidate: 21600 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "API upstream error" }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
