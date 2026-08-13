import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ServerCog, Rocket, ExternalLink, Plug, CheckCircle2, XCircle, Upload,
  ShieldCheck, FileCheck, ArrowRight, ArrowLeft, PartyPopper,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";

// Repo público do worker (deploy 1-clique no Railway).
const WORKER_REPO_URL = "https://github.com/MindOpsTeam/nfse-worker";

const STEPS = [
  "Servidor",
  "Criar worker",
  "Conectar",
  "Certificado",
  "Dados fiscais",
  "Nota de teste",
] as const;

type Status = "idle" | "ok" | "error";

/**
 * Assistente de instalação da NFS-e (baixa fricção). Leva o cliente do zero até
 * uma nota emitida em homologação, um passo por vez, cada um validado. É
 * autocontido: lê/grava nfse_config direto e chama as edges nfse-operations /
 * nfse-proxy. O passo concluído fica salvo em nfse_config.setup_step.
 */
export default function NfseSetupWizard({ onFinish }: { onFinish?: () => void }) {
  const { company } = useCompany();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Campos
  const [nfseVia, setNfseVia] = useState<"worker_proprio" | "provedor">("worker_proprio");
  const [workerUrl, setWorkerUrl] = useState("");
  const [workerKey, setWorkerKey] = useState("");
  const [certBase64, setCertBase64] = useState("");
  const [certPassword, setCertPassword] = useState("");
  const [pfxName, setPfxName] = useState<string | null>(null);
  const [serie, setSerie] = useState("1");
  const [municipio, setMunicipio] = useState("");
  const [inscricao, setInscricao] = useState("");
  const [optanteSimples, setOptanteSimples] = useState(true);

  // Testes
  const [srvTest, setSrvTest] = useState<{ s: Status; m: string }>({ s: "idle", m: "" });
  const [certTest, setCertTest] = useState<{ s: Status; m: string }>({ s: "idle", m: "" });
  const [srvBusy, setSrvBusy] = useState(false);
  const [certBusy, setCertBusy] = useState(false);

  // Nota de teste
  const [tomadorDoc, setTomadorDoc] = useState("");
  const [tomadorNome, setTomadorNome] = useState("");
  const [codigoServico, setCodigoServico] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [emitBusy, setEmitBusy] = useState(false);
  const [emitResult, setEmitResult] = useState<{ s: Status; m: string } | null>(null);

  const pfxRef = useRef<HTMLInputElement>(null);

  const { data: cfg } = useQuery({
    queryKey: ["nfse_config", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await (supabase as any).from("nfse_config").select("*").eq("company_id", company!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!cfg) return;
    setNfseVia((cfg.nfse_via as any) ?? "worker_proprio");
    setWorkerUrl(cfg.worker_url ?? "");
    // worker_api_key e o cert são segredos que o cliente não lê mais (REVOKE de
    // SELECT). Não dá pra prefill; se já existe, mostramos "configurado" via cert_cnpj
    // e só reescrevemos quando o usuário informa um valor novo.
    setSerie(cfg.serie_dps ?? "1");
    setMunicipio(cfg.codigo_municipio ?? "");
    setInscricao(cfg.inscricao_municipal ?? "");
    setOptanteSimples(cfg.optante_simples ?? true);
    if (cfg.cert_cnpj) { setPfxName("certificado.pfx"); }
    if (typeof cfg.setup_step === "number" && cfg.setup_step > 0) {
      setStep(Math.min(cfg.setup_step + 1, STEPS.length));
    }
  }, [cfg]);

  const persist = async (patch: Record<string, unknown>, reachedStep: number) => {
    if (!company) return false;
    setSaving(true);
    const payload = { company_id: company.id, ...patch, setup_step: Math.max(reachedStep, cfg?.setup_step ?? 0) };
    let error;
    if (cfg) ({ error } = await (supabase as any).from("nfse_config").update(payload).eq("id", cfg.id));
    else ({ error } = await (supabase as any).from("nfse_config").insert({ ...payload, ambiente: "homologacao", active: true }));
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return false; }
    qc.invalidateQueries({ queryKey: ["nfse_config", company.id] });
    return true;
  };

  const onPfx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const b64 = btoa(new Uint8Array(buf).reduce((d, b) => d + String.fromCharCode(b), ""));
      setCertBase64(b64); setPfxName(file.name);
      toast({ title: `Certificado carregado: ${file.name}` });
    } catch { toast({ title: "Erro ao ler o .pfx", variant: "destructive" }); }
    e.target.value = "";
  };

  const testServer = async () => {
    const url = workerUrl.trim().replace(/\/+$/, "");
    if (!url) { setSrvTest({ s: "error", m: "Informe a URL do worker." }); return; }
    setSrvBusy(true); setSrvTest({ s: "idle", m: "" });
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(`${url}/health`, { signal: ctrl.signal }); clearTimeout(t);
      const b = await r.json().catch(() => ({}));
      if (r.ok && b?.status === "ok") setSrvTest({ s: "ok", m: `Servidor no ar (v${b.version ?? "?"}).` });
      else setSrvTest({ s: "error", m: `HTTP ${r.status}. Confira a URL (sem barra no fim).` });
    } catch {
      setSrvTest({ s: "error", m: "Sem resposta. O worker pode estar subindo ainda, ou a URL esta errada." });
    } finally { setSrvBusy(false); }
  };

  const testCert = async () => {
    if (!company) return;
    if (!certBase64 || !certPassword) { setCertTest({ s: "error", m: "Suba o .pfx e informe a senha." }); return; }
    setCertBusy(true); setCertTest({ s: "idle", m: "" });
    // Precisa estar salvo p/ a edge ler do banco. Só reescreve worker_api_key quando
    // informado (senão preserva o que já está salvo, que o cliente não lê de volta).
    const ok = await persist({
      nfse_via: nfseVia,
      worker_url: workerUrl.trim() || null,
      ...(workerKey.trim() ? { worker_api_key: workerKey.trim() } : {}),
      cert_pfx_base64: certBase64,
      cert_password: certPassword,
    }, 3);
    if (!ok) { setCertBusy(false); return; }
    try {
      const { data, error } = await supabase.functions.invoke("nfse-operations", { body: { company_id: company.id, operation: "parse_cert" } });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error ?? "Falha ao ler o certificado");
      const c = data.data as { cnpj: string | null; razaoSocial: string | null; expiresAt: string | null; validDays: number | null };
      const exp = c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("pt-BR") : "?";
      setCertTest({ s: "ok", m: `${c.razaoSocial ?? "Certificado"} · CNPJ ${c.cnpj ?? "?"} · validade ${exp}${c.validDays != null && c.validDays <= 30 ? ` (expira em ${c.validDays}d)` : ""}` });
    } catch (e: any) { setCertTest({ s: "error", m: e.message || "Erro ao testar o certificado" }); }
    finally { setCertBusy(false); }
  };

  const emitirTeste = async () => {
    if (!company) return;
    if (!tomadorDoc || !codigoServico || !descricao || !valor) { toast({ title: "Preencha os campos da nota", variant: "destructive" }); return; }
    const v = parseFloat(valor.replace(/\./g, "").replace(",", "."));
    if (isNaN(v) || v <= 0) { toast({ title: "Valor invalido", variant: "destructive" }); return; }
    setEmitBusy(true); setEmitResult(null);
    const competencia = new Date().toISOString().slice(0, 7);
    try {
      const { data, error } = await supabase.functions.invoke("nfse-proxy", {
        body: {
          operation: "emit", companyId: company.id,
          data: {
            tomador: { cpfCnpj: tomadorDoc.replace(/\D/g, ""), razaoSocial: tomadorNome },
            servico: { codigoTribNac: codigoServico, descricao },
            valores: { valorServicos: v }, competencia,
          },
        },
      });
      if (error) throw new Error(error.message);
      if (data?.success) {
        setEmitResult({ s: "ok", m: `Nota de teste emitida! Chave: ${data.chaveAcesso ?? data.chave_acesso ?? "(gerada)"}` });
        await persist({ ambiente: "homologacao" }, 6);
      } else {
        setEmitResult({ s: "error", m: data?.error || "O SEFIN recusou. Veja a mensagem e ajuste os dados." });
      }
    } catch (e: any) { setEmitResult({ s: "error", m: e.message || "Erro na emissao" }); }
    finally { setEmitBusy(false); }
  };

  const virarProducao = async () => {
    const ok = await persist({ ambiente: "producao" }, 6);
    if (ok) { toast({ title: "Pronto! NFS-e em producao." }); onFinish?.(); }
  };

  const canNext = () => {
    if (step === 3) return srvTest.s === "ok";
    if (step === 4) return certTest.s === "ok";
    if (step === 5) return !!municipio && !!serie;
    return true;
  };

  const next = async () => {
    if (step === 1) await persist({ nfse_via: nfseVia }, 1);
    if (step === 2) await persist({ nfse_via: nfseVia }, 2);
    if (step === 3) await persist({ worker_url: workerUrl.trim() || null, ...(workerKey.trim() ? { worker_api_key: workerKey.trim() } : {}) }, 3);
    if (step === 5) await persist({ serie_dps: serie, codigo_municipio: municipio || null, inscricao_municipal: inscricao || null, optante_simples: optanteSimples, ambiente: "homologacao" }, 5);
    setStep((s) => Math.min(s + 1, STEPS.length));
  };

  return (
    <div className="max-w-2xl">
      {/* Stepper */}
      <div className="flex items-center gap-1.5 mb-6 flex-wrap">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < step, cur = n === step;
          return (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                cur ? "bg-primary text-primary-foreground" : done ? "bg-income/15 text-income" : "bg-muted text-muted-foreground"
              }`}>
                <span className={`grid place-items-center h-4 w-4 rounded-full text-[9px] ${cur ? "bg-primary-foreground/20" : done ? "bg-income/20" : "bg-foreground/10"}`}>
                  {done ? "✓" : n}
                </span>
                {label}
              </div>
              {n < STEPS.length && <div className="h-px w-3 bg-border" />}
            </div>
          );
        })}
      </div>

      <div className="bg-card border border-border rounded-xl p-5 min-h-[280px]">
        {/* Passo 1 — Via */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Como suas notas serao emitidas?</h2>
              <p className="text-xs text-muted-foreground mt-1">Recomendado: servidor proprio (notas ilimitadas, sem custo por nota).</p>
            </div>
            <button type="button" onClick={() => setNfseVia("worker_proprio")}
              className={`w-full text-left rounded-lg border p-4 transition-colors ${nfseVia === "worker_proprio" ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/40"}`}>
              <div className="flex items-center gap-2 mb-1"><ServerCog className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">Servidor proprio (Railway)</span></div>
              <p className="text-[11px] text-muted-foreground">Voce cria um servidor em ~5 min (~US$5/mes, cobrado pelo Railway). Notas ilimitadas, sem custo por nota.</p>
            </button>
            <button type="button" onClick={() => setNfseVia("provedor")}
              className={`w-full text-left rounded-lg border p-4 transition-colors ${nfseVia === "provedor" ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/40"}`}>
              <div className="flex items-center gap-2 mb-1"><Plug className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">Provedor (SaaS)</span></div>
              <p className="text-[11px] text-muted-foreground">Sem servidor. Emissao via provedor, pago por nota. Configure em Integracoes &gt; PlugNotas.</p>
            </button>
          </div>
        )}

        {/* Passo 2 — Criar worker */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Crie o seu servidor no Railway</h2>
              <p className="text-xs text-muted-foreground mt-1">Um clique cria o servidor com a chave de acesso ja gerada. Depois volte aqui.</p>
            </div>
            <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Clique no botao abaixo e crie/entre na sua conta Railway.</li>
              <li>Adicione forma de pagamento (plano Hobby, ~US$5/mes). E o custo do seu servidor.</li>
              <li>O deploy e automatico. Em <strong>Settings → Networking</strong>, clique em <strong>Generate Domain</strong> e copie a URL.</li>
              <li>Em <strong>Variables</strong>, copie o valor de <strong>NFSE_WORKER_API_KEY</strong>.</li>
            </ol>
            <a href={WORKER_REPO_URL} target="_blank" rel="noopener noreferrer">
              <Button className="gap-2"><Rocket className="h-4 w-4" /> Criar meu worker no Railway <ExternalLink className="h-3.5 w-3.5" /></Button>
            </a>
            <p className="text-[11px] text-muted-foreground">Precisa de ajuda com o certificado ou o Railway? Veja o guia do cliente (docs/GUIA-NFSE-CLIENTE.md).</p>
          </div>
        )}

        {/* Passo 3 — Conectar */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Conecte o seu servidor</h2>
              <p className="text-xs text-muted-foreground mt-1">Cole a URL e a chave que voce copiou do Railway.</p>
            </div>
            <div className="space-y-1.5">
              <Label>URL do worker</Label>
              <Input value={workerUrl} onChange={(e) => setWorkerUrl(e.target.value)} placeholder="https://seu-worker.up.railway.app" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Chave (NFSE_WORKER_API_KEY)</Label>
              <Input type="password" value={workerKey} onChange={(e) => setWorkerKey(e.target.value)} placeholder="cole a chave aqui" className="font-mono text-sm" />
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={testServer} disabled={srvBusy} className="gap-2"><Plug className="h-4 w-4" />{srvBusy ? "Testando..." : "Testar servidor"}</Button>
              {srvTest.s !== "idle" && (
                <span className={`flex items-center gap-1.5 text-[11px] ${srvTest.s === "ok" ? "text-income" : "text-expense"}`}>
                  {srvTest.s === "ok" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{srvTest.m}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Passo 4 — Certificado */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Certificado digital A1</h2>
              <p className="text-xs text-muted-foreground mt-1">Arquivo .pfx (e-CNPJ da sua empresa) e a senha. Ele fica no seu ambiente, nao com terceiros.</p>
            </div>
            <input ref={pfxRef} type="file" accept=".pfx,.p12" className="hidden" onChange={onPfx} />
            <div onClick={() => pfxRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-5 cursor-pointer transition-colors ${certBase64 ? "border-income/40 bg-income/5" : "border-border hover:border-primary/40"}`}>
              {certBase64 ? (<><ShieldCheck className="h-6 w-6 text-income" /><p className="text-xs font-medium">{pfxName}</p><p className="text-[11px] text-muted-foreground">Clique para substituir</p></>)
                : (<><Upload className="h-6 w-6 text-muted-foreground" /><p className="text-xs font-medium">Selecionar o certificado (.pfx / .p12)</p></>)}
            </div>
            <div className="space-y-1.5">
              <Label>Senha do certificado</Label>
              <Input type="password" value={certPassword} onChange={(e) => setCertPassword(e.target.value)} placeholder="senha do arquivo .pfx" className="font-mono text-sm" />
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={testCert} disabled={certBusy} className="gap-2"><FileCheck className="h-4 w-4" />{certBusy ? "Testando..." : "Testar certificado"}</Button>
              {certTest.s !== "idle" && (
                <span className={`flex items-start gap-1.5 text-[11px] ${certTest.s === "ok" ? "text-income" : "text-expense"}`}>
                  {certTest.s === "ok" ? <CheckCircle2 className="h-3.5 w-3.5 mt-px" /> : <XCircle className="h-3.5 w-3.5 mt-px" />}{certTest.m}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Passo 5 — Dados fiscais */}
        {step === 5 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Dados fiscais</h2>
              <p className="text-xs text-muted-foreground mt-1">Comecamos em homologacao (ambiente de teste da Receita).</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Serie da DPS</Label><Input value={serie} onChange={(e) => setSerie(e.target.value)} className="font-mono text-sm" /></div>
              <div className="space-y-1.5"><Label>Codigo do municipio (IBGE)</Label><Input value={municipio} onChange={(e) => setMunicipio(e.target.value)} placeholder="3550308" maxLength={7} className="font-mono text-sm" /></div>
              <div className="space-y-1.5"><Label>Inscricao Municipal (opcional)</Label><Input value={inscricao} onChange={(e) => setInscricao(e.target.value)} className="font-mono text-sm" /></div>
              <div className="space-y-1.5">
                <Label>Regime</Label>
                <Select value={optanteSimples ? "sim" : "nao"} onValueChange={(v) => setOptanteSimples(v === "sim")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Simples Nacional</SelectItem>
                    <SelectItem value="nao">Regime normal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Passo 6 — Nota de teste */}
        {step === 6 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Emita uma nota de teste</h2>
              <p className="text-xs text-muted-foreground mt-1">Em homologacao (nao vale como nota real). Prova que esta tudo funcionando.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>CPF/CNPJ do tomador</Label><Input value={tomadorDoc} onChange={(e) => setTomadorDoc(e.target.value)} className="font-mono text-sm" /></div>
              <div className="space-y-1.5"><Label>Nome do tomador</Label><Input value={tomadorNome} onChange={(e) => setTomadorNome(e.target.value)} className="text-sm" /></div>
              <div className="space-y-1.5"><Label>Codigo do servico (trib. nacional)</Label><Input value={codigoServico} onChange={(e) => setCodigoServico(e.target.value)} placeholder="ex: 01.05" className="font-mono text-sm" /></div>
              <div className="space-y-1.5"><Label>Valor (R$)</Label><Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="100,00" className="font-mono text-sm" /></div>
              <div className="space-y-1.5 col-span-2"><Label>Descricao do servico</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="text-sm" /></div>
            </div>
            <Button onClick={emitirTeste} disabled={emitBusy} className="gap-2"><FileCheck className="h-4 w-4" />{emitBusy ? "Emitindo..." : "Emitir nota de teste"}</Button>
            {emitResult && (
              <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${emitResult.s === "ok" ? "bg-income/10 text-income border border-income/20" : "bg-expense/10 text-expense border border-expense/20"}`}>
                {emitResult.s === "ok" ? <PartyPopper className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                <span>{emitResult.m}</span>
              </div>
            )}
            {emitResult?.s === "ok" && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Funcionou! Quando estiver pronto, vire para producao para emitir notas de verdade.</p>
                <Button variant="default" onClick={virarProducao} disabled={saving} className="gap-2"><CheckCircle2 className="h-4 w-4" /> Ativar producao</Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navegação */}
      <div className="flex items-center justify-between mt-4">
        <Button variant="ghost" size="sm" onClick={() => setStep((s) => Math.max(s - 1, 1))} disabled={step === 1} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
        {step < STEPS.length && (
          <Button size="sm" onClick={next} disabled={saving || !canNext()} className="gap-1.5">Continuar <ArrowRight className="h-4 w-4" /></Button>
        )}
      </div>
    </div>
  );
}
