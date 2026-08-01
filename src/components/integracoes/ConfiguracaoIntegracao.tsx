import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import {
  CheckCircle2, CircleDashed, HelpCircle, Loader2, PlugZap, Save, ShieldCheck,
  ExternalLink, AlertTriangle, ArrowUpRight, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import type { Integracao, CampoIntegracao } from "@/lib/integracoes-catalogo";
import { camposFaltando } from "@/lib/integracoes-catalogo";
import { salvarIntegracao, testarIntegracao, arquivoParaBase64 } from "@/lib/integracoes-io";

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/* ------------------------------------------------------------------ */
/* Card de status na grade                                             */
/* ------------------------------------------------------------------ */

export function CardIntegracao({
  integracao,
  configurada,
  onConfigurar,
}: {
  integracao: Integracao;
  configurada: boolean;
  onConfigurar: () => void;
}) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-4 transition-all duration-150 hover:border-primary/25 hover:shadow-card-hover">
      <div>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{integracao.nome}</p>
          {configurada ? (
            <Badge variant="outline" className="shrink-0 gap-1 border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 text-[11px] text-[hsl(var(--success))]">
              <CheckCircle2 className="h-3 w-3" /> Configurada
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 gap-1 text-[11px] text-muted-foreground">
              <CircleDashed className="h-3 w-3" /> Opcional
            </Badge>
          )}
        </div>
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{integracao.ganho}</p>
      </div>
      <Button variant={configurada ? "outline" : "default"} size="sm" className="mt-3 w-full gap-1.5" onClick={onConfigurar}>
        <PlugZap className="h-3.5 w-3.5" />
        {configurada ? "Revisar configuração" : "Configurar"}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Painel de ajuda: onde nasce a chave, quanto custa                   */
/* ------------------------------------------------------------------ */

function PainelAjuda({ integracao }: { integracao: Integracao }) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <HelpCircle className="h-4 w-4 text-primary" />
        Como obter, passo a passo
      </p>
      <ol className="space-y-2">
        {integracao.guia.passos.map((passo, i) => (
          <li key={i} className="flex gap-2.5 text-xs leading-5 text-muted-foreground">
            <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
              {i + 1}
            </span>
            <span>{passo}</span>
          </li>
        ))}
      </ol>

      <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-background/70 p-2.5">
        <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Custo estimado</p>
          <p className="mt-0.5 text-xs leading-5 text-foreground">{integracao.guia.custo}</p>
        </div>
      </div>

      {integracao.guia.quandoNaoUsar && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-[hsl(var(--warning))]/25 bg-[hsl(var(--warning))]/[0.07] p-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--warning))]" />
          <p className="text-xs leading-5 text-foreground">{integracao.guia.quandoNaoUsar}</p>
        </div>
      )}

      {integracao.guia.site && (
        <a
          href={integracao.guia.site}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Abrir o site do provedor <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal de configuração                                               */
/* ------------------------------------------------------------------ */

export function DialogIntegracao({
  integracao,
  companyId,
  aberto,
  onFechar,
  onSalvou,
}: {
  integracao: Integracao | null;
  companyId: string | undefined;
  aberto: boolean;
  onFechar: () => void;
  onSalvou: (id: string) => void;
}) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; mensagem: string } | null>(null);

  if (!integracao) return null;

  const setValor = (key: string, valor: string) => {
    setValores((p) => ({ ...p, [key]: valor }));
    setResultado(null);
  };

  const faltando = camposFaltando(integracao, valores);

  const salvar = async () => {
    if (!companyId) return;
    setSalvando(true);
    const r = await salvarIntegracao(integracao.id, companyId, valores);
    setSalvando(false);
    setResultado(r);
    if (r.ok) {
      toast.success(r.mensagem);
      onSalvou(integracao.id);
    } else {
      toast.error(r.mensagem);
    }
  };

  const testar = async () => {
    if (!companyId) return;
    setTestando(true);
    const r = await testarIntegracao(integracao.id, companyId);
    setTestando(false);
    setResultado(r);
    if (r.ok) toast.success(r.mensagem);
    else toast.error(r.mensagem);
  };

  const fechar = () => {
    setValores({});
    setResultado(null);
    setAjudaAberta(false);
    onFechar();
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{integracao.nome}</DialogTitle>
          <DialogDescription>{integracao.ganho}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAjudaAberta((a) => !a)}>
            <HelpCircle className="h-3.5 w-3.5" />
            {ajudaAberta ? "Fechar ajuda" : "Como obter esta chave"}
          </Button>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            {integracao.ondeFicaGuardado === "vault"
              ? "Guardado no cofre cifrado do servidor"
              : "Guardado na configuração da sua empresa"}
          </span>
        </div>

        {ajudaAberta && <PainelAjuda integracao={integracao} />}

        <div className="space-y-3">
          {integracao.campos.map((campo) => (
            <CampoForm key={campo.key} campo={campo} valor={valores[campo.key] ?? ""} onChange={(v) => setValor(campo.key, v)} />
          ))}
        </div>

        {resultado && (
          <div
            className={`flex items-start gap-2 rounded-md border p-3 text-xs leading-5 ${
              resultado.ok
                ? "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
            role="status"
          >
            {resultado.ok ? <CheckCircle2 className="mt-px h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-px h-4 w-4 shrink-0" />}
            <span>{resultado.mensagem}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <Button onClick={salvar} disabled={salvando || faltando.length > 0} className="gap-1.5">
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar configuração
            </Button>
            {integracao.testavel && (
              <Button variant="outline" onClick={testar} disabled={testando} className="gap-1.5">
                {testando ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                Testar conexão
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {integracao.telaDedicada && (
              <Link to={integracao.telaDedicada} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Tela completa <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
            <Button variant="ghost" onClick={fechar}>
              Pular por enquanto
            </Button>
          </div>
        </div>

        {faltando.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Para salvar, preencha: {faltando.join(", ")}. Ou pule — dá para voltar aqui quando quiser.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CampoForm({
  campo,
  valor,
  onChange,
}: {
  campo: CampoIntegracao;
  valor: string;
  onChange: (v: string) => void;
}) {
  const [nomeArquivo, setNomeArquivo] = useState("");

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`campo-${campo.key}`} className="text-xs font-medium">
        {campo.label}
      </Label>

      {campo.tipo === "select" ? (
        <select
          id={`campo-${campo.key}`}
          className={selectClass}
          value={valor || campo.opcoes?.[0]?.value || ""}
          onChange={(e) => onChange(e.target.value)}
        >
          {campo.opcoes?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : campo.tipo === "file" ? (
        <div className="flex items-center gap-2">
          <Input
            id={`campo-${campo.key}`}
            type="file"
            accept={campo.accept}
            className="text-xs"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setNomeArquivo(file.name);
              try {
                onChange(await arquivoParaBase64(file));
              } catch {
                toast.error("Não foi possível ler o arquivo.");
              }
            }}
          />
          {nomeArquivo && <span className="shrink-0 text-[11px] text-muted-foreground">{nomeArquivo}</span>}
        </div>
      ) : (
        <Input
          id={`campo-${campo.key}`}
          type={campo.tipo === "password" ? "password" : campo.tipo === "url" ? "url" : campo.tipo === "tel" ? "tel" : "text"}
          placeholder={campo.placeholder}
          value={valor}
          autoComplete={campo.segredo ? "new-password" : "off"}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {campo.dica && <p className="text-[11px] leading-4 text-muted-foreground">{campo.dica}</p>}
    </div>
  );
}
