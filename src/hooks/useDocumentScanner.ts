import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { useAppMode } from "@/hooks/useAppMode";
import { toast } from "sonner";

export interface ScanResult {
  document_type: string | null;
  value: number | null;
  date: string | null;
  issuer: string | null;
  issuer_document: string | null;
  beneficiary: string | null;
  description: string | null;
  barcode: string | null;
  document_number: string | null;
  transaction_type: "revenue" | "expense";
  items: { description: string; value: number }[] | null;
  suggested_account_id: string | null;
  suggested_cost_center_id: string | null;
  classification_confidence: string | null;
}

export interface CreateOverrides {
  amount?: number;
  date?: string;
  description?: string;
  type?: string;
  status?: "confirmed" | "pending";
  account_id?: string;
  cost_center_id?: string;
  // PF fields
  pf_category_id?: string;
  pf_account_id?: string;
  pf_credit_card_id?: string;
}

export function useDocumentScanner() {
  const { company } = useCompany();
  const { user } = useAuth();
  const { isPersonal } = useAppMode();
  const queryClient = useQueryClient();

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [creating, setCreating] = useState(false);

  const scanDocument = async (file: File): Promise<ScanResult | null> => {
    setScanning(true);
    setResult(null);
    try {
      const base64 = await fileToBase64(file);
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-document`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          image_base64: base64,
          mimetype: file.type || "image/jpeg",
          company_id: isPersonal ? null : company?.id,
          mode: isPersonal ? "personal" : "business",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao processar" }));
        toast.error(err.error || "Erro ao analisar documento");
        return null;
      }

      const data = await res.json() as ScanResult;
      setResult(data);
      return data;
    } catch (e) {
      console.error("Scan error:", e);
      toast.error("Erro ao comunicar com o servidor");
      return null;
    } finally {
      setScanning(false);
    }
  };

  const createTransactionFromScan = async (
    scanData: ScanResult,
    overrides?: CreateOverrides,
  ) => {
    if (!user) return false;
    setCreating(true);
    try {
      const amount = overrides?.amount ?? scanData.value ?? 0;
      const date = overrides?.date ?? scanData.date ?? new Date().toISOString().split("T")[0];
      const txType = overrides?.type ?? scanData.transaction_type ?? "expense";
      const description = overrides?.description ?? scanData.description ?? "Documento escaneado";
      const status = overrides?.status ?? "confirmed";

      if (isPersonal) {
        const pfType = txType === "revenue" || txType === "receita" ? "receita" : "despesa";
        const insertData: any = {
          user_id: user.id,
          title: description,
          amount,
          date,
          type: pfType,
          source: "scanner",
          status,
          category_id: overrides?.pf_category_id || null,
        };
        // Credit card or account
        if (overrides?.pf_credit_card_id) {
          insertData.credit_card_id = overrides.pf_credit_card_id;
        } else if (overrides?.pf_account_id) {
          insertData.account_id = overrides.pf_account_id;
        }
        const { error } = await supabase.from("personal_transactions").insert(insertData);
        if (error) throw error;
      } else {
        if (!company) throw new Error("Empresa não selecionada");
        const pjType = txType === "receita" || txType === "revenue" ? "revenue" : "expense";
        const { error } = await supabase.from("transactions").insert({
          company_id: company.id,
          user_id: user.id,
          description,
          amount,
          date,
          type: pjType,
          source: "scanner",
          status,
          account_id: overrides?.account_id ?? scanData.suggested_account_id ?? null,
          cost_center_id: overrides?.cost_center_id ?? scanData.suggested_cost_center_id ?? null,
        });
        if (error) throw error;
      }

      toast.success(status === "pending" ? "Conta a pagar criada!" : "Lançamento criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: isPersonal ? ["personal_transactions"] : ["transactions"] });
      queryClient.invalidateQueries({ queryKey: isPersonal ? ["recent_scans_personal"] : ["recent_scans_company"] });
      if (status === "pending") {
        queryClient.invalidateQueries({ queryKey: ["personal_bills"] });
        queryClient.invalidateQueries({ queryKey: ["asaas_bills"] });
      }
      setResult(null);
      return true;
    } catch (e: any) {
      console.error("Create transaction error:", e);
      toast.error("Erro ao criar lançamento: " + (e.message || "Erro desconhecido"));
      return false;
    } finally {
      setCreating(false);
    }
  };

  const { data: recentScans = [] } = useQuery({
    queryKey: isPersonal
      ? ["recent_scans_personal", user?.id]
      : ["recent_scans_company", company?.id],
    queryFn: async () => {
      if (isPersonal) {
        if (!user?.id) return [];
        const { data } = await supabase
          .from("personal_transactions")
          .select("id, title, amount, date, type, status, created_at")
          .eq("user_id", user.id)
          .eq("source", "scanner")
          .order("created_at", { ascending: false })
          .limit(20);
        return (data || []).map((t) => ({
          id: t.id,
          description: t.title,
          amount: t.amount,
          date: t.date,
          type: t.type,
          status: t.status,
          created_at: t.created_at,
        }));
      }
      if (!company?.id) return [];
      const { data } = await supabase
        .from("transactions")
        .select("id, description, amount, date, type, status, created_at")
        .eq("company_id", company.id)
        .eq("source", "scanner")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: isPersonal ? !!user?.id : !!company?.id,
  });

  const clearResult = () => setResult(null);

  return {
    scanning,
    result,
    creating,
    recentScans,
    scanDocument,
    createTransactionFromScan,
    clearResult,
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
