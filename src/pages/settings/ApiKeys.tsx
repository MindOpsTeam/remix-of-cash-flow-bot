import { mensagemDeErro } from "@/lib/erros";
import { AppLayout } from "@/components/AppLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, KeyRound, Plus, Copy, Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

function randomKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "cfk_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ApiKeys() {
  const { company } = useCompany();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["api_keys", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("api_keys")
        .select("id, name, prefix, last_used_at, revoked_at, created_at")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApiKeyRow[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const key = randomKey();
      const hash = await sha256Hex(key);
      const { error } = await (supabase as any).from("api_keys").insert({
        company_id: company!.id,
        name: name.trim() || "Integração",
        key_hash: hash,
        prefix: key.slice(0, 12),
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      return key;
    },
    onSuccess: (key) => {
      setNewKey(key);
      setName("");
      qc.invalidateQueries({ queryKey: ["api_keys", company?.id] });
    },
    onError: (e: Error) => toast.error("Erro ao criar chave: " + mensagemDeErro(e)),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chave revogada");
      qc.invalidateQueries({ queryKey: ["api_keys", company?.id] });
    },
  });

  const apiBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api/v1`;

  return (
    <AppLayout>
      <div className="max-w-2xl animate-fade-in">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold tracking-[-0.02em]">API pública</h1>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Chaves de leitura para integrar {company?.name} a BI externo, planilhas e automações.
            </p>
          </div>
        </div>

        {newKey && (
          <div className="mb-5 rounded-lg border border-[hsl(var(--success))]/40 bg-[hsl(var(--success))]/5 p-4">
            <p className="mb-2 text-sm font-medium">Chave criada — copie agora, ela não será mostrada de novo:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-xs">{newKey}</code>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(newKey);
                  toast.success("Copiada");
                }}
              >
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setNewKey(null)}>Fechar</Button>
          </div>
        )}

        <div className="mb-5 flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="key-name">Nome da chave</Label>
            <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Power BI, n8n, planilha do contador" />
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending} className="gap-2">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar chave
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {keys.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhuma chave criada.</p>}
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium">{k.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {k.prefix}…{" · "}
                    {k.last_used_at ? `último uso ${new Date(k.last_used_at).toLocaleDateString("pt-BR")}` : "nunca usada"}
                  </p>
                </div>
                {k.revoked_at ? (
                  <Badge variant="secondary">Revogada</Badge>
                ) : (
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => revoke.mutate(k.id)}>
                    <Ban className="h-3.5 w-3.5" /> Revogar
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <p className="mb-1 font-medium">Como usar</p>
          <code className="block overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-xs">
            curl -H "X-API-Key: cfk_..." {apiBase}/transactions?from=2026-01-01
          </code>
          <p className="mt-2 text-xs text-muted-foreground">
            Rotas: /ping · /transactions · /margin · /invoices · /bills — leitura apenas. Doc completa em docs/PUBLIC-API.md.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
