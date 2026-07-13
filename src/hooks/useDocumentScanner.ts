import { edgeAuthHeaders, edgeUrl } from "@/lib/edge";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface ScanResult {
  document_type: string | null;
  value: number | null;
  date: string | null;
  issuer: string | null;
  issuer_document: string | null;
  beneficiary: string | null;
  beneficiary_document: string | null;
  description: string | null;
  barcode: string | null;
  document_number: string | null;
  transaction_type: "revenue" | "expense";
  items: { description: string; value: number }[] | null;
  suggested_account_id: string | null;
  suggested_cost_center_id: string | null;
  suggested_bank_account_id: string | null;
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
  bank_account_id?: string;
}

function cleanDocument(doc: string): string {
  return doc.replace(/[.\-\/\s]/g, "");
}

function detectPersonType(doc: string): "pf" | "pj" {
  const clean = cleanDocument(doc);
  return clean.length <= 11 ? "pf" : "pj";
}

export function useDocumentScanner() {
  const { company } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [batchResults, setBatchResults] = useState<{ file: string; result: ScanResult | null; error?: string }[]>([]);
  const [batchProcessing, setBatchProcessing] = useState(false);

  const scanDocument = async (file: File): Promise<ScanResult | null> => {
    setScanning(true);
    setResult(null);
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch(edgeUrl("ocr-document"), {
        method: "POST",
        headers: await edgeAuthHeaders(),
        body: JSON.stringify({
          image_base64: base64,
          mimetype: file.type || "image/jpeg",
          company_id: company?.id,
          mode: "business",
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

  const scanBatch = async (files: File[]) => {
    setBatchProcessing(true);
    setBatchResults([]);
    const results: { file: string; result: ScanResult | null; error?: string }[] = [];

    for (const file of files) {
      try {
        const base64 = await fileToBase64(file);
        const res = await fetch(edgeUrl("ocr-document"), {
          method: "POST",
          headers: await edgeAuthHeaders(),
          body: JSON.stringify({
            image_base64: base64,
            mimetype: file.type || "image/jpeg",
            company_id: company?.id,
            mode: "business",
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Erro" }));
          results.push({ file: file.name, result: null, error: err.error || "Erro ao processar" });
        } else {
          const data = await res.json() as ScanResult;
          results.push({ file: file.name, result: data });
        }
      } catch (e: any) {
        results.push({ file: file.name, result: null, error: e.message || "Erro" });
      }
      setBatchResults([...results]);
    }

    setBatchProcessing(false);
    toast.success(`${results.filter(r => r.result).length} de ${files.length} documentos processados`);
    return results;
  };

  const uploadAndAttach = async (file: File, transactionId: string): Promise<string | null> => {
    if (!user || !company) return null;
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${company.id}/${transactionId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, file, { upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return null;
      }

      const attachmentUrl = path;
      await supabase.from("transactions")
        .update({ attachment_url: attachmentUrl })
        .eq("id", transactionId);

      return attachmentUrl;
    } catch (e) {
      console.error("Upload attach error:", e);
      return null;
    }
  };

  /** Find or create contact based on scan data */
  const findOrCreateContact = async (
    scanData: ScanResult,
    txType: string,
  ): Promise<string | null> => {
    if (!company) return null;

    // Determine which entity is the contact
    // Revenue (NF emitida) → beneficiary is the client
    // Expense → issuer is the supplier
    const isRevenue = txType === "revenue";
    const contactName = isRevenue ? scanData.beneficiary : scanData.issuer;
    const contactDoc = isRevenue ? scanData.beneficiary_document : scanData.issuer_document;

    if (!contactDoc && !contactName) return null;

    const cleanDoc = contactDoc ? cleanDocument(contactDoc) : null;

    // Try to find existing contact by document
    if (cleanDoc) {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("company_id", company.id)
        .ilike("document", `%${cleanDoc}%`)
        .limit(1);

      if (existing && existing.length > 0) {
        return existing[0].id;
      }
    }

    // Auto-create contact
    if (!contactName) return null;

    const { data: created, error } = await supabase
      .from("contacts")
      .insert({
        company_id: company.id,
        name: contactName,
        document: contactDoc || null,
        type: isRevenue ? "customer" : "supplier",
        person_type: contactDoc ? detectPersonType(contactDoc) : "pj",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Auto-create contact error:", error);
      return null;
    }

    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    return created?.id || null;
  };

  /** Create invoice record for revenue NFs */
  const createInvoiceRecord = async (
    scanData: ScanResult,
    contactId: string | null,
    amount: number,
    date: string,
    description: string,
  ) => {
    if (!company) return;
    const docType = scanData.document_type;
    if (docType !== "nota_fiscal" && docType !== "nfse") return;

    const { error } = await supabase.from("invoices").insert({
      company_id: company.id,
      contact_id: contactId,
      type: docType === "nfse" ? "nfse" : "nfe",
      status: "authorized",
      number: scanData.document_number || null,
      issue_date: date,
      total: amount,
      notes: description,
    });

    if (error) {
      console.error("Auto-create invoice error:", error);
    } else {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    }
  };

  const createTransactionFromScan = async (
    scanData: ScanResult,
    overrides?: CreateOverrides,
    file?: File,
  ) => {
    if (!user || !company) return false;
    setCreating(true);
    try {
      const amount = overrides?.amount ?? scanData.value ?? 0;
      const date = overrides?.date ?? scanData.date ?? new Date().toISOString().split("T")[0];
      const txType = overrides?.type ?? scanData.transaction_type ?? "expense";
      const description = overrides?.description ?? scanData.description ?? "Documento escaneado";
      const status = overrides?.status ?? "confirmed";

      const pjType = txType === "receita" || txType === "revenue" ? "revenue" : "expense";

      // Auto-register contact
      const contactId = await findOrCreateContact(scanData, pjType);

      const { data: inserted, error } = await supabase.from("transactions").insert({
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
        bank_account_id: overrides?.bank_account_id ?? scanData.suggested_bank_account_id ?? null,
      }).select("id").single();
      if (error) throw error;

      // Upload file to storage and link
      if (file && inserted?.id) {
        await uploadAndAttach(file, inserted.id);
      }

      // Auto-create invoice for revenue NFs
      if (pjType === "revenue") {
        await createInvoiceRecord(scanData, contactId, amount, date, description);
      }

      // Auto-create bill_payable for boletos
      if (scanData.document_type === "boleto" && pjType === "expense") {
        await supabase.from("bills_payable").insert({
          company_id: company.id,
          fornecedor: scanData.issuer || "Fornecedor não identificado",
          descricao: description,
          valor: amount,
          vencimento: date,
          status: "a_vencer",
          source: "ocr",
          contact_id: contactId,
        });
        queryClient.invalidateQueries({ queryKey: ["bills_payable"] });
      }

      // Auto-create tax_guide for scanned tax documents (DAS, DARF, ISS, etc.)
      const taxDocTypes = ["boleto"];
      const taxKeywords = ["das", "darf", "iss", "icms", "pis", "cofins", "inss", "guia"];
      const descLower = description.toLowerCase();
      const isTaxGuide = taxKeywords.some(k => descLower.includes(k));
      if (isTaxGuide && pjType === "expense") {
        const tipoGuess = taxKeywords.find(k => descLower.includes(k))?.toUpperCase() || "DAS";
        const today = new Date();
        const comp = `${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
        await supabase.from("tax_guides").insert({
          company_id: company.id,
          tipo: tipoGuess,
          competencia: comp,
          vencimento: date,
          valor: amount,
          status: "a_pagar",
          source: "ocr",
        });
        queryClient.invalidateQueries({ queryKey: ["tax_guides"] });
      }

      toast.success(status === "pending" ? "Conta a pagar criada!" : "Lançamento criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["recent_scans_company"] });
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

  /** Check if a contact already exists for the current scan result */
  const checkExistingContact = async (scanData: ScanResult, txType: string): Promise<{ exists: boolean; name?: string }> => {
    if (!company) return { exists: false };

    const isRevenue = txType === "revenue";
    const contactDoc = isRevenue ? scanData.beneficiary_document : scanData.issuer_document;
    if (!contactDoc) return { exists: false };

    const cleanDoc = cleanDocument(contactDoc);
    const { data } = await supabase
      .from("contacts")
      .select("id, name")
      .eq("company_id", company.id)
      .ilike("document", `%${cleanDoc}%`)
      .limit(1);

    if (data && data.length > 0) {
      return { exists: true, name: data[0].name };
    }
    return { exists: false };
  };

  const { data: recentScans = [] } = useQuery({
    queryKey: ["recent_scans_company", company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data } = await supabase
        .from("transactions")
        .select("id, description, amount, date, type, status, created_at, attachment_url")
        .eq("company_id", company.id)
        .eq("source", "scanner")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!company?.id,
  });

  const clearResult = () => { setResult(null); setBatchResults([]); };

  return {
    scanning,
    result,
    creating,
    recentScans,
    batchResults,
    batchProcessing,
    scanDocument,
    scanBatch,
    createTransactionFromScan,
    checkExistingContact,
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
