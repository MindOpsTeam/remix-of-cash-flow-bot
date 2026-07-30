import { useState, useEffect, useRef } from "react";
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
  Receipt, CreditCard, QrCode, FileSpreadsheet, Compass, Clock,
  Paperclip, Loader2, UserPlus, UserCheck,
} from "lucide-react";
import { DocumentUploader } from "@/components/DocumentUploader";
import { useDocumentScanner, ScanResult } from "@/hooks/useDocumentScanner";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
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
  const { scanning, result, creating, recentScans, batchResults, batchProcessing, scanDocument, scanBatch, createTransactionFromScan, checkExistingContact, clearResult } = useDocumentScanner();
  const { company } = useCompany();
  const { user } = useAuth();
  const scannedFileRef = useRef<File | null>(null);

  // Editable overrides
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState<"revenue" | "expense">("expense");
  const [editStatus, setEditStatus] = useState<"confirmed" | "pending">("confirmed");
  const [editAccountId, setEditAccountId] = useState("");
  const [editCostCenterId, setEditCostCenterId] = useState("");
  const [editBankAccountId, setEditBankAccountId] = useState("");

  // Contact detection
  const [contactInfo, setContactInfo] = useState<{ exists: boolean; name?: string } | null>(null);

  // Options for selects
  const [accounts, setAccounts] = useState<{ id: string; name: string; code: string | null; type: string }[]>([]);
  const [costCenters, setCostCenters] = useState<{ id: string; name: string }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<{ id: string; name: string; bank_name: string | null }[]>([]);

  // Load PJ options
  useEffect(() => {
    if (!company) return;
    const load = async () => {
      const [accts, ccs, banks] = await Promise.all([
        supabase.from("chart_of_accounts").select("id, name, code, type").eq("company_id", company.id).order("code"),
        supabase.from("cost_centers").select("id, name, category").eq("company_id", company.id).eq("active", true).order("name"),
        supabase.from("bank_accounts").select("id, name, bank_name").eq("company_id", company.id).order("name"),
      ]);
      if (accts.data) setAccounts(accts.data);
      if (ccs.data) setCostCenters(ccs.data as any);
      if (banks.data) setBankAccounts(banks.data);
    };
    load();
  }, [company]);

  // Populate editable fields when result arrives
  useEffect(() => {
    if (!result) { setContactInfo(null); return; }
    setEditAmount(result.value != null ? String(result.value) : "");
    setEditDate(result.date || new Date().toISOString().split("T")[0]);
    setEditDescription(result.description || "");
    setEditType(result.transaction_type || "expense");
    setEditAccountId(result.suggested_account_id || "");
    setEditCostCenterId(result.suggested_cost_center_id || "");
    setEditBankAccountId(result.suggested_bank_account_id || "");

    // Auto-detect pending: boleto or future date
    const today = new Date().toISOString().split("T")[0];
    const isFutureDate = result.date && result.date > today;
    const isBoleto = result.document_type === "boleto";
    setEditStatus(isFutureDate || isBoleto ? "pending" : "confirmed");

    // Check existing contact
    const txType = result.transaction_type || "expense";
    checkExistingContact(result, txType).then(setContactInfo);
  }, [result]);

  const filteredAccounts = accounts.filter((a) =>
    editType === "revenue" ? a.type === "revenue" : a.type === "expense"
  );

  const handleFileSelected = (file: File) => {
    scannedFileRef.current = file;
    scanDocument(file);
  };

  const handleBatchSelected = (files: File[]) => {
    scanBatch(files);
  };

  const handleCreate = async () => {
    if (!result) return;
    const amount = parseFloat(editAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) return;

    await createTransactionFromScan(result, {
      amount,
      date: editDate,
      description: editDescription,
      type: editType,
      status: editStatus,
      account_id: editAccountId || undefined,
      cost_center_id: editCostCenterId || undefined,
      bank_account_id: editBankAccountId || undefined,
    }, scannedFileRef.current || undefined);

    scannedFileRef.current = null;
  };

  const DocIcon = result?.document_type ? (docTypeIcons[result.document_type] || FileText) : FileText;

  const statusLabel = editStatus === "pending"
    ? (editType === "revenue" ? "Conta a Receber" : "Conta a Pagar")
    : (editType === "revenue" ? "Receita" : "Despesa");

  // Determine contact display
  const contactName = editType === "revenue" ? result?.beneficiary : result?.issuer;
  const contactDoc = editType === "revenue" ? result?.beneficiary_document : result?.issuer_document;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em] flex items-center gap-2">
            <ScanLine className="h-6 w-6" /> Scanner OCR
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Escaneie boletos, notas fiscais, recibos e comprovantes — suporta imagens e PDF
          </p>
        </div>

        {/* Upload area or Result */}
        {!result && !batchProcessing && batchResults.length === 0 ? (
          <DocumentUploader
            onFileSelected={handleFileSelected}
            onBatchSelected={handleBatchSelected}
            scanning={scanning}
          />
        ) : batchProcessing || batchResults.length > 0 ? (
          /* Batch results */
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Processamento em lote</p>
                {batchProcessing && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </div>
              <div className="space-y-2">
                {batchResults.map((br, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${br.result ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                      {br.result ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{br.file}</p>
                      {br.result ? (
                        <p className="text-xs text-muted-foreground">
                          {docTypeLabels[br.result.document_type || "outro"]} — {br.result.value != null ? fmt(br.result.value) : "Sem valor"}
                        </p>
                      ) : (
                        <p className="text-xs text-destructive">{br.error}</p>
                      )}
                    </div>
                    {br.result && (
                      <Badge variant="outline" className="text-[10px]">
                        {br.result.transaction_type === "revenue" ? "Receita" : "Despesa"}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
              {!batchProcessing && (
                <Button variant="outline" className="w-full" onClick={() => { clearResult(); }}>
                  <RotateCcw className="h-4 w-4 mr-1.5" /> Novo Scan
                </Button>
              )}
            </CardContent>
          </Card>
        ) : result ? (
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
                        <Compass className="h-3 w-3 text-primary" />
                        <span className="text-[10px] text-muted-foreground">
                          Confiança: {result.classification_confidence === "high" ? "Alta" : result.classification_confidence === "medium" ? "Média" : "Baixa"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs ${editStatus === "pending" ? "border-warning/30 text-warning" : ""}`}
                >
                  {editStatus === "pending" && <Clock className="h-3 w-3 mr-1" />}
                  {statusLabel}
                </Badge>
              </div>

              {/* Extracted info (read-only) */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {result.issuer && (
                  <div><span className="text-muted-foreground text-xs">Emitente</span><p className="font-medium truncate">{result.issuer}</p></div>
                )}
                {result.issuer_document && (
                  <div><span className="text-muted-foreground text-xs">CNPJ/CPF Emitente</span><p className="font-medium font-mono text-xs">{result.issuer_document}</p></div>
                )}
                {result.beneficiary && (
                  <div><span className="text-muted-foreground text-xs">Beneficiário/Tomador</span><p className="font-medium truncate">{result.beneficiary}</p></div>
                )}
                {result.beneficiary_document && (
                  <div><span className="text-muted-foreground text-xs">CNPJ/CPF Beneficiário</span><p className="font-medium font-mono text-xs">{result.beneficiary_document}</p></div>
                )}
                {result.document_number && (
                  <div><span className="text-muted-foreground text-xs">N° Documento</span><p className="font-medium">{result.document_number}</p></div>
                )}
                {result.barcode && (
                  <div className="col-span-2"><span className="text-muted-foreground text-xs">Código de Barras</span><p className="font-mono text-xs break-all">{result.barcode}</p></div>
                )}
              </div>

              {/* Contact auto-detection indicator */}
              {(contactName || contactDoc) && (
                <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
                  contactInfo?.exists
                    ? "bg-success/[0.08] border-success/30 text-success"
                    : "bg-primary/5 border-primary/20 text-primary"
                }`}>
                  {contactInfo?.exists ? (
                    <>
                      <UserCheck className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>Contato existente: <strong>{contactInfo.name}</strong></span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>
                        {editType === "revenue" ? "Cliente" : "Fornecedor"} será cadastrado: <strong>{contactName}</strong>
                        {contactDoc && <span className="font-mono ml-1">({contactDoc})</span>}
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* Revenue NF indicator */}
              {editType === "revenue" && (result.document_type === "nota_fiscal" || result.document_type === "nfse") && (
                <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border bg-primary/[0.08] border-primary/30 text-primary">
                  <FileSpreadsheet className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Nota fiscal será registrada em <strong>Vendas → Notas Fiscais</strong></span>
                </div>
              )}

              {/* Editable fields */}
              <div className="space-y-3 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Dados do lançamento</p>

                <div className="grid grid-cols-3 gap-3">
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
                    <Label className="text-xs">Status</Label>
                    <Select value={editStatus} onValueChange={(v) => setEditStatus(v as any)}>
                      <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="confirmed">{editType === "revenue" ? "Recebido" : "Pago"}</SelectItem>
                        <SelectItem value="pending">{editType === "revenue" ? "A Receber" : "A Pagar"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{editStatus === "pending" ? "Vencimento" : "Data"}</Label>
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
                </div>

                <div className="grid grid-cols-2 gap-3">
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
                  <div>
                    <Label className="text-xs">Conta Bancária</Label>
                    <Select value={editBankAccountId} onValueChange={setEditBankAccountId}>
                      <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}{b.bank_name ? ` (${b.bank_name})` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {scannedFileRef.current && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
                    <Paperclip className="h-3.5 w-3.5" />
                    <span className="truncate">{scannedFileRef.current.name}</span>
                    <span className="text-[10px]">— será salvo como anexo</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => { clearResult(); scannedFileRef.current = null; }} disabled={creating}>
                  <RotateCcw className="h-4 w-4 mr-1.5" /> Novo Scan
                </Button>
                <Button variant="accent" className="flex-1" onClick={handleCreate} disabled={creating || !editAmount}>
                  <Check className="h-4 w-4 mr-1.5" />
                  {creating ? "Salvando..." : editStatus === "pending" ? "Criar Conta a Pagar" : "Criar Lançamento"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

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
                    {scan.status === "pending" ? <Clock className="h-4 w-4" /> : <ScanLine className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{scan.description}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {new Date(scan.date + "T00:00:00").toLocaleDateString("pt-BR")}
                      </p>
                      {scan.status === "pending" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-warning/30 text-warning">
                          A Pagar
                        </Badge>
                      )}
                      {scan.attachment_url && (
                        <Paperclip className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
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
