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
import { Building2, Plus, Sparkles } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useStayCadastros, type StayUnit } from "@/hooks/useStay";

type Rascunho = Partial<StayUnit> & { property_id: string; code: string };

const VAZIO = (property_id: string): Rascunho => ({
  property_id,
  code: "",
  typology: "Studio",
  capacity: 2,
  payout_model: "percentual",
  payout_percent: 20,
  payout_fixed: 0,
  cleaning_fee: 0,
  cleaning_cost: 0,
  base_rate: 0,
  status: "ativa",
});

export default function Imoveis() {
  const { properties, units, isLoading, semear, salvarUnidade } = useStayCadastros();
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);

  const unidadesPorImovel = useMemo(() => {
    const mapa = new Map<string, StayUnit[]>();
    for (const u of units) mapa.set(u.property_id, [...(mapa.get(u.property_id) ?? []), u]);
    return mapa;
  }, [units]);

  const set = <K extends keyof Rascunho>(campo: K, valor: Rascunho[K]) =>
    setRascunho((r) => (r ? { ...r, [campo]: valor } : r));

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Imóveis e apartamentos"
          description="Os prédios da STAY e cada unidade em operação, com taxa de limpeza, custo e regra de repasse ao proprietário."
          actions={
            <Button variant="outline" size="sm" className="gap-2" onClick={() => semear.mutate()} disabled={semear.isPending}>
              <Sparkles className="h-4 w-4" /> Recarregar cadastros padrão
            </Button>
          }
        />

        {isLoading && <Skeleton className="h-40 w-full" />}

        {!isLoading && properties.length === 0 && (
          <EmptyState
            icon={Building2}
            title="Nenhum imóvel cadastrado"
            description="Carregue os imóveis da STAY (Goiânia e Palmas) e comece a cadastrar as unidades."
            action={
              <Button onClick={() => semear.mutate()} disabled={semear.isPending} className="gap-2">
                <Sparkles className="h-4 w-4" /> Carregar cadastros da STAY
              </Button>
            }
          />
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {properties.map((p) => {
            const lista = unidadesPorImovel.get(p.id) ?? [];
            return (
              <Card key={p.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[p.neighborhood, p.city, p.state].filter(Boolean).join(" · ") || "Sem endereço"}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="gap-1" onClick={() => setRascunho(VAZIO(p.id))}>
                      <Plus className="h-4 w-4" /> Unidade
                    </Button>
                  </div>

                  {lista.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma unidade cadastrada.</p>
                  ) : (
                    <ul className="divide-y text-sm">
                      {lista.map((u) => (
                        <li key={u.id} className="flex items-center justify-between gap-3 py-2">
                          <button
                            type="button"
                            className="truncate text-left hover:underline"
                            onClick={() => setRascunho(u as Rascunho)}
                          >
                            {u.code}
                            <span className="ml-2 text-xs text-muted-foreground">{u.typology}</span>
                          </button>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            diária {formatCurrency(Number(u.base_rate))} · limpeza {formatCurrency(Number(u.cleaning_fee))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={!!rascunho} onOpenChange={(o) => !o && setRascunho(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{rascunho?.id ? "Editar unidade" : "Nova unidade"}</DialogTitle>
          </DialogHeader>
          {rascunho && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="code">Identificação (ex.: Apto 1203)</Label>
                <Input id="code" value={rascunho.code} onChange={(e) => set("code", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="typology">Tipologia</Label>
                <Input id="typology" value={rascunho.typology ?? ""} onChange={(e) => set("typology", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="capacity">Capacidade</Label>
                <Input
                  id="capacity"
                  type="number"
                  min={1}
                  value={rascunho.capacity ?? 2}
                  onChange={(e) => set("capacity", Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="base_rate">Diária base (R$)</Label>
                <Input
                  id="base_rate"
                  type="number"
                  step="0.01"
                  value={rascunho.base_rate ?? 0}
                  onChange={(e) => set("base_rate", Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="cleaning_fee">Taxa de limpeza cobrada (R$)</Label>
                <Input
                  id="cleaning_fee"
                  type="number"
                  step="0.01"
                  value={rascunho.cleaning_fee ?? 0}
                  onChange={(e) => set("cleaning_fee", Number(e.target.value))}
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
                <Label>Modelo de repasse</Label>
                <Select value={rascunho.payout_model} onValueChange={(v) => set("payout_model", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentual">Percentual da receita</SelectItem>
                    <SelectItem value="fixo">Valor fixo garantido</SelectItem>
                    <SelectItem value="proprio">Imóvel próprio (sem repasse)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {rascunho.payout_model === "fixo" ? (
                <div>
                  <Label htmlFor="payout_fixed">Repasse fixo mensal (R$)</Label>
                  <Input
                    id="payout_fixed"
                    type="number"
                    step="0.01"
                    value={rascunho.payout_fixed ?? 0}
                    onChange={(e) => set("payout_fixed", Number(e.target.value))}
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="payout_percent">Repasse ao proprietário (%)</Label>
                  <Input
                    id="payout_percent"
                    type="number"
                    step="0.01"
                    value={rascunho.payout_percent ?? 0}
                    onChange={(e) => set("payout_percent", Number(e.target.value))}
                  />
                </div>
              )}
              <div className="col-span-2">
                <Label>Situação</Label>
                <Select value={rascunho.status ?? "ativa"} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Em operação</SelectItem>
                    <SelectItem value="manutencao">Em manutenção</SelectItem>
                    <SelectItem value="inativa">Fora de operação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRascunho(null)}>Cancelar</Button>
            <Button
              disabled={!rascunho?.code || salvarUnidade.isPending}
              onClick={() =>
                rascunho &&
                salvarUnidade.mutate(rascunho, { onSuccess: () => setRascunho(null) })
              }
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
