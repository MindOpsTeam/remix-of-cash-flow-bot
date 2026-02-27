import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ScanLine, Check, RotateCcw, FileText, ArrowLeftRight,
  Receipt, CreditCard, QrCode, FileSpreadsheet, Sparkles,
} from "lucide-react";
import { DocumentUploader } from "@/components/DocumentUploader";
import { useDocumentScanner, ScanResult } from "@/hooks/useDocumentScanner";
import { useCompany } from "@/hooks/useCompany";
import { useAppMode } from "@/hooks/useAppMode";
import { supabase } from "@/integrations/supabase/client";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const docTypeLabels: Record<string, string> = {
  boleto: "Boleto",
  nota_fiscal: "Nota Fiscal",
  nfse: "NFS-e",
  cupom_fiscal: "Cupom Fiscal",
  recibo: "Recibo",
  comprovante_pix: "Comprovante PIX",
  extrato: "Extrato",
  outro: "Outro",
};

const docTypeIcons: Record<string, typeof Receipt> = {
  boleto: Receipt,
  nota_fiscal: FileText,
  nfse: FileSpreadsheet,
  cupom_fiscal: CreditCard,
  recibo: FileText,
  comprovante_pix: QrCode,
  extrato: ArrowLeftRight,
  outro: FileText,
};

export default function DocumentScanner() {
  const { scanning, result, creating, recentScans, scanDocument, createTransactionFromScan, clearResult } = useDocumentScanner();
  const { company } = useCompany();
  const { isPersonal } = useAppMode();

  // Editable overrides
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState<"revenue" | "expense">("expense");
  const [editAccountId, setEditAccountId] = useState("");
  const [editCostCenterId, setEditCostCenterId] = useState("");

  // Options for classification selects (business mode)
  const [accounts, setAccounts] = useState<{ id: string; name: string; code: string | null; type: string }[]>([]);
  const [costCenters, setCostCenters] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (isPersonal || !company) return;
    const fetch = async () => {
      const [accts, ccs] = await Promise.all([
        supabase.from("chart_of_accounts").select("id, name, code, type").eq("company_id", company.id).order("code"),
        supabase.from("cost_centers").select("id, name, category").eq("company_id", company.id).eq("active", true).order("name"),
      ]);
      if (accts.data) setAccounts(accts.data);
      if (ccs.data) setCostCenters(ccs.data as any);
    };
    fetch();
  }, [company, isPersonal]);

  // Populate editable fields when result arrives
  useEffect(() => {
    if (!result) return;
    setEditAmount(result.value != null ? String(result.value) : "");
    setEditDate(result.date || new Date().toISOString().split("T")[0]);
    setEditDescription(result.description || "");
    setEditType(result.transaction_type || "expense");
    setEditAccountId(result.suggested_account_id || "");
    setEditCostCenterId(result.suggested_cost_center_id || "");
  }, [result]);

  const filteredAccounts = accounts.filter((a) =>
    editType === "revenue" ? a.type === "revenue" : a.type === "expense"
  );

  const handleCreate = async () => {
    if (!result) return;
    const amount = parseFloat(editAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) return;

    await createTransactionFromScan(result, {
      amount,
      date: editDate,
      description: editDescription,
      type: editType,
      account_id: editAccountId || undefined,
      cost_center_id: editCostCenterId || undefined,
    });
  };

  const DocIcon = result?.document_type ? (docTypeIcons[result.document_type] || FileText) : FileText;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em] flex items-center gap-2">
            <ScanLine className="h-6 w-6" /> Documentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Escaneie boletos, notas fiscais, recibos e comprovantes para criar lançamentos automaticamente
          </p>
        </div>

        {/* Upload area or Result */}
        {!result ? (
          <DocumentUploader onFileSelected={scanDocument} scanning={scanning} />
        ) : (
          <Card className="border-primary/30">
            <CardContent className="pt-6 space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center bg-primary/10 text-primary">
                    <DocIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {docTypeLabels[result.document_type || "outro"] || "Documento"}
                    </p>
                    {result.classification_confidence && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Sparkles className="h-3 w-3 text-primary" />
                        <span className="text-[10px] text-muted-foreground">
                          Confiança: {result.classification_confidence === "high" ? "Alta" : result.classification_confidence === "medium" ? "Média" : "Baixa"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {editType === "revenue" ? "Receita" : "Despesa"}
                </Badge>
              </div>

              {/* Extracted info (read-only) */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {result.issuer && (
                  <div><span className="text-muted-foreground text-xs">Emitente</span><p className="font-medium truncate">{result.issuer}</p></div>
                )}
                {result.issuer_document && (
                  <div><span className="text-muted-foreground text-xs">CNPJ/CPF</span><p className="font-medium font-mono text-xs">{result.issuer_document}</p></div>
                )}
                {result.document_number && (
                  <div><span className="text-muted-foreground text-xs">N° Documento</span><p className="font-medium">{result.document_number}</p></div>
                )}
                {result.barcode && (
                  <div className="col-span-2"><span className="text-muted-foreground text-xs">Código de Barras</span><p className="font-mono text-xs break-all">{result.barcode}</p></div>
                )}
              </div>

              {/* Editable fields */}
              <div className="space-y-3 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Dados do lançamento</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select value={editType} onValueChange={(v) => { setEditType(v as any); setEditAccountId(""); }}>
                      <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="revenue">Receita</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Data</Label>
                    <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="mt-1 h-9" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Descrição</Label>
                  <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="mt-1 h-9" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="mt-1 h-9 font-mono" />
                  </div>
                  {!isPersonal && (
                    <div>
                      <Label className="text-xs">Conta Contábil</Label>
                      <Select value={editAccountId} onValueChange={setEditAccountId}>
                        <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {filteredAccounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.code ? `${a.code} ` : ""}{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                {!isPersonal && (
                  <div>
                    <Label className="text-xs">Centro de Custo</Label>
                    <Select value={editCostCenterId} onValueChange={setEditCostCenterId}>
                      <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {costCenters.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={clearResult} disabled={creating}>
                  <RotateCcw className="h-4 w-4 mr-1.5" /> Novo Scan
                </Button>
                <Button variant="accent" className="flex-1" onClick={handleCreate} disabled={creating || !editAmount}>
                  <Check className="h-4 w-4 mr-1.5" /> {creating ? "Salvando..." : "Criar Lançamento"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent scans history */}
        {recentScans.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Documentos recentes
            </h2>
            <div className="bg-card border border-border rounded-lg divide-y divide-border">
              {recentScans.map((scan) => (
                <div key={scan.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${
                    scan.type === "revenue" ? "bg-revenue/10 text-revenue" : "bg-expense/10 text-expense"
                  }`}>
                    <ScanLine className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{scan.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(scan.date + "T00:00:00").toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold font-mono ${
                    scan.type === "revenue" ? "text-revenue" : "text-expense"
                  }`}>
                    {scan.type === "expense" ? "-" : "+"}{fmt(Number(scan.amount))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
