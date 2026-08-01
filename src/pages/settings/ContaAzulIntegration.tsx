import { mensagemDeErro } from "@/lib/erros";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CloudDownload, KeyRound, Loader2, PlugZap, Users, Wallet } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

/**
 * Conta Azul: credenciais no Vault (padrão Focus) e importação assistida.
 * O trilho de migração de quem já usa Conta Azul: cadastros primeiro, depois
 * o financeiro em aberto. Nada entra no DRE — recebível e conta a pagar
 * seguem o fluxo normal do produto.
 */

interface CaConfig {
  client_id_preview: string | null;
  ativo: boolean;
  last_import_at: string | null;
  last_import_result: Record<string, unknown> | null;
}

type ConfigFrom = (table: string) => {
  select: (q: string) => {
    eq: (c: string, v: string) => {
      maybeSingle: () => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    };
  };
};

export default function ContaAzulIntegration() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [importando, setImportando] = useState<"cadastros" | "financeiro" | null>(null);

  const config = useQuery({
    queryKey: ["contaazul_config", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await (supabase.from as unknown as ConfigFrom)("contaazul_config")
        .select("client_id_preview, ativo, last_import_at, last_import_result")
        .eq("company_id", company!.id)
        .maybeSingle();
      return (data ?? null) as CaConfig | null;
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, string>) => PromiseLike<{ error: { message: string } | null }>)(
        "set_contaazul_credentials",
        {
          p_company_id: company!.id,
          p_client_id: clientId,
          p_client_secret: clientSecret,
          p_refresh_token: refreshToken,
        },
      );
      if (error) throw new Error(error.message);
      const { data, error: testErr } = await supabase.functions.invoke("contaazul-import", {
        body: { action: "test", company_id: company!.id },
      });
      if (testErr || (data as { error?: string })?.error) {
        throw new Error("Credenciais salvas, mas o teste falhou. Confira o refresh_token.");
      }
    },
    onSuccess: () => {
      toast.success("Conta Azul conectada e testada.");
      setClientId("");
      setClientSecret("");
      setRefreshToken("");
      queryClient.invalidateQueries({ queryKey: ["contaazul_config", company?.id] });
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  async function importar(tipo: "cadastros" | "financeiro") {
    if (!company) return;
    setImportando(tipo);
    try {
      const { data, error } = await supabase.functions.invoke("contaazul-import", {
        body: { action: `import-${tipo}`, company_id: company.id },
      });
      if (error) throw error;
      const r = data as Record<string, { gravados?: number; gravadas?: number; pulados?: number }>;
      const partes =
        tipo === "cadastros"
          ? [`${r.contatos?.gravados ?? 0} contato(s)`, `${r.produtos?.gravados ?? 0} produto(s)/serviço(s)`]
          : [`${r.recebiveis?.gravados ?? 0} recebível(is)`, `${r.contas_a_pagar?.gravadas ?? 0} conta(s) a pagar`];
      toast.success(`Importado: ${partes.join(" · ")}.`);
      queryClient.invalidateQueries({ queryKey: ["contaazul_config", company.id] });
    } catch (e) {
      toast.error("Importação falhou: " + mensagemDeErro(e));
    } finally {
      setImportando(null);
    }
  }

  const conectado = !!config.data?.client_id_preview;

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-[-0.02em] text-foreground">
            <PlugZap className="h-6 w-6 text-primary" /> Conta Azul
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Traga clientes, produtos e o financeiro em aberto de quem já opera no Conta Azul.
            {conectado && (
              <Badge variant="secondary" className="ml-2">conectado · {config.data?.client_id_preview}</Badge>
            )}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-muted-foreground" /> 1 · Credenciais da API v2
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Do portal developers.contaazul.com. Ficam no cofre do banco (Vault); a tela só guarda um preview.
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Client ID</Label>
              <Input value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label>Client Secret</Label>
              <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label>Refresh Token</Label>
              <Input type="password" value={refreshToken} onChange={(e) => setRefreshToken(e.target.value)} autoComplete="off" />
            </div>
            <Button
              className="gap-2"
              onClick={() => salvar.mutate()}
              disabled={salvar.isPending || !clientId || !clientSecret || !refreshToken || !company}
            >
              {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Salvar e testar
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <CloudDownload className="h-4 w-4 text-muted-foreground" /> 2 · Importar
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Rodar de novo não duplica: cada registro carrega a identidade de origem. Só o financeiro EM ABERTO entra;
            histórico pago não polui o aging nem o DRE.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              disabled={!conectado || importando !== null}
              onClick={() => importar("cadastros")}
            >
              {importando === "cadastros" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              Clientes, fornecedores e produtos
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={!conectado || importando !== null}
              onClick={() => importar("financeiro")}
            >
              {importando === "financeiro" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              Financeiro em aberto
            </Button>
          </div>
          {config.data?.last_import_at && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Última importação: {new Date(config.data.last_import_at).toLocaleString("pt-BR")}
            </p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
