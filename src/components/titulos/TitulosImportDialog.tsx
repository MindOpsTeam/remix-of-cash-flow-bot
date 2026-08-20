import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2, CheckCircle2, ArrowLeft, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Carga inicial da carteira em aberto.
 *
 * POR QUE ISTO EXISTE
 * O cliente chega no dia 1 com a carteira numa planilha. Sem um caminho de
 * carga, o sistema nasce mentindo: aging vazio, inadimplência zero e agente de
 * cobrança sem nada para cobrar. Ele digita 180 títulos à mão ou volta pro
 * Excel, e volta pro Excel.
 *
 * Todo lote leva um `import_batch_id`. Importação errada se desfaz inteira, sem
 * caçar linha por linha, e títulos que já receberam baixa ficam de fora do
 * desfazer, porque apagar dinheiro conciliado é pior que o erro original.
 */

export type TipoCarga = "receivable" | "bill";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | undefined;
  tipo: TipoCarga;
}

interface Campo {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

const CAMPOS_RECEBER: Campo[] = [
  { key: "descricao", label: "Descrição / Documento", required: true, aliases: ["descricao", "historico", "documento", "titulo", "nf", "nota", "referencia", "description"] },
  { key: "valor", label: "Valor", required: true, aliases: ["valor", "amount", "total", "valor titulo", "vlr"] },
  { key: "vencimento", label: "Vencimento", required: true, aliases: ["vencimento", "due", "due date", "data vencimento", "venc"] },
  { key: "cliente", label: "Cliente (nome ou CNPJ)", aliases: ["cliente", "sacado", "nome", "razao social", "cnpj", "cpf", "contato"] },
  { key: "baixado", label: "Já recebido (parcial)", aliases: ["recebido", "baixado", "pago", "valor pago", "valor recebido"] },
];

const CAMPOS_PAGAR: Campo[] = [
  { key: "descricao", label: "Descrição / Documento", required: true, aliases: ["descricao", "historico", "documento", "titulo", "nf", "nota", "referencia", "description"] },
  { key: "valor", label: "Valor", required: true, aliases: ["valor", "amount", "total", "valor titulo", "vlr"] },
  { key: "vencimento", label: "Vencimento", required: true, aliases: ["vencimento", "due", "due date", "data vencimento", "venc"] },
  { key: "cliente", label: "Fornecedor (nome ou CNPJ)", required: true, aliases: ["fornecedor", "credor", "nome", "razao social", "cnpj", "cpf", "contato"] },
  { key: "baixado", label: "Já pago (parcial)", aliases: ["pago", "baixado", "valor pago"] },
];

const IGNORAR = "__ignorar__";
const CHUNK = 500;

const normaliza = (s: string) =>
  (s ?? "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Valor em formato brasileiro ou americano. "1.234,56" e "1234.56" viram o
 * mesmo número; "R$ 1.234,56" também. Devolve NaN quando não é número, e quem
 * chama descarta a linha em vez de gravar zero.
 */
export function parseValorBR(v: string): number {
  const limpo = (v ?? "").toString().replace(/[R$\s]/gi, "").trim();
  if (!limpo) return NaN;
  const temVirgula = limpo.includes(",");
  const normalizado = temVirgula ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Data em dd/mm/aaaa, dd-mm-aaaa ou aaaa-mm-dd. Devolve null quando não dá para
 * afirmar: vencimento errado desloca o aging inteiro, e chutar hoje seria pior
 * que recusar a linha.
 */
export function parseDataBR(v: string): string | null {
  const s = (v ?? "").toString().trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (br) {
    const dia = br[1].padStart(2, "0");
    const mes = br[2].padStart(2, "0");
    let ano = br[3];
    if (ano.length === 2) ano = `20${ano}`;
    if (Number(mes) < 1 || Number(mes) > 12 || Number(dia) < 1 || Number(dia) > 31) return null;
    return `${ano}-${mes}-${dia}`;
  }
  return null;
}

export function TitulosImportDialog({ open, onOpenChange, companyId, tipo }: Props) {
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const CAMPOS = tipo === "receivable" ? CAMPOS_RECEBER : CAMPOS_PAGAR;

  const [step, setStep] = useState<"upload" | "map" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapa, setMapa] = useState<Record<string, string>>({});
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lote, setLote] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ ok: number; ignoradas: number; motivos: string[] } | null>(null);
  const [desfazendo, setDesfazendo] = useState(false);

