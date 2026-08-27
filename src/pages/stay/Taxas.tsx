import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Plus, Sparkles } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useStayCadastros, type StayChannel, type StayFeeType } from "@/hooks/useStay";

const CATEGORIAS: Record<string, string> = {
  limpeza: "Limpeza",
  extra: "Extra / serviço",
  penalidade: "Multa / cancelamento",
  caucao: "Caução",
  custo: "Custo operacional",
  comissao: "Comissão / gateway",
};

export default function Taxas() {
  const { channels, feeTypes, isLoading, salvarCanal, salvarTaxa, semear } = useStayCadastros();
  const [canal, setCanal] = useState<Partial<StayChannel> | null>(null);
  const [taxa, setTaxa] = useState<Partial<StayFeeType> | null>(null);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Canais e taxas"
          description="Comissão de cada canal de venda e o catálogo de taxas da temporada: limpeza, enxoval, hóspede extra, pet, late check-out e mais."
          actions={
            <Button variant="outline" size="sm" className="gap-2" onClick={() => semear.mutate()} disabled={semear.isPending}>
              <Sparkles className="h-4 w-4" /> Recarregar padrões
            </Button>
          }
        />

        {isLoading && <Skeleton className="h-40 w-full" />}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Canais de venda</CardTitle>
              <Button size="sm" variant="ghost" className="gap-1" onClick={() => setCanal({ name: "", commission_percent: 0, payment_fee_percent: 0, active: true })}>
                <Plus className="h-4 w-4" /> Canal
              </Button>
            </CardHeader>
            <CardContent className="divide-y text-sm">
              {channels.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCanal(c)}
                  className="flex w-full items-center justify-between gap-3 py-2 text-left hover:underline"
                >
                  <span>{c.name}{!c.active && <span className="ml-2 text-xs text-muted-foreground">inativo</span>}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    comissão {Number(c.commission_percent)}% · gateway {Number(c.payment_fee_percent)}%
                  </span>
                </button>
              ))}
              {channels.length === 0 && <p className="py-2 text-muted-foreground">Nenhum canal cadastrado.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Taxas e serviços</CardTitle>
              <Button size="sm" variant="ghost" className="gap-1" onClick={() => setTaxa({ name: "", category: "extra", nature: "receita", default_amount: 0, taxable: true, active: true })}>
                <Plus className="h-4 w-4" /> Taxa
              </Button>
            </CardHeader>
            <CardContent className="divide-y text-sm">
              {feeTypes.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTaxa(f)}
                  className="flex w-full items-center justify-between gap-3 py-2 text-left hover:underline"
                >
                  <span className="truncate">
                    {f.name}
                    <span className="ml-2 text-xs text-muted-foreground">{CATEGORIAS[f.category] ?? f.category}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {f.nature === "custo" ? "custo " : ""}
                    {formatCurrency(Number(f.default_amount))}
                  </span>
                </button>
              ))}
              {feeTypes.length === 0 && <p className="py-2 text-muted-foreground">Nenhuma taxa cadastrada.</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!canal} onOpenChange={(o) => !o && setCanal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{canal?.id ? "Editar canal" : "Novo canal"}</DialogTitle></DialogHeader>
          {canal && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="canal-nome">Nome</Label>
                <Input id="canal-nome" value={canal.name ?? ""} onChange={(e) => setCanal({ ...canal, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="canal-comissao">Comissão (%)</Label>
                  <Input
                    id="canal-comissao"
                    type="number"
                    step="0.01"
                    value={canal.commission_percent ?? 0}
                    onChange={(e) => setCanal({ ...canal, commission_percent: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="canal-gateway">Taxa de pagamento (%)</Label>
                  <Input
                    id="canal-gateway"
                    type="number"
                    step="0.01"
                    value={canal.payment_fee_percent ?? 0}
                    onChange={(e) => setCanal({ ...canal, payment_fee_percent: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="canal-ativo">Canal ativo</Label>
                <Switch
                  id="canal-ativo"
                  checked={canal.active ?? true}
                  onCheckedChange={(v) => setCanal({ ...canal, active: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCanal(null)}>Cancelar</Button>
            <Button
              disabled={!canal?.name || salvarCanal.isPending}
              onClick={() => canal && salvarCanal.mutate(canal, { onSuccess: () => setCanal(null) })}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!taxa} onOpenChange={(o) => !o && setTaxa(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{taxa?.id ? "Editar taxa" : "Nova taxa"}</DialogTitle></DialogHeader>
          {taxa && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="taxa-nome">Nome</Label>
                <Input id="taxa-nome" value={taxa.name ?? ""} onChange={(e) => setTaxa({ ...taxa, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Select value={taxa.category ?? "extra"} onValueChange={(v) => setTaxa({ ...taxa, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORIAS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Natureza</Label>
                  <Select value={taxa.nature ?? "receita"} onValueChange={(v) => setTaxa({ ...taxa, nature: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receita">Receita (cobra do hóspede)</SelectItem>
                      <SelectItem value="custo">Custo (sai do caixa)</SelectItem>
                      <SelectItem value="reembolsavel">Reembolsável (caução)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="taxa-valor">Valor padrão (R$)</Label>
                <Input
                  id="taxa-valor"
                  type="number"
                  step="0.01"
                  value={taxa.default_amount ?? 0}
                  onChange={(e) => setTaxa({ ...taxa, default_amount: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="taxa-tributavel">Compõe a base de imposto</Label>
                <Switch
                  id="taxa-tributavel"
                  checked={taxa.taxable ?? true}
                  onCheckedChange={(v) => setTaxa({ ...taxa, taxable: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="taxa-ativa">Taxa ativa</Label>
                <Switch
                  id="taxa-ativa"
                  checked={taxa.active ?? true}
                  onCheckedChange={(v) => setTaxa({ ...taxa, active: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTaxa(null)}>Cancelar</Button>
            <Button
              disabled={!taxa?.name || salvarTaxa.isPending}
              onClick={() => taxa && salvarTaxa.mutate(taxa, { onSuccess: () => setTaxa(null) })}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
