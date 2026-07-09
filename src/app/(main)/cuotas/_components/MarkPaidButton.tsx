"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MarkPaidButton({ installmentId }: { installmentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    setLoading(true);
    const supabase = createClient();
    await supabase
      .from("installments")
      .update({ paid: true, paid_date: new Date().toISOString().split("T")[0] })
      .eq("id", installmentId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handlePay}
      disabled={loading}
      className="text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 rounded-full px-3 py-1.5 transition-colors"
    >
      {loading ? "..." : "Pagada"}
    </button>
  );
}
