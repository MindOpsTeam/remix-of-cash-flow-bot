import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RotateCcw, Undo2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useBaixaTitulo, useBaixasDoTitulo, type TipoTitulo } from "@/hooks/useBaixaTitulo";

export interface TituloParaBaixa {
  id: string;
  descricao: string;
  valor: number;
  valorBaixado: number;
  vencimento: string;
}

interface Props {
  kind: TipoTitulo;
  titulo: TituloParaBaixa | null;
  contas: Array<{ id: string; name: string }>;
  onClose: () => void;
}

/** Aceita "1.234,56" e "1234.56". Vazio é zero, não erro. */
function paraNumero(v: string): number {
  const limpo = v.trim();
  if (!limpo) return 0;
  const n = Number(limpo.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

const hojeISO = () => new Date().toISOString().split("T")[0];

/**
 * Diálogo de baixa. Antes o sistema só sabia quitar o título inteiro: quem
 * recebia 300 de um título de 1000, cobrava juros de atraso ou concedia
 * desconto não tinha onde registrar, e acabava apagando o título ou lançando o
 * valor solto.
 *
 * O resumo em tempo real existe porque juros e desconto puxam o número para
 * lados opostos: sem ver "abate X, entra Y" antes de confirmar, o operador erra
 * e só descobre na conciliação do mês seguinte.
 */
export function DialogBaixaTitulo({ kind, titulo, contas, onClose }: Props) {
  const { baixar, estornar } = useBaixaTitulo();
  const { data: historico = [] } = useBaixasDoTitulo(kind, titulo?.id ?? null);

  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeISO);
  const [juros, setJuros] = useState("");
  const [multa, setMulta] = useState("");
  const [desconto, setDesconto] = useState("");
  const [conta, setConta] = useState<string>("");
  const [estornando, setEstornando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const saldo = titulo ? Math.max(0, titulo.valor - titulo.valorBaixado) : 0;

  const numeros = useMemo(() => {
    const pago = paraNumero(valor);
    const j = paraNumero(juros);
    const m = paraNumero(multa);
    const d = paraNumero(desconto);
    const encargos = j + m;
    const principal = pago - encargos;
    return { pago, j, m, d, encargos, principal, abate: principal + d };
  }, [valor, juros, multa, desconto]);

  const invalido =
    !titulo ||
    Number.isNaN(numeros.pago) ||
    numeros.pago <= 0 ||
    Number.isNaN(numeros.abate) ||
    numeros.principal <= 0;

  const palavra = kind === "receivable" ? "recebido" : "pago";

  const confirmar = () => {
    if (!titulo || invalido) return;
    baixar.mutate(
      {
        kind,
        titleId: titulo.id,
        valorPago: numeros.pago,
        data,
        juros: numeros.j,
        multa: numeros.m,
        desconto: numeros.d,
        bankAccountId: conta || null,
      },
      { onSuccess: onClose },
    );
  };

  const baixasVivas = historico.filter((h) => !h.estorno_de);
  const estornadas = new Set(historico.filter((h) => h.estorno_de).map((h) => h.estorno_de!));

  return (
    <Dialog open={!!titulo} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Dar baixa</DialogTitle>
          <DialogDescription>
            {titulo?.descricao} · {formatCurrency(titulo?.valor ?? 0)}
            {titulo && titulo.valorBaixado > 0 && (
              <> · já baixado {formatCurrency(titulo.valorBaixado)}, faltam {formatCurrency(saldo)}</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor {palavra} *</Label>
              <Input
                inputMode="decimal"
                autoFocus
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder={saldo ? String(saldo).replace(".", ",") : "0,00"}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Juros</Label>
              <Input inputMode="decimal" value={juros} onChange={(e) => setJuros(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Multa</Label>
              <Input inputMode="decimal" value={multa} onChange={(e) => setMulta(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Desconto</Label>
              <Input inputMode="decimal" value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0,00" />
            </div>
          </div>

          {contas.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Conta bancária</Label>
              <Select value={conta} onValueChange={setConta}>
                <SelectTrigger><SelectValue placeholder="Sem conta atribuída" /></SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Sem conta atribuída, este lançamento não entra na conferência de saldo com o banco.
              </p>
            </div>
          )}

          {/* Juros e desconto puxam o número para lados opostos. Mostrar as duas
              consequências antes de confirmar evita o erro que só apareceria na
              conciliação do mês seguinte. */}
          {!Number.isNaN(numeros.pago) && numeros.pago > 0 && (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              <p>
                Entra no caixa: <strong className="tabular-nums">{formatCurrency(numeros.pago)}</strong>
              </p>
              <p>
                Abate do título: <strong className="tabular-nums">{formatCurrency(Math.max(0, numeros.abate))}</strong>
                {numeros.abate >= saldo - 0.01 ? " (quita)" : ` (restam ${formatCurrency(Math.max(0, saldo - numeros.abate))})`}
              </p>
              {numeros.encargos > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(numeros.encargos)} de juros e multa vão para a conta financeira, separados da
                  receita da venda, para não sujar a margem.
                </p>
              )}
              {numeros.principal <= 0 && (
                <p className="text-xs text-[hsl(var(--destructive))] mt-1">
                  O valor {palavra} precisa ser maior que juros mais multa.
                </p>
              )}
            </div>
          )}

          {baixasVivas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Baixas registradas</p>
              {baixasVivas.map((h) => {
                const jaEstornada = estornadas.has(h.id);
                return (
                  <div key={h.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm tabular-nums">
                        {formatCurrency(Number(h.amount))}
                        <span className="text-muted-foreground"> em {h.paid_at.split("-").reverse().join("/")}</span>
                      </p>
                      {(Number(h.juros) > 0 || Number(h.multa) > 0 || Number(h.desconto) > 0) && (
                        <p className="text-[11px] text-muted-foreground">
                          juros {formatCurrency(Number(h.juros))} · multa {formatCurrency(Number(h.multa))} · desconto{" "}
                          {formatCurrency(Number(h.desconto))}
                        </p>
                      )}
                      {jaEstornada && <p className="text-[11px] text-[hsl(var(--warning))]">estornada</p>}
                    </div>
                    {!jaEstornada && (
                      <Button variant="ghost" size="sm" className="shrink-0 gap-1" onClick={() => setEstornando(h.id)}>
                        <Undo2 className="h-3.5 w-3.5" /> Estornar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {estornando && (
            <div className="space-y-2 rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/[0.08] px-3 py-2">
              <Label className="text-xs">Por que está estornando?</Label>
              <Input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: Pix devolvido pelo banco"
              />
              <p className="text-[11px] text-muted-foreground">
                O estorno não apaga nada: cria o lançamento contrário e devolve o título ao estado anterior.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={motivo.trim().length < 5 || estornar.isPending}
                  onClick={() =>
                    estornar.mutate(
                      { pagamentoId: estornando, motivo: motivo.trim() },
                      { onSuccess: () => { setEstornando(null); setMotivo(""); } },
                    )
                  }
                >
                  {estornar.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
                  Confirmar estorno
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEstornando(null); setMotivo(""); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={confirmar} disabled={invalido || baixar.isPending}>
            {baixar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar baixa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
