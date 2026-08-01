import { mensagemDeErro } from "@/lib/erros";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Warehouse, Plus, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

/**
 * Gestão de depósitos: a tabela warehouses existia sem tela nenhuma (o
 * depósito principal nasce sozinho no 1º movimento). Aqui: listar, criar e
 * definir o padrão.
 */
interface Deposito {
  id: string;
  name: string;
  is_default: boolean;
  active: boolean;
}

export function DepositosDialog() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");

  const depositos = useQuery({
    queryKey: ["warehouses", company?.id],
    enabled: !!company && aberto,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, name, is_default, active")
        .eq("company_id", company!.id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Deposito[];
    },
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["warehouses", company?.id] });

  const criar = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Dê um nome ao depósito.");
      const { error } = await supabase.from("warehouses").insert({
        company_id: company!.id,
        name: nome.trim(),
        is_default: (depositos.data ?? []).length === 0,
        active: true,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Depósito criado.");
      setNome("");
      invalidar();
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const tornarPadrao = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("warehouses").update({ is_default: false }).eq("company_id", company!.id);
      const { error } = await supabase.from("warehouses").update({ is_default: true }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Warehouse className="h-4 w-4" /> Depósitos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Depósitos</DialogTitle>
          <DialogDescription>Onde o estoque mora. O padrão recebe as movimentações automáticas.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            {(depositos.data ?? []).map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-foreground">
                  {d.name}
                  {d.is_default && <Badge variant="secondary" className="text-[10px]">padrão</Badge>}
                </span>
                {!d.is_default && (
                  <button
                    type="button"
                    onClick={() => tornarPadrao.mutate(d.id)}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={`Tornar ${d.name} o depósito padrão`}
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {(depositos.data ?? []).length === 0 && !depositos.isLoading && (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Nenhum depósito ainda; o principal nasce na primeira movimentação.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Loja Centro" />
            <Button className="gap-1.5" onClick={() => criar.mutate()} disabled={criar.isPending || !nome.trim()}>
              {criar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