  const reset = () => {
    setStep("upload"); setFileName(""); setHeaders([]); setRows([]); setMapa({});
    setParsing(false); setImporting(false); setResultado(null); setLote(null); setDesfazendo(false);
    if (ref.current) ref.current.value = "";
  };
  const fechar = (v: boolean) => { if (!v) reset(); onOpenChange(v); };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      // raw:false preserva a formatação: data como texto e valor com separador
      // brasileiro chegam como o usuário vê na planilha.
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][];
      const linhas = aoa.filter((l) => Array.isArray(l) && l.some((c) => String(c ?? "").trim() !== ""));
      if (linhas.length < 2) {
        toast.error("A planilha precisa de um cabeçalho e ao menos uma linha de dados.");
        setParsing(false);
        return;
      }
      const cab = (linhas[0] as unknown[]).map((c) => String(c ?? "").trim());
      const dados = linhas.slice(1).map((l) => cab.map((_, i) => String((l as unknown[])[i] ?? "").trim()));

      const guess: Record<string, string> = {};
      const usados = new Set<number>();
      for (const campo of CAMPOS) {
        const idx = cab.findIndex(
          (h, i) => !usados.has(i) && campo.aliases.some((a) => normaliza(h) === a || normaliza(h).includes(a)),
        );
        if (idx >= 0) { guess[campo.key] = String(idx); usados.add(idx); }
        else guess[campo.key] = IGNORAR;
      }
      setFileName(file.name); setHeaders(cab); setRows(dados); setMapa(guess); setStep("map");
    } catch (err: unknown) {
      toast.error("Não consegui ler o arquivo. Use CSV ou XLSX. " + (err instanceof Error ? err.message : ""));
    } finally {
      setParsing(false);
    }
  };

  const valorCel = (linha: string[], campoKey: string): string => {
    const idx = mapa[campoKey];
    if (!idx || idx === IGNORAR) return "";
    return linha[Number(idx)] ?? "";
  };

  const importar = async () => {
    if (!companyId) return;
    const faltando = CAMPOS.filter((c) => c.required && (!mapa[c.key] || mapa[c.key] === IGNORAR));
    if (faltando.length) {
      toast.error(`Aponte a coluna de: ${faltando.map((f) => f.label).join(", ")}.`);
      return;
    }
    setImporting(true);
    const batch = crypto.randomUUID();
    const motivos: string[] = [];

    try {
      // Casa o nome ou CNPJ da planilha com quem já está no cadastro. Sem isso
      // o título fica sem dono e a cobrança não sabe para quem falar.
      const { data: contatos } = await supabase
        .from("contacts").select("id, name, document").eq("company_id", companyId);
      const porNome = new Map((contatos ?? []).map((c) => [normaliza(c.name), c.id]));
      const porDoc = new Map(
        (contatos ?? []).filter((c) => c.document).map((c) => [String(c.document).replace(/\D/g, ""), c.id]),
      );

      const registros = rows
        .map((linha, i) => {
          const descricao = valorCel(linha, "descricao").trim();
          const valor = parseValorBR(valorCel(linha, "valor"));
          const vencimento = parseDataBR(valorCel(linha, "vencimento"));
          const baixadoBruto = valorCel(linha, "baixado");
          const baixado = baixadoBruto ? parseValorBR(baixadoBruto) : 0;

          if (!descricao) { motivos.push(`Linha ${i + 2}: sem descrição.`); return null; }
          if (!Number.isFinite(valor) || valor <= 0) { motivos.push(`Linha ${i + 2}: valor inválido ("${valorCel(linha, "valor")}").`); return null; }
          if (!vencimento) { motivos.push(`Linha ${i + 2}: vencimento inválido ("${valorCel(linha, "vencimento")}").`); return null; }

          const chaveContato = valorCel(linha, "cliente").trim();
          const doc = chaveContato.replace(/\D/g, "");
          const contactId = (doc.length >= 11 ? porDoc.get(doc) : undefined) ?? porNome.get(normaliza(chaveContato)) ?? null;

          const jaBaixado = Number.isFinite(baixado) && baixado > 0 ? Math.min(baixado, valor) : 0;
          const quitado = jaBaixado >= valor - 0.01;
          const vencido = new Date(`${vencimento}T00:00:00`) < new Date(new Date().toDateString());

          if (tipo === "receivable") {
            return {
              company_id: companyId,
              description: descricao,
              amount: valor,
              due_date: vencimento,
              contact_id: contactId,
              valor_baixado: jaBaixado,
              status: quitado ? "recebido" : vencido ? "vencido" : "a_receber",
              source: "importacao",
              import_batch_id: batch,
            };
          }
          return {
            company_id: companyId,
            fornecedor: chaveContato || descricao,
            descricao,
            valor,
            vencimento,
            contact_id: contactId,
            valor_baixado: jaBaixado,
            status: quitado ? "pago" : "pendente",
            source: "importacao",
            approval_status: "approved",
            import_batch_id: batch,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      let ok = 0;
      const tabela = tipo === "receivable" ? "receivables" : "bills_payable";
      for (let i = 0; i < registros.length; i += CHUNK) {
        const parte = registros.slice(i, i + CHUNK);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from(tabela) as any).insert(parte);
        if (error) throw error;
        ok += parte.length;
      }

      qc.invalidateQueries({ queryKey: [tabela] });
      setLote(batch);
      setResultado({ ok, ignoradas: rows.length - ok, motivos: motivos.slice(0, 10) });
      setStep("done");
    } catch (err: unknown) {
      toast.error("Falha ao importar: " + (err instanceof Error ? err.message : "erro desconhecido"));
    } finally {
      setImporting(false);
    }
  };

  const desfazer = async () => {
    if (!companyId || !lote) return;
    setDesfazendo(true);
    const { data, error } = await supabase.rpc("desfazer_importacao", { p_company_id: companyId, p_lote: lote });
    setDesfazendo(false);
    if (error) { toast.error("Não consegui desfazer: " + error.message); return; }
    const r = data as unknown as { recebiveis_removidos: number; contas_removidas: number; mantidos_com_baixa: number };
    qc.invalidateQueries({ queryKey: ["receivables"] });
    qc.invalidateQueries({ queryKey: ["bills_payable"] });
    toast.success(
      `Importação desfeita: ${r.recebiveis_removidos + r.contas_removidas} títulos removidos.` +
        (r.mantidos_com_baixa > 0
          ? ` ${r.mantidos_com_baixa} ficaram porque já receberam baixa e apagar seria perder dinheiro conciliado.`
          : ""),
    );
    fechar(false);
  };

  const previa = rows.slice(0, 5);
  const totalPrevisto = rows.reduce((s, l) => {
    const v = parseValorBR(valorCel(l, "valor"));
    return s + (Number.isFinite(v) ? v : 0);
  }, 0);

  const substantivo = tipo === "receivable" ? "contas a receber" : "contas a pagar";

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "done" ? "Carga concluída" : `Importar ${substantivo} de planilha`}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Suba a planilha com a carteira em aberto, em CSV ou XLSX, com as colunas que você já usa. Na próxima
              etapa você aponta qual coluna é o quê. Sem esta carga, o sistema começa mostrando inadimplência zero
              quando ela não é zero.
            </p>
            <input
              ref={ref}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={onFile}
            />
            <Button onClick={() => ref.current?.click()} disabled={parsing} className="gap-2">
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              Escolher arquivo
            </Button>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {fileName} · {rows.length} linhas · {formatCurrency(totalPrevisto)} no total
            </p>

            <div className="grid gap-3">
              {CAMPOS.map((campo) => (
                <div key={campo.key} className="grid grid-cols-[1fr_1.2fr] items-center gap-3">
                  <Label className="text-sm">
                    {campo.label}
                    {campo.required && <span className="text-[hsl(var(--destructive))]"> *</span>}
                  </Label>
                  <Select
                    value={mapa[campo.key] ?? IGNORAR}
                    onValueChange={(v) => setMapa((m) => ({ ...m, [campo.key]: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={IGNORAR}>Não importar</SelectItem>
                      {headers.map((h, i) => (
                        <SelectItem key={i} value={String(i)}>{h || `Coluna ${i + 1}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {previa.length > 0 && (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      {CAMPOS.map((c) => <th key={c.key} className="px-2 py-1.5 text-left font-medium">{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {previa.map((l, i) => (
                      <tr key={i} className="border-t border-border">
                        {CAMPOS.map((c) => (
                          <td key={c.key} className="px-2 py-1.5 whitespace-nowrap">
                            {c.key === "vencimento"
                              ? (parseDataBR(valorCel(l, c.key)) ?? <span className="text-[hsl(var(--destructive))]">data inválida</span>)
                              : valorCel(l, c.key) || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("upload")} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button onClick={importar} disabled={importing}>
                {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Importar {rows.length} linhas
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && resultado && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-revenue mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{resultado.ok} títulos importados.</p>
                {resultado.ignoradas > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {resultado.ignoradas} linhas ficaram de fora porque não dava para afirmar o valor ou a data.
                  </p>
                )}
              </div>
            </div>

            {resultado.motivos.length > 0 && (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 space-y-0.5">
                {resultado.motivos.map((m, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground">{m}</p>
                ))}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={desfazer} disabled={desfazendo} className="gap-1">
                {desfazendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                Desfazer esta importação
              </Button>
              <Button onClick={() => fechar(false)}>Concluir</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
