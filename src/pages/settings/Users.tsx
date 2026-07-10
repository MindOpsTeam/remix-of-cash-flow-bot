import { AppLayout } from "@/components/AppLayout";
import { ArrowLeft, Crown, User, Copy, Check } from "lucide-react";
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

  const qc = useQueryClient();
  const [limits, setLimits] = useState<Record<string, string>>({});

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

  const copyInviteLink = () => {
    const link = `${window.location.origin}/?invite=${company?.id}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copiado!", description: "Envie o link para o novo usuário." });
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

        {/* Invite section */}
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm font-medium text-foreground mb-1">Convidar usuário</p>
          <p className="text-xs text-muted-foreground mb-3">
            Copie o link de convite e envie para a pessoa que deve ter acesso.
          </p>
          <Button variant="outline" size="sm" onClick={copyInviteLink} className="gap-2">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado!" : "Copiar link de convite"}
          </Button>
        </div>

      </div>
    </AppLayout>
  );
}
