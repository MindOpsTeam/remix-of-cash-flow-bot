import { AppLayout } from "@/components/AppLayout";
import { mensagemDeErro } from "@/lib/erros";
import { usePlataformaStatus } from "@/hooks/usePlataformaStatus";
import { cadastroEstaAberto } from "@/lib/rpc-plataforma";
import { ArrowLeft, Crown, User, Copy, Check, DoorClosed, DoorOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Member {
  id: string;
  user_id: string;
  role: string;
  approval_limit: number | null;
  created_at: string;
}

export default function Users() {
  const { company } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");

  const qc = useQueryClient();
  const [limits, setLimits] = useState<Record<string, string>>({});
  const { souDono } = usePlataformaStatus();

  // Como novos usuários entram na instalação: por convite (padrão) ou por
  // autosserviço. É decisão do dono da plataforma, não de cada empresa.
  const portao = useQuery({
    queryKey: ["cadastro-aberto"],
    queryFn: cadastroEstaAberto,
  });

  const mudarPortao = useMutation({
    mutationFn: async (aberto: boolean) => {
      const { error } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, boolean>,
      ) => PromiseLike<{ error: { message: string } | null }>)("definir_cadastro_aberto", {
        p_aberto: aberto,
      });
      if (error) throw error;
      return aberto;
    },
    onSuccess: (aberto) => {
      qc.invalidateQueries({ queryKey: ["cadastro-aberto"] });
      toast({
        title: aberto ? "Autosserviço liberado" : "Entrada só por convite",
        description: aberto
          ? "Qualquer pessoa com o endereço pode criar conta e a própria empresa."
          : "Novos usuários entram apenas com um link de convite gerado aqui.",
      });
    },
    onError: (e) => toast({ title: "Não deu para mudar", description: mensagemDeErro(e), variant: "destructive" }),
  });

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["company_members", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_members")
        .select("id, user_id, role, approval_limit, created_at")
        .eq("company_id", company!.id)
        .order("created_at");
      if (error) throw error;
      return data as Member[];
    },
  });

  const saveLimit = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const parsed = value.trim() === "" ? null : parseFloat(value.replace(/\./g, "").replace(",", "."));
      const { error } = await (supabase as any)
        .from("company_members")
        .update({ approval_limit: parsed })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Alçada atualizada" });
      qc.invalidateQueries({ queryKey: ["company_members", company?.id] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Convite REAL: token próprio de uma vaga, com papel e validade de 7 dias.
  // (O link antigo /?invite=<company_id> não era consumido por nada — gap
  // fechado junto com a RPC aceitar_convite.)
  const gerarConvite = async () => {
    if (!company) return;
    const { data: sessao } = await supabase.auth.getUser();
    const { data, error } = await (supabase.from as unknown as (t: string) => {
      insert: (row: Record<string, unknown>) => {
        select: (q: string) => { single: () => PromiseLike<{ data: { token: string } | null; error: { message: string } | null }> };
      };
    })("company_invites")
      .insert({ company_id: company.id, role: inviteRole, criado_por: sessao.user?.id })
      .select("token")
      .single();
    if (error || !data) {
      toast({ title: "Erro ao gerar convite", description: error?.message, variant: "destructive" });
      return;
    }
    const link = `${window.location.origin}/?invite=${data.token}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Convite copiado!",
      description: `Vale por 7 dias, para 1 pessoa, com papel ${inviteRole === "admin" ? "Admin" : inviteRole === "viewer" ? "Leitura" : "Membro"}.`,
    });
  };

  const joinedAt = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <AppLayout>
      <div className="mb-6 flex items-center gap-3">
        <Link to="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Usuários</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Membros com acesso à empresa</p>
        </div>
      </div>

      <div className="max-w-lg space-y-4">

        {/* Members list */}
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {isLoading && (
            <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
          )}
          {!isLoading && members.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">Nenhum membro encontrado.</div>
          )}
          {members.map((m) => {
            const isMe = m.user_id === user?.id;
            const isAdmin = m.role === "admin";
            return (
              <div key={m.id} className="flex items-center gap-3 p-4">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  {isAdmin
                    ? <Crown className="h-4 w-4 text-primary" />
                    : <User className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {isMe ? user?.email : `Usuário ${m.user_id.slice(0, 8)}…`}
                    {isMe && <span className="ml-1.5 text-xs text-muted-foreground">(você)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Entrou em {joinedAt(m.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <Input
                      value={limits[m.id] ?? (m.approval_limit != null ? String(m.approval_limit) : "")}
                      onChange={(e) => setLimits((p) => ({ ...p, [m.id]: e.target.value.replace(/[^\d.,]/g, "") }))}
                      onBlur={() => {
                        const v = limits[m.id];
                        if (v !== undefined) saveLimit.mutate({ id: m.id, value: v });
                      }}
                      placeholder="Sem limite"
                      className="h-7 w-28 text-right text-xs"
                      title="Alçada de aprovação em contas a pagar (R$). Vazio = ilimitada."
                    />
                    <p className="mt-0.5 text-[10px] text-muted-foreground">alçada AP (R$)</p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    isAdmin
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {isAdmin ? "Admin" : "Membro"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Portão de entrada da instalação — só o dono da plataforma decide. */}
        {souDono && (
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm font-medium text-foreground mb-1">Como novos usuários entram</p>
            <p className="text-xs text-muted-foreground mb-3">
              Por convite, qualquer pessoa que chegue no endereço não consegue criar conta — só quem
              recebe um link seu. No autosserviço, quem se cadastrar cria a própria empresa e vira
              administrador <strong className="text-foreground">dela</strong>, separada da sua.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={portao.data === false ? "default" : "outline"}
                size="sm"
                className="gap-2"
                disabled={mudarPortao.isPending}
                onClick={() => mudarPortao.mutate(false)}
              >
                <DoorClosed className="h-3.5 w-3.5" /> Só por convite
              </Button>
              <Button
                variant={portao.data === true ? "default" : "outline"}
                size="sm"
                className="gap-2"
                disabled={mudarPortao.isPending}
                onClick={() => mudarPortao.mutate(true)}
              >
                <DoorOpen className="h-3.5 w-3.5" /> Autosserviço aberto
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              O primeiro cadastro da instalação é sempre livre — é ele que vira o administrador da
              plataforma. Esta escolha vale a partir do segundo.
            </p>
          </div>
        )}

        {/* Invite section */}
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm font-medium text-foreground mb-1">Convidar para a equipe</p>
          <p className="text-xs text-muted-foreground mb-3">
            Gere um link único (1 pessoa, 7 dias). Quem aceitar entra NESTA empresa com o papel escolhido —
            assim todo mundo trabalha na mesma organização, sem criar empresa duplicada.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              aria-label="Papel do convidado"
            >
              <option value="member">Membro (lança e edita)</option>
              <option value="admin">Admin (tudo)</option>
              <option value="viewer">Leitura (só vê)</option>
            </select>
            <Button variant="outline" size="sm" onClick={gerarConvite} className="gap-2">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado!" : "Gerar e copiar convite"}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Vários CNPJs? Cada empresa tem a própria equipe: troque de CNPJ no topo e convide os responsáveis de cada um.
          </p>
        </div>

      </div>
    </AppLayout>
  );
}
