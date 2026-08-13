import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type TipoContato = "customer" | "supplier" | "both";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | undefined;
  /** Tipo padrão aplicado quando a planilha não traz uma coluna de tipo. */
  defaultType: TipoContato;
}

/** Campos de destino no cadastro. `name` é o único obrigatório. */
const CAMPOS: { key: string; label: string; required?: boolean; aliases: string[] }[] = [
  { key: "name", label: "Razão Social / Nome", required: true, aliases: ["nome", "razao social", "razao", "name", "cliente", "fornecedor", "empresa", "contato"] },
  { key: "trade_name", label: "Nome Fantasia", aliases: ["fantasia", "nome fantasia", "trade name", "apelido"] },
  { key: "document", label: "CNPJ / CPF", aliases: ["cnpj", "cpf", "documento", "doc", "cnpj/cpf", "cnpj cpf", "inscricao", "cnpjcpf"] },
  { key: "email", label: "E-mail", aliases: ["email", "e-mail", "mail", "correio"] },
  { key: "phone", label: "Telefone", aliases: ["telefone", "fone", "phone", "tel", "celular"] },
  { key: "whatsapp", label: "WhatsApp", aliases: ["whatsapp", "zap", "wpp", "whats"] },
  { key: "city", label: "Cidade", aliases: ["cidade", "municipio", "city"] },
  { key: "state", label: "UF", aliases: ["uf", "estado", "state"] },
  { key: "notes", label: "Observações", aliases: ["observacao", "observacoes", "notas", "obs", "notes"] },
  { key: "type", label: "Tipo (cliente/fornecedor)", aliases: ["tipo", "type", "categoria"] },
];

const IGNORAR = "__ignorar__";
const CHUNK = 500;

