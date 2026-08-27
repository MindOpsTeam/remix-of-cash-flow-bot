import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarRange, Plus, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  useStayCadastros,
  useStayReservations,
  STATUS_RESERVA,
  STATUS_PAGAMENTO,
  type StayReservation,
} from "@/hooks/useStay";
import { mesPeriodo } from "@/lib/stay-metrics";

type Rascunho = Partial<StayReservation> & {
  unit_id: string;
  check_in: string;
  check_out: string;
};

const hoje = () => new Date().toISOString().slice(0, 10);

const VAZIO: Rascunho = {
  unit_id: "",
  channel_id: null,
  guest_name: "",
  check_in: hoje(),
  check_out: hoje(),
  guests: 2,
  nightly_rate: 0,
  cleaning_fee: 0,
  extras_total: 0,
  taxes: 0,
  cleaning_cost: 0,
  deposit: 0,
  status: "confirmada",
  payment_status: "pendente",
  source: "manual",
};

export default function Reservas() {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const periodo = useMemo(() => mesPeriodo(`${mes}-01`), [mes]);
  const { units, properties, channels } = useStayCadastros();
  const { reservations, isLoading, salvar, excluir } = useStayReservations(periodo.inicio, periodo.fim);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);

  const nomeUnidade = (id: string) => {
    const u = units.find((x) => x.id === id);
    if (!u) return "—";
    const p = properties.find((x) => x.id === u.property_id);
    return p ? `${p.name} · ${u.code}` : u.code;
  };

  const set = <K extends keyof Rascunho>(campo: K, valor: Rascunho[K]) =>
    setRascunho((r) => (r ? { ...r, [campo]: valor } : r));

  /** Ao escolher a unidade, herda diária, taxa e custo de limpeza do cadastro. */
  const escolherUnidade = (unitId: string) => {
    const u = units.find((x) => x.id === unitId);
    setRascunho((r) =>
      r
        ? {
            ...r,
            unit_id: unitId,
            nightly_rate: r.nightly_rate || Number(u?.base_rate ?? 0),
            cleaning_fee: r.cleaning_fee || Number(u?.cleaning_fee ?? 0),
            cleaning_cost: r.cleaning_cost || Number(u?.cleaning_cost ?? 0),
          }
        : r,
    );
  };

  const abrirNova = () => setRascunho({ ...VAZIO });

  const salvarRascunho = () => {
    if (!rascunho) return;
    salvar.mutate(
      { ...rascunho, nightly_rate: Number(rascunho.nightly_rate ?? 0) },
      { onSuccess: () => setRascunho(null) },
    );
  };

  const valido =
    !!rascunho?.unit_id && !!rascunho.check_in && !!rascunho.check_out && rascunho.check_out > rascunho.check_in;

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Reservas"
          description="Cada estadia com diárias, taxa de limpeza, comissão do canal e o que sobra para a STAY — os totais são calculados no banco."
          actions={
            <>
              <Input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="w-[160px]"
                aria-label="Mês de referência"
              />
              <Button size="sm" className="gap-2" onClick={abrirNova} disabled={units.length === 0}>
                <Plus className="h-4 w-4" /> Nova reserva
              </Button>
            </>
          }
        />

        {isLoading && <Skeleton className="h-40 w-full" />}

        {!isLoading && reservations.length === 0 && (
          <EmptyState
            icon={CalendarRange}
            title="Nenhuma reserva neste mês"
            description={
              units.length === 0
                ? "Cadastre primeiro os apartamentos em Imóveis para poder lançar reservas."
                : "Lance a primeira estadia do mês para acompanhar ocupação e resultado."
            }
            action={
              units.length > 0 ? (
                <Button onClick={abrirNova} className="gap-2">
                  <Plus className="h-4 w-4" /> Nova reserva
                </Button>
              ) : undefined
            }
          />
        )}

        {reservations.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="p-3 text-left font-medium">Apartamento</th>
                      <th className="p-3 text-left font-medium">Hóspede</th>
                      <th className="p-3 text-left font-medium">Estadia</th>
                      <th className="p-3 text-right font-medium">Noites</th>
                      <th className="p-3 text-right font-medium">Bruto</th>
                      <th className="p-3 text-right font-medium">Repasse</th>
                      <th className="p-3 text-right font-medium">Líquido STAY</th>
                      <th className="p-3 text-left font-medium">Situação</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reservations.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/40">
                        <td className="p-3">{nomeUnidade(r.unit_id)}</td>
                        <td className="p-3">{r.guest_name || "—"}</td>
                        <td className="p-3 text-muted-foreground">
                          {formatDate(r.check_in)} → {formatDate(r.check_out)}
                        </td>
                        <td className="p-3 text-right tabular-nums">{r.nights}</td>
                        <td className="p-3 text-right tabular-nums">{formatCurrency(Number(r.gross_total))}</td>
                        <td className="p-3 text-right tabular-nums">{formatCurrency(Number(r.owner_payout))}</td>
                        <td className="p-3 text-right tabular-nums font-medium">
                          {formatCurrency(Number(r.net_total))}
                        </td>
                        <td className="p-3">
                          <span className="text-xs text-muted-foreground">
                            {STATUS_RESERVA[r.status] ?? r.status} · {STATUS_PAGAMENTO[r.payment_status] ?? r.payment_status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setRascunho(r as Rascunho)}>
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label="Excluir reserva"
                              onClick={() => excluir.mutate(r.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!rascunho} onOpenChange={(o) => !o && setRascunho(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{rascunho?.id ? "Editar reserva" : "Nova reserva"}</DialogTitle>
          </DialogHeader>
          {rascunho && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Apartamento</Label>
                <Select value={rascunho.unit_id} onValueChange={escolherUnidade}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{nomeUnidade(u.id)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Canal</Label>
                <Select
                  value={rascunho.channel_id ?? "direto"}
                  onValueChange={(v) => set("channel_id", v === "direto" ? null : v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direto">Sem canal (direto)</SelectItem>
                    {channels.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="guest_name">Hóspede</Label>
                <Input id="guest_name" value={rascunho.guest_name ?? ""} onChange={(e) => set("guest_name", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="check_in">Check-in</Label>
                <Input id="check_in" type="date" value={rascunho.check_in} onChange={(e) => set("check_in", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="check_out">Check-out</Label>
                <Input id="check_out" type="date" value={rascunho.check_out} onChange={(e) => set("check_out", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="nightly_rate">Diária (R$)</Label>
                <Input
                  id="nightly_rate"
                  type="number"
                  step="0.01"
                  value={rascunho.nightly_rate ?? 0}
                  onChange={(e) => set("nightly_rate", Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="guests">Hóspedes</Label>
                <Input
                  id="guests"
                  type="number"
                  min={1}
                  value={rascunho.guests ?? 1}
                  onChange={(e) => set("guests", Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="cleaning_fee">Taxa de limpeza (R$)</Label>
                <Input
                  id="cleaning_fee"
                  type="number"
                  step="0.01"
                  value={rascunho.cleaning_fee ?? 0}
                  onChange={(e) => set("cleaning_fee", Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="extras_total">Outras taxas / extras (R$)</Label>
                <Input
                  id="extras_total"
                  type="number"
                  step="0.01"
                  value={rascunho.extras_total ?? 0}
                  onChange={(e) => set("extras_total", Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="cleaning_cost">Custo da limpeza (R$)</Label>
                <Input
                  id="cleaning_cost"
                  type="number"
                  step="0.01"
                  value={rascunho.cleaning_cost ?? 0}
                  onChange={(e) => set("cleaning_cost", Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="taxes">Impostos (R$)</Label>
                <Input
                  id="taxes"
                  type="number"
                  step="0.01"
                  value={rascunho.taxes ?? 0}
                  onChange={(e) => set("taxes", Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="deposit">Caução (R$)</Label>
                <Input
                  id="deposit"
                  type="number"
                  step="0.01"
                  value={rascunho.deposit ?? 0}
                  onChange={(e) => set("deposit", Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="external_code">Código no canal</Label>
                <Input
                  id="external_code"
                  value={rascunho.external_code ?? ""}
                  onChange={(e) => set("external_code", e.target.value)}
                />
              </div>
              <div>
                <Label>Situação da reserva</Label>
                <Select value={rascunho.status ?? "confirmada"} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_RESERVA).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pagamento</Label>
                <Select value={rascunho.payment_status ?? "pendente"} onValueChange={(v) => set("payment_status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_PAGAMENTO).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">
                Noites, total bruto, comissão do canal, taxa de pagamento e repasse ao proprietário são
                calculados automaticamente ao salvar, a partir do canal e do contrato da unidade.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRascunho(null)}>Cancelar</Button>
            <Button disabled={!valido || salvar.isPending} onClick={salvarRascunho}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
