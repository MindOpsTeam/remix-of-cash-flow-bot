import { mensagemDeErro } from "@/lib/erros";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Building2, Check, Compass, GitFork, Loader2, Lock, Mail, ShieldCheck, User } from "lucide-react";
import { Pill } from "@viverdeia/design-system";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ViaThemeToggle } from "@/components/ViaThemeToggle";
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_TOUR_DISMISSED_KEY, DEMO_TOUR_STEP_KEY } from "@/lib/demo";
import { plataformaBloqueada, demonstracaoDisponivel, limparDemonstracaoSeRemixado, cadastroEstaAberto } from "@/lib/rpc-plataforma";
import { tokenDoConvite } from "@/hooks/useConvite";
import appIcon from "@/assets/via/app-icon.png";
import wordmarkWhite from "@/assets/via/wordmark-white.png";

const LoginSignupForm = () => {
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  // Projeto original do template: cadastrar aqui é impossível por design.
  // Descobrir isso ANTES de o usuário preencher o formulário e tomar um erro
  // técnico ("Database error saving new user") que não explica nada.
  const [modoTemplate, setModoTemplate] = useState(false);
  // A demonstração é do projeto ORIGINAL. Num remix ela veio por clonagem e está
  // sendo removida — oferecer o botão seria oferecer um login que vai sumir.
  const [temDemonstracao, setTemDemonstracao] = useState(false);
  // Depois do primeiro usuário a instalação só aceita convite. Saber disso ANTES
  // evita oferecer um formulário que o banco vai recusar.
  const [cadastroAberto, setCadastroAberto] = useState(true);
  const convitePendente = tokenDoConvite();

  useEffect(() => {
    let vivo = true;
    plataformaBloqueada().then((b) => {
      if (vivo) setModoTemplate(b);
    });
    // Primeiro varre a vitrine herdada (no original é no-op), só então pergunta
    // se existe demonstração. A ordem importa: perguntar antes devolveria "sim"
    // por um instante e o botão piscaria numa instalação que não tem demo.
    limparDemonstracaoSeRemixado()
      .then(demonstracaoDisponivel)
      .then((tem) => {
        if (vivo) setTemDemonstracao(tem);
      });
    cadastroEstaAberto().then((aberto) => {
      if (vivo) setCadastroAberto(aberto);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const navigate = useNavigate();

  const nextParam = (() => {
    if (typeof window === "undefined") return null;
    const n = new URLSearchParams(window.location.search).get("next");
    return n && n.startsWith("/") && !n.startsWith("//") ? n : null;
  })();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (error) {
      toast.error(mensagemDeErro(e));
    } else {
      navigate(nextParam ?? "/dashboard");
    }
    setLoading(false);
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: {
        emailRedirectTo: window.location.origin + (nextParam ?? ""),
        // O token vai no metadata porque é o único canal que o GoTrue leva do
        // formulário até o gatilho que autoriza (ou não) o cadastro.
        data: {
          ...(regName ? { full_name: regName } : {}),
          ...(convitePendente ? { convite: convitePendente } : {}),
        },
      },
    });
    if (error) {
      // O GoTrue devolve "Database error saving new user" quando o trigger do
      // template barra o cadastro. Traduzir para o que o usuário precisa fazer.
      const barradoPeloTemplate =
        modoTemplate || /database error saving new user|remix_necessario/i.test(error.message);
      // O GoTrue embrulha qualquer erro do gatilho em "Database error saving new
      // user". Sem traduzir, quem foi barrado por falta de convite lê um erro de
      // banco e não sabe que precisa pedir um link ao administrador.
      const faltaConvite = /convite_necessario/i.test(error.message)
        || (!modoTemplate && !cadastroAberto && !convitePendente
            && /database error saving new user/i.test(error.message));
      toast.error(
        barradoPeloTemplate && !faltaConvite
          ? "Você precisa fazer o remix para cadastrar sua conta nesta plataforma."
          : faltaConvite
            ? "Esta plataforma aceita novos usuários apenas por convite. Peça um link ao administrador."
            : error.message,
      );
      if (barradoPeloTemplate && !faltaConvite) setModoTemplate(true);
    } else {
      toast.success("Verifique seu email para confirmar o cadastro.");
    }
    setLoading(false);
  };

  const entrarNaDemonstracao = async () => {
    setDemoLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
    if (error) {
      // No template whitelabel o banco nasce vazio: a conta de demonstração só
      // existe onde alguém rodou supabase/seed-demo.sql.
      toast.error("Este ambiente não tem conta de demonstração. Crie a sua conta para começar.");
      setDemoLoading(false);
      return;
    }
    sessionStorage.setItem(DEMO_TOUR_STEP_KEY, "0");
    sessionStorage.removeItem(DEMO_TOUR_DISMISSED_KEY);
    navigate("/dashboard");
  };

  return (
    <main className="relative min-h-screen bg-background lg:grid lg:grid-cols-[minmax(360px,0.82fr)_minmax(520px,1.18fr)]">
      <div className="absolute right-5 top-5 z-20">
        <ViaThemeToggle />
      </div>

      <section className="via-dark-panel relative hidden min-h-screen overflow-hidden rounded-none border-0 p-12 lg:flex lg:flex-col lg:justify-between">
        <div
          className="absolute inset-0 opacity-30"
          aria-hidden="true"
          style={{ backgroundImage: "var(--via-noise)" }}
        />
        <div className="relative z-10">
          <img src={wordmarkWhite} alt="Viver de IA" className="h-auto w-56" />
          <Pill className="via-dark-pill mt-7" size="sm">
            FinanceAI · ERP financeiro
          </Pill>
        </div>

        <div className="relative z-10 max-w-xl">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
            Finanças que se leem em segundos
          </p>
          <h1 className="mt-5 max-w-lg font-display text-5xl font-medium leading-[1.02] tracking-[-0.045em] text-white">
            Clareza para fechar o mês e decidir o próximo.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-white/70">
            Fluxo de caixa, margem, fiscal e agentes de IA no mesmo contexto — por empresa ou no grupo inteiro.
          </p>

          <ul className="mt-10 grid gap-4 text-sm text-white/80">
            {[
              "Visão consolidada de todos os CNPJs",
              "Conciliação e fechamento com rastreabilidade",
              "Alertas de caixa e margem com contexto",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-white/10">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex items-center gap-3 text-xs text-white/55">
          <Building2 className="h-4 w-4" aria-hidden="true" />
          <span>Operação multiempresa · dados protegidos por escopo</span>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-20 sm:px-8 lg:px-14">
        <div className="w-full max-w-[520px] via-route-enter">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <img src={appIcon} alt="Viver de IA" className="via-brand-icon h-11 w-11 rounded-lg" />
            <div>
              <p className="text-lg font-semibold tracking-[-0.02em] text-foreground">FinanceAI</p>
              <p className="text-xs text-muted-foreground">por Viver de IA</p>
            </div>
          </div>

          <div className="mb-8">
            <p className="via-eyebrow">{isActive ? "Criar acesso" : "Área segura"}</p>
            <h2 className="mt-3 font-display text-4xl font-medium tracking-[-0.035em] text-foreground">
              {isActive ? "Comece com sua empresa." : "Bem-vindo de volta."}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {isActive
                ? "Cadastre o responsável. Você poderá adicionar CNPJs e convidar o time depois."
                : "Entre com o mesmo email usado no cadastro da sua empresa."}
            </p>
          </div>

          <div
            className="mb-7 grid grid-cols-2 rounded-full border border-border bg-muted/70 p-1 shadow-[inset_0_1px_0_var(--via-edge-hi)]"
            role="tablist"
            aria-label="Escolher acesso"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isActive}
              onClick={() => setIsActive(false)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                !isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setIsActive(true)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Criar conta
            </button>
          </div>

          {isActive ? (
            <>
            {/* Só por convite: dizer isso ANTES do formulário evita a pessoa
                preencher tudo para receber uma recusa no fim. Com convite na
                mão o formulário aparece normalmente. */}
            {!modoTemplate && !cadastroAberto && !convitePendente && (
              <div className="mb-5 rounded-lg border border-border bg-muted/40 p-4" role="note">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Esta plataforma entra por convite
                </p>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  O administrador desta instalação define quem tem acesso. Peça a ele um link de
                  convite: ao abri-lo, você cria sua conta normalmente e já entra com o papel que
                  ele escolheu.
                </p>
              </div>
            )}
            {!modoTemplate && convitePendente && (
              <div className="mb-5 rounded-lg border border-[hsl(var(--success))]/40 bg-[hsl(var(--success))]/[0.08] p-4" role="note">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Check className="h-4 w-4 text-[hsl(var(--success))]" aria-hidden="true" />
                  Convite reconhecido
                </p>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  Crie sua conta abaixo. Você entra direto na equipe, com o papel definido por quem
                  convidou.
                </p>
              </div>
            )}
            {modoTemplate && (
              <div className="mb-5 rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/[0.08] p-4" role="alert">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <GitFork className="h-4 w-4 text-[hsl(var(--warning))]" aria-hidden="true" />
                  Você precisa fazer o remix para cadastrar sua conta nesta plataforma
                </p>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  Este é o projeto <strong className="text-foreground">original</strong>, publicado apenas como
                  modelo: ele não aceita cadastro nem edição. Clique em <strong className="text-foreground">Remix</strong> no
                  Lovable para criar a sua própria cópia — lá o cadastro é liberado automaticamente e a primeira
                  conta criada vira a administradora da plataforma.
                </p>
                {/* Só aponta para o botão se ele existir: instrução para algo
                    que não está na tela é pior do que instrução nenhuma. */}
                {temDemonstracao && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Quer só conhecer antes? Use a <strong className="text-foreground">demonstração guiada</strong> abaixo.
                  </p>
                )}
              </div>
            )}
            <form onSubmit={handleSignup} className="space-y-5" aria-label="Criar conta">
              <Field
                id="register-name"
                label="Nome"
                icon={<User className="h-4 w-4" aria-hidden="true" />}
              >
                <Input
                  id="register-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Seu nome completo"
                  className="pl-10"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                />
              </Field>
              <Field
                id="register-email"
                label="Email profissional"
                icon={<Mail className="h-4 w-4" aria-hidden="true" />}
              >
                <Input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@empresa.com.br"
                  className="pl-10"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
              </Field>
              <Field
                id="register-password"
                label="Senha"
                hint="Mínimo de 6 caracteres"
                icon={<Lock className="h-4 w-4" aria-hidden="true" />}
              >
                <Input
                  id="register-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Crie uma senha"
                  className="pl-10"
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
              </Field>
              <Button type="submit" className="mt-2 w-full" size="lg" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                {loading ? "Criando conta..." : "Criar conta"}
                {!loading ? <ArrowRight aria-hidden="true" /> : null}
              </Button>
            </form>
            </>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5" aria-label="Entrar no FinanceAI">
              <Field
                id="login-email"
                label="Email"
                icon={<Mail className="h-4 w-4" aria-hidden="true" />}
              >
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@empresa.com.br"
                  className="pl-10"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </Field>
              <Field
                id="login-password"
                label="Senha"
                icon={<Lock className="h-4 w-4" aria-hidden="true" />}
              >
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  className="pl-10"
                  required
                  minLength={6}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </Field>
              <Button type="submit" className="mt-2 w-full" size="lg" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                {loading ? "Entrando..." : "Entrar no FinanceAI"}
                {!loading ? <ArrowRight aria-hidden="true" /> : null}
              </Button>
            </form>
          )}

          {temDemonstracao && (
          <div className="mt-7">
            <div className="flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                ou conheça antes
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="mt-4 w-full"
              onClick={entrarNaDemonstracao}
              disabled={demoLoading}
            >
              {demoLoading ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Compass aria-hidden="true" />
              )}
              {demoLoading ? "Preparando demonstração..." : "Ver demonstração guiada"}
            </Button>
            <p className="mt-2 text-center text-[11px] leading-4 text-muted-foreground">
              Conta compartilhada e somente leitura, com uma empresa fictícia de 3 CNPJs. Nada é salvo.
            </p>
          </div>
          )}

          <Alert className="mt-8" role="note">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Responsabilidade e segurança</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              A plataforma processa dados financeiros sensíveis. Mantenha credenciais protegidas, revise acessos e
              realize auditorias regulares. A segurança operacional do ambiente continua sob responsabilidade do cliente.
            </AlertDescription>
          </Alert>
        </div>
      </section>
    </main>
  );
};

function Field({
  id,
  label,
  hint,
  icon,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}

export default LoginSignupForm;