const normaliza = (s: string) =>
  (s ?? "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const soDigitos = (s: string) => (s ?? "").toString().replace(/\D/g, "");

/** Deriva o tipo a partir do texto da planilha; cai no padrão da página se não bater. */
function resolveTipo(valor: string, padrao: TipoContato): TipoContato {
  const v = normaliza(valor);
  if (!v) return padrao;
  if (v.includes("forn")) return "supplier";
  if (v.includes("client")) return "customer";
  if (v.includes("ambos") || v.includes("both")) return "both";
  return padrao;
}

export function ContactsImportDialog({ open, onOpenChange, companyId, defaultType }: Props) {
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "map" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapa, setMapa] = useState<Record<string, string>>({}); // campo -> índice da coluna (string) ou IGNORAR
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resultado, setResultado] = useState<{ ok: number; ignoradas: number } | null>(null);

  const reset = () => {
    setStep("upload"); setFileName(""); setHeaders([]); setRows([]);
    setMapa({}); setParsing(false); setImporting(false); setResultado(null);
    if (ref.current) ref.current.value = "";
  };

  const fechar = (v: boolean) => { if (!v) reset(); onOpenChange(v); };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    try {
      // xlsx é pesado: carrega sob demanda só quando o usuário importa (code-split).
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      // raw:false preserva a formatação (CNPJ com zeros à esquerda, datas como texto).
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][];
      const linhas = aoa.filter((l) => Array.isArray(l) && l.some((c) => String(c ?? "").trim() !== ""));
      if (linhas.length < 2) {
        toast.error("A planilha precisa de um cabeçalho e ao menos uma linha de dados.");
        setParsing(false);
        return;
      }
      const cab = (linhas[0] as unknown[]).map((c) => String(c ?? "").trim());
      const dados = linhas.slice(1).map((l) => cab.map((_, i) => String((l as unknown[])[i] ?? "").trim()));

      // Auto-mapeia por nome de coluna; a tabela se adapta ao que veio no arquivo.
      const guess: Record<string, string> = {};
      const usados = new Set<number>();
      for (const campo of CAMPOS) {
        const idx = cab.findIndex((h, i) => !usados.has(i) && campo.aliases.some((a) => normaliza(h) === a || normaliza(h).includes(a)));
        if (idx >= 0) { guess[campo.key] = String(idx); usados.add(idx); }
        else guess[campo.key] = IGNORAR;
      }
      setFileName(file.name);
      setHeaders(cab);
      setRows(dados);
      setMapa(guess);
      setStep("map");
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
    if (mapa.name === IGNORAR || mapa.name === undefined) {
      toast.error("Aponte qual coluna é o Nome / Razão Social.");
      return;
    }
    setImporting(true);
    try {
      const registros = rows
        .map((linha) => {
          const name = valorCel(linha, "name").trim();
          if (!name) return null;
          const doc = soDigitos(valorCel(linha, "document"));
          const person_type = doc.length === 11 ? "pf" : doc.length === 14 ? "pj" : "pj";
          const type = mapa.type !== IGNORAR ? resolveTipo(valorCel(linha, "type"), defaultType) : defaultType;
          return {
            company_id: companyId,
            name,
            trade_name: valorCel(linha, "trade_name").trim() || null,
            type,
            person_type,
            document: doc || null,
            email: valorCel(linha, "email").trim() || null,
            phone: soDigitos(valorCel(linha, "phone")) || null,
            whatsapp: soDigitos(valorCel(linha, "whatsapp")) || null,
            city: valorCel(linha, "city").trim() || null,
            state: valorCel(linha, "state").trim().toUpperCase().slice(0, 2) || null,
            notes: valorCel(linha, "notes").trim() || null,
            active: true,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      const ignoradas = rows.length - registros.length;
      let ok = 0;
      for (let i = 0; i < registros.length; i += CHUNK) {
        const lote = registros.slice(i, i + CHUNK);
        const { error } = await supabase.from("contacts").insert(lote);
        if (error) throw error;
        ok += lote.length;
      }
      qc.invalidateQueries({ queryKey: ["contacts"] });
      setResultado({ ok, ignoradas });
      setStep("done");
    } catch (err: unknown) {
      toast.error("Falha ao importar: " + (err instanceof Error ? err.message : "erro desconhecido"));
    } finally {
      setImporting(false);
    }
  };

  const previa = rows.slice(0, 5);
  const camposMapeados = CAMPOS.filter((c) => mapa[c.key] && mapa[c.key] !== IGNORAR);

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "done" ? "Importação concluída" : "Importar de planilha (CSV ou XLSX)"}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Suba um arquivo CSV ou XLSX com qualquer conjunto de colunas. Na próxima etapa você aponta
              qual coluna é o quê; o cadastro se adapta ao que estiver no arquivo.
            </p>
            <input ref={ref} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={onFile} />
            <button
              type="button"
              onClick={() => ref.current?.click()}
              disabled={parsing}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              {parsing ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <FileUp className="h-6 w-6 text-muted-foreground" />}
              <span className="font-medium">{parsing ? "Lendo o arquivo..." : "Clique para escolher o arquivo"}</span>
              <span className="text-xs text-muted-foreground">A primeira linha deve ser o cabeçalho das colunas.</span>
            </button>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{fileName}</span> · {rows.length} linha{rows.length !== 1 ? "s" : ""} de dados.
              Confira o mapeamento (já adivinhamos pelas colunas):
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CAMPOS.map((campo) => (
                <div key={campo.key} className="flex items-center gap-2">
                  <Label className="w-40 shrink-0 text-xs">
                    {campo.label}{campo.required && <span className="text-destructive"> *</span>}
                  </Label>
                  <Select value={mapa[campo.key] ?? IGNORAR} onValueChange={(v) => setMapa((m) => ({ ...m, [campo.key]: v }))}>
                    <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={IGNORAR}>— ignorar —</SelectItem>
                      {headers.map((h, i) => (
                        <SelectItem key={i} value={String(i)}>{h || `Coluna ${i + 1}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {camposMapeados.length > 0 && (
              <div className="rounded-lg border border-border">
                <div className="border-b border-border bg-muted/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Prévia (5 primeiras linhas)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        {camposMapeados.map((c) => (
                          <th key={c.key} className="whitespace-nowrap px-3 py-1.5 text-left font-medium text-muted-foreground">{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previa.map((linha, r) => (
                        <tr key={r} className="border-b border-border/50 last:border-0">
                          {camposMapeados.map((c) => (
                            <td key={c.key} className="max-w-[160px] truncate px-3 py-1.5">{valorCel(linha, c.key)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "done" && resultado && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-income" />
            <p className="text-sm font-medium">{resultado.ok} contato{resultado.ok !== 1 ? "s" : ""} importado{resultado.ok !== 1 ? "s" : ""}.</p>
            {resultado.ignoradas > 0 && (
              <p className="text-xs text-muted-foreground">{resultado.ignoradas} linha{resultado.ignoradas !== 1 ? "s" : ""} sem nome foram ignoradas.</p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "map" && (
            <Button variant="outline" onClick={reset} disabled={importing}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Trocar arquivo
            </Button>
          )}
          {step === "map" ? (
            <Button onClick={importar} disabled={importing}>
              {importing ? "Importando..." : `Importar ${rows.length} linha${rows.length !== 1 ? "s" : ""}`}
            </Button>
          ) : (
            <Button variant={step === "done" ? "default" : "outline"} onClick={() => fechar(false)}>
              {step === "done" ? "Concluir" : "Cancelar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
