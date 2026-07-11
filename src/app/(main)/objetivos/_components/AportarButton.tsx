"use client";

import { useState } from "react";
import AportarModal from "./AportarModal";
import type { Account, Currency } from "@/types";

interface Props {
  targetKind: "asset" | "goal";
  targetId: string;
  targetName: string;
  targetCurrency: Currency;
  destAccountId: string | null;
  suggestedAmount: number;
  accounts: Account[];
}

export default function AportarButton(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[11px] font-medium text-indigo-600"
      >
        Aportar
      </button>
      {open && (
        <AportarModal {...props} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
