import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { mensagemDeErro } from "@/lib/erros";

interface NotaXml {
  tipo: "nfe" | "nfse";
  chave: string | null;
  emitCnpj: string | null;
  emitNome: string | null;
  destCnpj: string | null;
  numero: string | null;
  data: string | null;
  valor: number;
}

const soDigitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "") || null;
/** Número pt-BR ("1.234,56") ou já-numérico, sem zerar por causa do milhar (achado M5). */
const numBR = (s: string | null | undefined) => {
  if (!s) return 0;
  const raw = String(s);
  const v = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  return Number(v) || 0;
};

/**
 * Lê o XML de uma nota fiscal eletrônica (NF-e ou NFS-e) e extrai os dados
 * estruturados (exatos, sem OCR). A direção sai do CNPJ da empresa: se ela é a
 * emitente, a nota é de saída (vira invoice/recebível); se é destinatária, é de
 * entrada (vira nota recebida para lançar conta a pagar).
 */
function parseNotaXml(xml: string): NotaXml | null {
  let doc: Document;
  try { doc = new DOMParser().parseFromString(xml, "text/xml"); } catch { return null; }
  if (doc.querySelector("parsererror")) return null;
  const txt = (sel: string) => doc.querySelector(sel)?.textContent?.trim() ?? null;

  // NF-e (namespace portalfiscal, sem prefixo)
  const infNFe = doc.querySelector("infNFe");
  if (infNFe) {
    const id = infNFe.getAttribute("Id") ?? "";
    const vNF = txt("ICMSTot > vNF") ?? txt("vNF");
    const dh = txt("ide > dhEmi") ?? txt("ide > dEmi");
    return {
      tipo: "nfe",
      chave: id.replace(/^NFe/i, "").replace(/\D/g, "") || null,
      emitCnpj: soDigitos(txt("emit > CNPJ")),
      emitNome: txt("emit > xNome"),
      destCnpj: soDigitos(txt("dest > CNPJ") ?? txt("dest > CPF")),
      numero: txt("ide > nNF"),
      data: dh ? dh.slice(0, 10) : null,
      valor: vNF ? Number(vNF) : 0,
    };
  }

  // NFS-e nacional / ABRASF (defensivo — schemas municipais variam)
  const ehNfse = doc.querySelector("infNFSe, InfNfse, Nfse, NFSe, DPS, infDPS");
  if (ehNfse) {
    const valor = txt("vServ") ?? txt("ValorServicos") ?? txt("valorServicos") ?? txt("vLiq");
    const dh = txt("dhProc") ?? txt("DataEmissao") ?? txt("dhEmi") ?? txt("dCompet");
    return {
      tipo: "nfse",
      chave: txt("chaveAcesso") ?? txt("CodigoVerificacao") ?? null,
      emitCnpj: soDigitos(txt("prest > CNPJ") ?? txt("PrestadorServico Cnpj") ?? txt("emit > CNPJ")),
      emitNome: txt("prest > xNome") ?? txt("RazaoSocial") ?? txt("xNome"),
      destCnpj: soDigitos(txt("toma > CNPJ") ?? txt("TomadorServico Cnpj") ?? txt("toma > CPF")),
      numero: txt("nNFSe") ?? txt("Numero") ?? txt("nDPS"),
      data: dh ? dh.slice(0, 10) : null,
      valor: numBR(valor),
    };
  }
  return null;
}

export function ImportarNotaXml() {
  const { company } = useCompany();
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [processando, setProcessando] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !company) return;
    setProcessando(true);
    try {
      const text = await file.text();
      const nota = parseNotaXml(text);
      if (!nota || !nota.chave) {
        toast.error("Não reconheci o arquivo como XML de NF-e ou NFS-e.");
        return;
      }
      const companyCnpj = soDigitos(company.cnpj);
      const emitida = !!companyCnpj && nota.emitCnpj === companyCnpj;
      const recebida = !!companyCnpj && nota.destCnpj === companyCnpj;
      // Não adivinhar direção (achado M3): sem CNPJ da empresa ou sem match, parar e avisar,
      // para não classificar a própria nota emitida como compra (conta a pagar fantasma).
      if (!emitida && !recebida) {
        toast.error(companyCnpj
          ? "Esta nota não tem o CNPJ da sua empresa como emitente nem destinatário. Confira o arquivo."
          : "Cadastre o CNPJ da sua empresa (Configurações) antes de importar notas.");
        return;
      }
      const direcao: "emitida" | "recebida" = emitida ? "emitida" : "recebida";
      const xmlGuardado = text.slice(0, 40000);

      if (direcao === "recebida") {
        const { data: existe } = await (supabase as any)
          .from("inbound_documents").select("id").eq("company_id", company.id).eq("chave_acesso", nota.chave).maybeSingle();
        if (existe) { toast.info("Essa nota já tinha sido importada."); return; }
        const { error } = await (supabase as any).from("inbound_documents").insert({
          company_id: company.id, tipo: nota.tipo, chave_acesso: nota.chave, numero: nota.numero,
          emitente_cnpj: nota.emitCnpj, emitente_nome: nota.emitNome, valor_total: nota.valor,
          data_emissao: nota.data, status: "pendente", xml_content: xmlGuardado,
        });
        if (error) throw error;
        toast.success("Nota de entrada importada. Lance-a como conta a pagar na lista abaixo.");
        qc.invalidateQueries({ queryKey: ["inbound-documents", company.id] });
      } else {
        // Dedup por chave (achado H4): não duplicar nota já emitida/importada.
        const { data: existeInv } = await (supabase as any)
          .from("invoices").select("id").eq("company_id", company.id).eq("chave_acesso", nota.chave).maybeSingle();
        if (existeInv) { toast.info("Essa nota emitida já estava no sistema."); return; }
        const { error } = await (supabase as any).from("invoices").insert({
          company_id: company.id, type: nota.tipo, status: "authorized", number: nota.numero,
          issue_date: nota.data, total: nota.valor, chave_acesso: nota.chave, xml_content: xmlGuardado,
        });
        if (error) {
          if (error.code === "23505" || String(error.message ?? "").includes("duplicate")) {
            toast.info("Essa nota emitida já estava no sistema."); return;
          }
          throw error;
        }
        toast.success("Nota emitida importada em Vendas. A conta a receber foi aberta.");
        qc.invalidateQueries({ queryKey: ["invoices", company.id] });
      }
    } catch (err) {
      toast.error("Falha ao importar: " + mensagemDeErro(err));
    } finally {
      setProcessando(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <>
      <input ref={ref} type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={onFile} />
      <Button size="sm" variant="outline" onClick={() => ref.current?.click()} disabled={processando} className="gap-2">
        {processando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
        Importar XML de nota
      </Button>
    </>
  );
}
