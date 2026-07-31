import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, FileDown, AlertTriangle, Files } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { formatCurrency } from "@/lib/utils";
import { toCsv, downloadCsv } from "@/lib/csv-export";
import { montarConsolidado, consolidadoParaCsv, type GroupTotalRow } from "@/lib/consolidado";
import {
  diarioParaCsv,
  razaoParaCsv,
  partidasParaCsv,
  planoDeContasParaCsv,
  resumoQualidade,
  type LancamentoExport,
  type PartidaExport,
  type ContaExport,
} from "@/lib/export-contabil";

/**
 * Central do Contador: tudo que o contador pede no fechamento, exportável por
 * período sem depender de ninguém. CSV genérico e estável (Domínio, Alterdata
 * e Excel importam); o aviso de qualidade mostra o que está sem classificação
 * ANTES do download — exportar buraco escondido é pior que atrasar o envio.
 */

const mesAtualIso = () => `${new Date().toISOString().slice(0, 7)}-01`;

function fimDoMes(mesIso: string): string {
  const d = new Date(`${mesIso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

export default function Contador() {
  const { company, companies, scope } = useCompany();
  const [mes, setMes] = useState<string>(mesAtualIso());
  const ate = fimDoMes(mes);
  const isCombined = scope === "all";

  const dados = useQuery({
    queryKey: ["contador", company?.id, mes],
    enabled: !!company,
    staleTime: 30_000,
    queryFn: async () => {
      const [txs, partidas, contas] = await Promise.all([
        supabase
          .from("transactions")
          .select("date, description, amount, type, status, source, chart_of_accounts(code, name), cost_centers(name)")
          .eq("company_id", company!.id)
          .in("status", ["confirmed", "reconciled"])
          .gte("date", mes)
          .lte("date", ate)
          .order("date")
          .limit(5000),
        supabase
          .from("company_journal_entries")
          .select("date, debit_account, credit_account, amount, description")
          .eq("company_id", company!.id)
          .gte("date", mes)
          .lte("date", ate)
          .order("date")
          .limit(5000),
        supabase
          .from("chart_of_accounts")
          .select("code, name, type, group_code")
          .eq("company_id", company!.id)
          .order("code"),
      ]);
      if (txs.error) throw txs.error;

      const lancamentos: LancamentoExport[] = (txs.data ?? []).map((t) => {
        const conta = t.chart_of_accounts as { code: string | null; name: string } | null;
        const centro = t.cost_centers as { name: string } | null;
        return {
          date: String(t.date),
          description: String(t.description),
          amount: Number(t.amount) || 0,
          type: String(t.type),
          status: String(t.status),
          source: String(t.source),
          conta_codigo: conta?.code ?? null,
          conta_nome: conta?.name ?? null,
          centro_nome: centro?.name ?? null,
        };
      });

      return {
        lancamentos,
        partidas: (partidas.data ?? []) as PartidaExport[],
        contas: (contas.data ?? []) as ContaExport[],
      };
    },
  });

  const qualidade = useMemo(
    () => (dados.data ? resumoQualidade(dados.data.lancamentos) : null),
    [dados.data],
  );

  const mesTag = mes.slice(0, 7);
  const nomeEmpresa = (company?.name ?? "empresa").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const artefatos = [
    {
      key: "diario",
      titulo: "Diário de lançamentos",
      descricao: "Todos os lançamentos confirmados do período, com conta, centro de custo e D/C.",
      gerar: () => diarioParaCsv(dados.data!.lancamentos),
    },
    {
      key: "razao",
      titulo: "Razão por conta",
      descricao: "Lançamentos agrupados por conta contábil, com saldo corrente e total por conta.",
      gerar: () => razaoParaCsv(dados.data!.lancamentos),
    },
    {
      key: "partidas",
      titulo: "Partidas dobradas",
      descricao: "O livro débito/crédito gravado automaticamente a cada lançamento.",
      gerar: () => partidasParaCsv(dados.data!.partidas),
    },
    {
      key: "plano",
      titulo: "Plano de contas",
      descricao: "Contas da empresa com o código de grupo usado na consolidação.",
      gerar: () => planoDeContasParaCsv(dados.data!.contas),
    },
  ];

  function baixar(key: string) {
    const artefato = artefatos.find((a) => a.key === key);
    if (!artefato || !dados.data) return;
    const { headers, rows } = artefato.gerar();
    downloadCsv(`${key}-${nomeEmpresa}-${mesTag}.csv`, toCsv(headers, rows));
  }

  function baixarPacote() {
    artefatos.forEach((a, i) => setTimeout(() => baixar(a.key), i * 400));
  }

  // DRE consolidada do grupo direto daqui (só faz sentido no escopo combinado).
  async function baixarConsolidado() {
    const ids = companies.map((c) => c.id);
    const { data, error } = await supabase
      .from("v_group_account_totals")
      .select("company_id, month, group_code, group_name, type, total")
      .in("company_id", ids)
      .gte("month", mes)
      .lte("month", mes);
    if (error || !data?.length) return;
    const consolidado = montarConsolidado(data as GroupTotalRow[], ids);
    const nomes = Object.fromEntries(companies.map((c) => [c.id, c.name]));
    const { headers, rows } = consolidadoParaCsv(consolidado, nomes, ids);
    downloadCsv(`consolidado-${mesTag}.csv`, toCsv(headers, rows.map((r) => r.map(String))));
  }

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="via-eyebrow">Saídas contábeis</span>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-[-0.02em] text-foreground">
            <BookOpenCheck className="h-6 w-6 text-primary" /> Central do Contador
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {company?.name} · exportações prontas para Domínio, Alterdata e Excel
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={mesTag}
            onChange={(e) => setMes(`${e.target.value}-01`)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            aria-label="Mês de referência"
          />
          <Button className="gap-2" onClick={baixarPacote} disabled={!dados.data || dados.data.lancamentos.length === 0}>
            <Files className="h-4 w-4" /> Pacote do mês
          </Button>
        </div>
      </div>

      {qualidade && qualidade.semConta > 0 && (
        <Link
          to="/close"
          className="mb-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/[0.08] p-3 text-xs transition-colors hover:bg-warning/[0.14]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">
              {qualidade.semConta} lançamento(s) sem conta ({formatCurrency(qualidade.valorSemConta)})
            </span>{" "}
            saem como SEM CLASSIFICAÇÃO. Clique para classificar no fechamento antes de enviar ao contador.
          </span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {artefatos.map((a) => (
          <div key={a.key} className="flex flex-col rounded-lg border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">{a.titulo}</h2>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{a.descricao}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {dados.data
                  ? a.key === "partidas"
                    ? `${dados.data.partidas.length} partida(s)`
                    : a.key === "plano"
                      ? `${dados.data.contas.length} conta(s)`
                      : `${dados.data.lancamentos.length} lançamento(s)`
                  : "…"}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => baixar(a.key)}
                disabled={!dados.data}
              >
                <FileDown className="h-4 w-4" /> CSV
              </Button>
            </div>
          </div>
        ))}
      </div>

      {isCombined && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-card p-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">DRE consolidada do grupo</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Matriz conta × CNPJ do mês, direto daqui ({companies.length} CNPJs).
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-2" onClick={baixarConsolidado}>
            <FileDown className="h-4 w-4" /> CSV
          </Button>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        A DRE do mês exporta em PDF na tela <Link to="/dre" className="underline underline-offset-2">DRE</Link>; a
        consolidada completa vive em <Link to="/consolidado" className="underline underline-offset-2">DRE Consolidada</Link>.
      </p>
    </AppLayout>
  );
}
