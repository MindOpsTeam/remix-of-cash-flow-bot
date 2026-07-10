/**
 * Formulário estruturado de NF-e (modelo 55) via PlugNotas.
 * Suporta múltiplos itens com autocomplete de produtos.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Send, Plus, Trash2 } from "lucide-react";
import { ContactPicker, type ContactOption } from "./ContactPicker";
import { ProductPicker } from "./ProductPicker";
import {
  formatDocument, isValidDocument, mapNfe, extractErrorMessage,
  type NfeFormData, type NfeItem,
} from "@/lib/plugnotas";
import { deveDestacar, extractReformaMeta } from "@/lib/plugnotas";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props { emitenteCnpj: string }

const emptyItem: NfeItem = {
  codigo: "",
  descricao: "",
  ncm: "",
  cfop: "5102",
  unidade: "UN",
  quantidade: 1,
  valorUnitario: 0,
  origemTributaria: "0",
};

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function NfeForm({ emitenteCnpj }: Props) {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [emitting, setEmitting] = useState(false);

  // Destinatário
  const [contactId, setContactId] = useState<string | undefined>();
  const [destDoc, setDestDoc] = useState("");
  const [destNome, setDestNome] = useState("");
  const [destIE, setDestIE] = useState("");
  const [destEmail, setDestEmail] = useState("");

  const [natureza, setNatureza] = useState("Venda de mercadoria");
  const [info, setInfo] = useState("");

  const [itens, setItens] = useState<NfeItem[]>([{ ...emptyItem }]);

  const onContact = (c: ContactOption) => {
    setContactId(c.id);
    setDestDoc(c.document ?? "");
    setDestNome(c.name);
    setDestIE(c.state_registration ?? "");
    setDestEmail(c.email ?? "");
  };

  const updateItem = (idx: number, patch: Partial<NfeItem>) => {
    setItens((arr) => arr.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const addItem = () => setItens((arr) => [...arr, { ...emptyItem }]);
  const removeItem = (idx: number) => setItens((arr) => arr.length > 1 ? arr.filter((_, i) => i !== idx) : arr);

  const total = itens.reduce((s, it) => s + Number(it.quantidade) * Number(it.valorUnitario), 0);

  const validate = (): string | null => {
    if (!destDoc) return "Documento do destinatário é obrigatório";
    if (!isValidDocument(destDoc)) return "CPF/CNPJ do destinatário inválido";
    if (!destNome) return "Razão social/nome do destinatário é obrigatória";
    if (!natureza) return "Natureza da operação é obrigatória";
    for (let i = 0; i < itens.length; i++) {
      const it = itens[i];
      if (!it.codigo) return `Item #${i + 1}: código é obrigatório`;
      if (!it.descricao) return `Item #${i + 1}: descrição é obrigatória`;
      if (!it.ncm || it.ncm.length < 8) return `Item #${i + 1}: NCM deve ter 8 dígitos`;
      if (!it.cfop || it.cfop.length < 4) return `Item #${i + 1}: CFOP inválido`;
      if (!it.quantidade || it.quantidade <= 0) return `Item #${i + 1}: quantidade inválida`;
      if (!it.valorUnitario || it.valorUnitario <= 0) return `Item #${i + 1}: valor unitário inválido`;
    }
    return null;
  };

  const handleEmit = async () => {
    if (!company) return;
    const err = validate();
    if (err) { toast.error(err); return; }

    const data: NfeFormData = {
      emitenteCnpj,
      naturezaOperacao: natureza,
      destinatario: {
        cpfCnpj: destDoc,
        razaoSocial: destNome,
        inscricaoEstadual: destIE || undefined,
        email: destEmail || undefined,
      },
      itens,
      informacoesAdicionais: info || undefined,
    };

    setEmitting(true);
    try {
      const { data: invoice, error: invErr } = await (supabase as any)
        .from("invoices")
        .insert({
          company_id: company.id,
          contact_id: contactId ?? null,
          type: "nfe",
          status: "draft",
          total,
          notes: natureza,
        })
        .select("id")
        .single();
      if (invErr) throw new Error("Erro ao criar invoice local: " + invErr.message);

      const reformaOpts = deveDestacar(company.regimeTributario, "nfe") ? { cClassTrib: company.cclasstribPadrao ?? undefined } : null;
      const payload = mapNfe(data, reformaOpts);
      const { data: result, error } = await supabase.functions.invoke("plugnotas-nfe", {
        body: { company_id: company.id, operation: "emitir", params: payload, invoice_id: invoice.id, reforma: extractReformaMeta(payload) },
      });
      if (error) throw new Error(error.message);

      if (result?.ok) {
        toast.success("NF-e enviada — aguardando autorização");
        setContactId(undefined);
        setDestDoc(""); setDestNome(""); setDestIE(""); setDestEmail("");
        setItens([{ ...emptyItem }]);
        setInfo("");
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
      {/* Destinatário */}
      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Destinatário</Label>
          <ContactPicker value={contactId} onSelect={onContact} type="customer" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">CPF/CNPJ *</Label>
              <Input
                value={destDoc}
                onChange={(e) => setDestDoc(e.target.value)}
                onBlur={(e) => setDestDoc(formatDocument(e.target.value))}
                placeholder="00.000.000/0000-00"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Razão social / nome *</Label>
              <Input value={destNome} onChange={(e) => setDestNome(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Inscrição estadual</Label>
              <Input value={destIE} onChange={(e) => setDestIE(e.target.value)} className="font-mono text-sm" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={destEmail} onChange={(e) => setDestEmail(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Operação */}
      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Operação</Label>
          <div>
            <Label className="text-xs">Natureza da operação *</Label>
            <Input value={natureza} onChange={(e) => setNatureza(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Itens */}
      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Itens da nota</Label>
            <span className="text-xs text-muted-foreground">{itens.length} item(ns) · Total {fmtMoney(total)}</span>
          </div>
          <div className="space-y-3">
            {itens.map((it, idx) => (
              <div key={idx} className="border border-border rounded-lg p-3 space-y-2 bg-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Item #{idx + 1}</span>
                  <div className="flex items-center gap-2">
                    <ProductPicker
                      productType="product"
                      placeholder="Carregar produto..."
                      onSelect={(p) => updateItem(idx, {
                        codigo: p.sku ?? p.id.slice(0, 8),
                        descricao: p.description ?? p.name,
                        ncm: p.ncm ?? "",
                        cClassTrib: p.cclasstrib ?? undefined,
                        cfop: p.cfop ?? "5102",
                        unidade: p.unit.toUpperCase(),
                        valorUnitario: Number(p.sell_price) || 0,
                        origemTributaria: p.tax_origin ?? "0",
                      })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeItem(idx)}
                      disabled={itens.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-expense" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-2">
                    <Label className="text-[10px]">Código</Label>
                    <Input
                      value={it.codigo}
                      onChange={(e) => updateItem(idx, { codigo: e.target.value })}
                      className="font-mono text-xs h-9"
                    />
                  </div>
                  <div className="col-span-4">
                    <Label className="text-[10px]">Descrição</Label>
                    <Input value={it.descricao} onChange={(e) => updateItem(idx, { descricao: e.target.value })} className="text-xs h-9" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[10px]">NCM</Label>
                    <Input
                      value={it.ncm}
                      onChange={(e) => updateItem(idx, { ncm: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                      placeholder="00000000"
                      className="font-mono text-xs h-9"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[10px]">CFOP</Label>
                    <Input
                      value={it.cfop}
                      onChange={(e) => updateItem(idx, { cfop: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                      className="font-mono text-xs h-9"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[10px]">Unidade</Label>
                    <Input value={it.unidade} onChange={(e) => updateItem(idx, { unidade: e.target.value.toUpperCase() })} className="text-xs h-9" />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-[10px]">Quantidade</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={it.quantidade}
                      onChange={(e) => updateItem(idx, { quantidade: parseFloat(e.target.value) || 0 })}
                      className="font-mono text-xs h-9"
                    />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-[10px]">Valor unitário (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={it.valorUnitario}
                      onChange={(e) => updateItem(idx, { valorUnitario: parseFloat(e.target.value) || 0 })}
                      className="font-mono text-xs h-9"
                    />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-[10px]">Origem tributária</Label>
                    <Input
                      value={it.origemTributaria ?? ""}
                      onChange={(e) => updateItem(idx, { origemTributaria: e.target.value })}
                      className="font-mono text-xs h-9"
                    />
                  </div>
                  <div className="col-span-3 flex items-end">
                    <p className="text-xs font-semibold text-foreground">
                      Subtotal: {fmtMoney(it.quantidade * it.valorUnitario)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={addItem} type="button" className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Adicionar item
          </Button>
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardContent className="py-4 px-5">
          <Label className="text-xs">Informações adicionais</Label>
          <Textarea value={info} onChange={(e) => setInfo(e.target.value)} rows={2} className="mt-1" />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleEmit} disabled={emitting} size="lg" className="gap-2">
          {emitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {emitting ? "Emitindo..." : `Emitir NF-e · ${fmtMoney(total)}`}
        </Button>
      </div>
    </div>
  );
}
