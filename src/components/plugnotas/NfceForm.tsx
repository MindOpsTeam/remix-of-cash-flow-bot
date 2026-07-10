/**
 * NFC-e (modelo 65): venda a consumidor final.
 * Reusa estrutura da NF-e mas com forma de pagamento e identificação opcional do consumidor.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Send, Plus, Trash2 } from "lucide-react";
import { ProductPicker } from "./ProductPicker";
import {
  formatDocument, isValidDocument, mapNfce, extractErrorMessage,
  type NfceFormData, type NfeItem,
} from "@/lib/plugnotas";
import { deveDestacar, extractReformaMeta } from "@/lib/plugnotas";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props { emitenteCnpj: string }

const emptyItem: NfeItem = {
  codigo: "", descricao: "", ncm: "", cfop: "5102", unidade: "UN",
  quantidade: 1, valorUnitario: 0, origemTributaria: "0",
};

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const FORMAS_PAGAMENTO = [
  { value: "01", label: "Dinheiro" },
  { value: "02", label: "Cheque" },
  { value: "03", label: "Cartão de crédito" },
  { value: "04", label: "Cartão de débito" },
  { value: "05", label: "Crédito loja" },
  { value: "10", label: "Vale alimentação" },
  { value: "11", label: "Vale refeição" },
  { value: "17", label: "PIX" },
  { value: "99", label: "Outros" },
];

export function NfceForm({ emitenteCnpj }: Props) {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [emitting, setEmitting] = useState(false);

  const [identifyConsumer, setIdentifyConsumer] = useState(false);
  const [consDoc, setConsDoc] = useState("");
  const [consNome, setConsNome] = useState("");

  const [itens, setItens] = useState<NfeItem[]>([{ ...emptyItem }]);
  const [formaPagamento, setFormaPagamento] = useState("01");

  const updateItem = (idx: number, patch: Partial<NfeItem>) => {
    setItens((arr) => arr.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const addItem = () => setItens((arr) => [...arr, { ...emptyItem }]);
  const removeItem = (idx: number) => setItens((arr) => arr.length > 1 ? arr.filter((_, i) => i !== idx) : arr);

  const total = itens.reduce((s, it) => s + Number(it.quantidade) * Number(it.valorUnitario), 0);

  const validate = (): string | null => {
    if (identifyConsumer && consDoc && !isValidDocument(consDoc)) return "CPF/CNPJ do consumidor inválido";
    for (let i = 0; i < itens.length; i++) {
      const it = itens[i];
      if (!it.descricao) return `Item #${i + 1}: descrição obrigatória`;
      if (!it.ncm || it.ncm.length < 8) return `Item #${i + 1}: NCM deve ter 8 dígitos`;
      if (!it.cfop) return `Item #${i + 1}: CFOP obrigatório`;
      if (!it.quantidade || it.quantidade <= 0) return `Item #${i + 1}: quantidade inválida`;
      if (!it.valorUnitario || it.valorUnitario <= 0) return `Item #${i + 1}: valor unitário inválido`;
    }
    return null;
  };

  const handleEmit = async () => {
    if (!company) return;
    const err = validate();
    if (err) { toast.error(err); return; }

    const data: NfceFormData = {
      emitenteCnpj,
      naturezaOperacao: "Venda ao consumidor",
      destinatario: identifyConsumer
        ? { cpfCnpj: consDoc, razaoSocial: consNome || "Consumidor" }
        : { cpfCnpj: "", razaoSocial: "Consumidor não identificado" },
      itens,
      consumidorFinal: true,
      formaPagamento,
      valorPago: total,
    };

    setEmitting(true);
    try {
      const { data: invoice, error: invErr } = await (supabase as any)
        .from("invoices")
        .insert({
          company_id: company.id,
          type: "nfce",
          status: "draft",
          total,
        })
        .select("id")
        .single();
      if (invErr) throw new Error("Erro ao criar invoice local: " + invErr.message);

      const reformaOpts = deveDestacar(company.regimeTributario, "nfce") ? { cClassTrib: company.cclasstribPadrao ?? undefined } : null;
      const payload = mapNfce(data, reformaOpts);
      const { data: result, error } = await supabase.functions.invoke("plugnotas-nfce", {
        body: { company_id: company.id, operation: "emitir", params: payload, invoice_id: invoice.id, reforma: extractReformaMeta(payload) },
      });
      if (error) throw new Error(error.message);

      if (result?.ok) {
        toast.success("NFC-e enviada — aguardando autorização");
        setItens([{ ...emptyItem }]);
        setIdentifyConsumer(false);
        setConsDoc(""); setConsNome("");
      } else {
        toast.error(extractErrorMessage(result?.data));
        await (supabase as any).from("invoices").update({ status: "denied" }).eq("id", invoice.id);
      }
      qc.invalidateQueries({ queryKey: ["plugnotas_documents", company.id] });
      qc.invalidateQueries({ queryKey: ["invoices", company.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setEmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Identificar consumidor</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">Opcional. Para vendas até R$ 10.000 não é exigido.</p>
            </div>
            <Switch checked={identifyConsumer} onCheckedChange={setIdentifyConsumer} />
          </div>
          {identifyConsumer && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">CPF/CNPJ</Label>
                <Input
                  value={consDoc}
                  onChange={(e) => setConsDoc(e.target.value)}
                  onBlur={(e) => setConsDoc(formatDocument(e.target.value))}
                  placeholder="000.000.000-00"
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={consNome} onChange={(e) => setConsNome(e.target.value)} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Itens</Label>
            <span className="text-xs text-muted-foreground">{itens.length} item(ns) · Total {fmtMoney(total)}</span>
          </div>
          {itens.map((it, idx) => (
            <div key={idx} className="border border-border rounded-lg p-3 space-y-2 bg-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">#{idx + 1}</span>
                <div className="flex items-center gap-2">
                  <ProductPicker
                    productType="product"
                    placeholder="Carregar produto..."
                    onSelect={(p) => updateItem(idx, {
                      codigo: p.sku ?? p.id.slice(0, 8),
                      descricao: p.description ?? p.name,
                      ncm: p.ncm ?? "",
                      cfop: p.cfop ?? "5102",
                      unidade: p.unit.toUpperCase(),
                      valorUnitario: Number(p.sell_price) || 0,
                    })}
                  />
                  <Button
                    variant="ghost" size="icon" type="button" className="h-8 w-8 shrink-0"
                    onClick={() => removeItem(idx)} disabled={itens.length === 1}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-expense" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <Label className="text-[10px]">Descrição</Label>
                  <Input value={it.descricao} onChange={(e) => updateItem(idx, { descricao: e.target.value })} className="text-xs h-9" />
                </div>
                <div className="col-span-2">
                  <Label className="text-[10px]">NCM</Label>
                  <Input value={it.ncm} onChange={(e) => updateItem(idx, { ncm: e.target.value.replace(/\D/g, "").slice(0, 8) })} className="font-mono text-xs h-9" />
                </div>
                <div className="col-span-2">
                  <Label className="text-[10px]">CFOP</Label>
                  <Input value={it.cfop} onChange={(e) => updateItem(idx, { cfop: e.target.value.replace(/\D/g, "").slice(0, 4) })} className="font-mono text-xs h-9" />
                </div>
                <div className="col-span-3">
                  <Label className="text-[10px]">Qtd × Unitário</Label>
                  <div className="flex gap-1">
                    <Input
                      type="number" step="0.001"
                      value={it.quantidade}
                      onChange={(e) => updateItem(idx, { quantidade: parseFloat(e.target.value) || 0 })}
                      className="font-mono text-xs h-9"
                    />
                    <Input
                      type="number" step="0.01"
                      value={it.valorUnitario}
                      onChange={(e) => updateItem(idx, { valorUnitario: parseFloat(e.target.value) || 0 })}
                      className="font-mono text-xs h-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addItem} type="button" className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Adicionar item
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Pagamento</Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Forma de pagamento *</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <p className="text-sm font-semibold">Valor pago: {fmtMoney(total)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleEmit} disabled={emitting} size="lg" className="gap-2">
        {emitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {emitting ? "Emitindo..." : `Emitir NFC-e · ${fmtMoney(total)}`}
      </Button>
    </div>
  );
}
