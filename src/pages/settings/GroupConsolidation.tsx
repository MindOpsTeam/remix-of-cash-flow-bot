import { mensagemDeErro } from "@/lib/erros";
import { AppLayout } from "@/components/AppLayout";
import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Layers, Save, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

interface AccountRow {
  id: string;
  company_id: string;
  code: string | null;
  name: string;
  type: string;
  group_code: string | null;
  group_name: string | null;
}

interface GroupedAccount {
  key: string;
  code: string | null;
  name: string;
  type: string;
  companyCount: number;
  ids: string[];
  group_code: string | null;
  group_name: string | null;
}

export default function GroupConsolidation() {
  const { companies } = useCompany();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, { code: string; name: string }>>({});
  const [filter, setFilter] = useState("");

  const companyIds = useMemo(() => companies.map((c) => c.id), [companies]);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["group_consolidation_accounts", companyIds],
    enabled: companyIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("chart_of_accounts")
        .select("id, company_id, code, name, type, group_code, group_name")
        .in("company_id", companyIds)
        .order("code");
      if (error) throw error;
      return (data ?? []) as AccountRow[];
    },
  });

  // Agrupa contas idênticas (code+name) entre CNPJs — padronizar 1x aplica em todas
  const grouped = useMemo<GroupedAccount[]>(() => {
    const map = new Map<string, GroupedAccount>();
    for (const a of accounts) {
      const key = `${a.code ?? ""}|${a.name.toLowerCase().trim()}`;
      const g = map.get(key);
      if (g) {
        g.ids.push(a.id);
        g.companyCount = new Set([...g.ids.map((id) => accounts.find((x) => x.id === id)?.company_id)]).size;
        if (!g.group_code && a.group_code) {
          g.group_code = a.group_code;
          g.group_name = a.group_name;
        }
      } else {
        map.set(key, {
          key,
          code: a.code,
          name: a.name,
          type: a.type,
          companyCount: 1,
          ids: [a.id],
          group_code: a.group_code,
          group_name: a.group_name,
        });
      }
    }
    return [...map.values()].sort((a, b) => (a.code ?? "").localeCompare(b.code ?? ""));
  }, [accounts]);

  const visible = grouped.filter((g) => {
    if (!filter.trim()) return true;
    const f = filter.toLowerCase();
    return g.name.toLowerCase().includes(f) || (g.code ?? "").includes(f) || (g.group_code ?? "").includes(f);
  });

  const save = useMutation({
    mutationFn: async (g: GroupedAccount) => {
      const draft = drafts[g.key];
      if (!draft) return;
      const { error } = await (supabase as any)
        .from("chart_of_accounts")
        .update({
          group_code: draft.code.trim() || null,
          group_name: draft.name.trim() || null,
        })
        .in("id", g.ids);
      if (error) throw error;
    },
    onSuccess: (_d, g) => {
      toast.success("Mapeamento salvo");
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[g.key];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["group_consolidation_accounts"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar: " + mensagemDeErro(e)),
  });

  const autoFill = () => {
    // Sugestão determinística: usa o próprio code+name como conta do grupo
    const next: Record<string, { code: string; name: string }> = {};
    for (const g of visible) {
      if (!g.group_code) next[g.key] = { code: g.code ?? "", name: g.name };
    }
    setDrafts((prev) => ({ ...next, ...prev }));
    toast.info(`${Object.keys(next).length} sugestões preenchidas — revise e salve as que quiser`);
  };

  const mapped = grouped.filter((g) => g.group_code).length;

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold tracking-[-0.02em]">Plano de contas do grupo</h1>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Mapeie contas equivalentes dos {companies.length} CNPJs para uma conta do grupo — a DRE consolidada agrupa por ela.{" "}
              <Link to="/consolidado" className="underline underline-offset-2 hover:text-foreground">
                Ver a DRE consolidada
              </Link>
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar por código, nome ou conta do grupo..."
            className="max-w-sm"
          />
          <Button variant="outline" size="sm" className="gap-2" onClick={autoFill}>
            <Wand2 className="h-4 w-4" /> Sugerir para não mapeadas
          </Button>
          <Badge variant="secondary">{mapped} de {grouped.length} mapeadas</Badge>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Conta</th>
                  <th className="px-3 py-2">CNPJs</th>
                  <th className="px-3 py-2">Código do grupo</th>
                  <th className="px-3 py-2">Nome no grupo</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, 200).map((g) => {
                  const draft = drafts[g.key] ?? { code: g.group_code ?? "", name: g.group_name ?? "" };
                  const dirty = draft.code !== (g.group_code ?? "") || draft.name !== (g.group_name ?? "");
                  return (
                    <tr key={g.key} className="border-t border-border">
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs text-muted-foreground">{g.code}</span>{" "}
                        {g.name}
                      </td>
                      <td className="px-3 py-2"><Badge variant="outline">{g.ids.length}</Badge></td>
                      <td className="px-3 py-2">
                        <Input
                          value={draft.code}
                          onChange={(e) => setDrafts((p) => ({ ...p, [g.key]: { ...draft, code: e.target.value } }))}
                          className="h-8 w-28 font-mono text-xs"
                          placeholder="3.1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={draft.name}
                          onChange={(e) => setDrafts((p) => ({ ...p, [g.key]: { ...draft, name: e.target.value } }))}
                          className="h-8 min-w-48 text-xs"
                          placeholder="Receita de Serviços"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!dirty || save.isPending}
                          onClick={() => {
                            setDrafts((p) => ({ ...p, [g.key]: draft }));
                            save.mutate({ ...g });
                          }}
                          className="gap-1"
                        >
                          <Save className="h-3.5 w-3.5" /> Salvar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visible.length > 200 && (
              <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                Mostrando 200 de {visible.length} — use o filtro para refinar.
              </p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
