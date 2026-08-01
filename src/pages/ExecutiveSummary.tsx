import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { useState, useCallback, useMemo } from "react";
import {
  Loader2, FileText, RefreshCw, TrendingUp, TrendingDown, DollarSign,
  AlertTriangle, CheckCircle, Lightbulb, BarChart3, Target, Compass,
} from "lucide-react";
import { MarkdownMessage } from "@/components/cfo/MarkdownMessage";

// Parse markdown sections into structured blocks
function parseSections(md: string) {
  const sections: { title: string; content: string; icon: string }[] = [];
  const lines = md.split("\n");
  let currentTitle = "";
  let currentContent: string[] = [];

  const flush = () => {
    if (currentTitle || currentContent.length) {
      sections.push({
        title: currentTitle,
        content: currentContent.join("\n").trim(),
        icon: guessIcon(currentTitle),
      });
    }
  };

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);
    if (h2 || h3) {
      flush();
      currentTitle = (h2?.[1] || h3?.[1] || "").replace(/[*_]/g, "").trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  flush();
  return sections;
}

function guessIcon(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("receita") || t.includes("faturamento") || t.includes("revenue")) return "revenue";
  if (t.includes("despesa") || t.includes("custo") || t.includes("gasto")) return "expense";
  if (t.includes("resultado") || t.includes("lucro") || t.includes("margem")) return "profit";
  if (t.includes("alerta") || t.includes("risco") || t.includes("atenção")) return "alert";
  if (t.includes("recomend") || t.includes("sugestão") || t.includes("ação") || t.includes("dica")) return "tip";
  if (t.includes("comparativo") || t.includes("variação") || t.includes("evolução")) return "chart";
  if (t.includes("resumo") || t.includes("visão") || t.includes("panorama") || t.includes("score")) return "summary";
  if (t.includes("destaque") || t.includes("positivo") || t.includes("conquista")) return "check";
  if (t.includes("centro") || t.includes("departamento")) return "target";
  return "default";
}

const iconMap: Record<string, React.ReactNode> = {
  revenue: <DollarSign className="h-5 w-5" />,
  expense: <TrendingDown className="h-5 w-5" />,
  profit: <TrendingUp className="h-5 w-5" />,
  alert: <AlertTriangle className="h-5 w-5" />,
  tip: <Lightbulb className="h-5 w-5" />,
  chart: <BarChart3 className="h-5 w-5" />,
  summary: <Compass className="h-5 w-5" />,
  check: <CheckCircle className="h-5 w-5" />,
  target: <Target className="h-5 w-5" />,
  default: <FileText className="h-5 w-5" />,
};

const colorMap: Record<string, string> = {
  revenue: "text-revenue bg-revenue/10 border-revenue/20",
  expense: "text-expense bg-expense/10 border-expense/20",
  profit: "text-primary bg-primary/10 border-primary/20",
  alert: "text-warning bg-warning/10 border-warning/20",
  tip: "text-primary bg-primary/10 border-primary/20",
  chart: "text-[hsl(var(--chart-5))] bg-[hsl(var(--chart-5)/0.1)] border-[hsl(var(--chart-5)/0.2)]",
  summary: "text-primary bg-primary/10 border-primary/20",
  check: "text-revenue bg-revenue/10 border-revenue/20",
  target: "text-[hsl(var(--chart-2))] bg-[hsl(var(--chart-2)/0.1)] border-[hsl(var(--chart-2)/0.2)]",
  default: "text-muted-foreground bg-muted/50 border-border",
};

function SectionCard({
  title,
  content,
  icon,
  delay,
}: {
  title: string;
  content: string;
  icon: string;
  delay: number;
}) {
  const colors = colorMap[icon] || colorMap.default;

  return (
    <div
      className="bg-card border border-border rounded-lg p-5 animate-slide-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      {title && (
        <div className="flex items-center gap-3 mb-3">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${colors}`}>
            {iconMap[icon] || iconMap.default}
          </div>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
        </div>
      )}
      <div className="prose prose-sm dark:prose-invert max-w-none [&>ul]:space-y-1 [&>p]:text-muted-foreground [&>ul>li]:text-muted-foreground [&_strong]:text-foreground [&_em]:text-primary/80">
        <MarkdownMessage content={content} />
      </div>
    </div>
  );
}

export default function ExecutiveSummary() {
  const { company } = useCompany();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  const sections = useMemo(() => (summary ? parseSections(summary) : []), [summary]);

  const loadSummary = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    setError("");
    setSummary("");

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-summary`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ company_id: company.id }),
      });

      if (!resp.ok || !resp.body) throw new Error("Erro ao gerar resumo");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let content = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) {
              content += c;
              setSummary(content);
            }
          } catch {
            // partial JSON
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [company]);

  const now = new Date();
  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-[-0.02em]">Resumo Executivo</h1>
            <p className="text-sm text-muted-foreground capitalize">{monthLabel} — Gerado por IA</p>
          </div>
        </div>
        <Button
          onClick={loadSummary}
          disabled={loading}
          size="sm"
          className="gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {summary ? "Regenerar" : "Gerar Resumo"}
        </Button>
      </div>

      {/* Empty State */}
      {!summary && !loading && !error && (
        <div className="bg-card border border-border rounded-lg p-12 text-center animate-scale-in">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">Resumo Executivo Mensal</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            A IA irá analisar todas as transações do mês, comparar com o anterior e gerar um relatório
            visual completo com insights e recomendações acionáveis.
          </p>
          <Button onClick={loadSummary} size="lg" className="gap-2">
            <Compass className="h-4 w-4" />
            Gerar Resumo do Mês
          </Button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-card border border-border rounded-lg border-expense/30 p-6 text-center animate-fade-in">
          <AlertTriangle className="h-8 w-8 text-expense mx-auto mb-3" />
          <p className="text-sm text-expense mb-4">{error}</p>
          <Button onClick={loadSummary} size="sm" variant="outline">
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && !summary && (
        <div className="bg-card border border-border rounded-lg p-12 text-center animate-fade-in">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Analisando transações e gerando relatório...</p>
          <div className="flex justify-center gap-1 mt-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-1.5 w-8 rounded-full bg-primary/30"
                style={{
                  animation: `glowPulse 1.5s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sections */}
      {sections.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sections.map((section, i) => (
            <SectionCard
              key={i}
              title={section.title}
              content={section.content}
              icon={section.icon}
              delay={i * 100}
            />
          ))}
        </div>
      )}

      {/* Still streaming but has sections */}
      {loading && summary && (
        <div className="flex items-center gap-2 mt-4 text-muted-foreground animate-fade-in">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-xs">Gerando mais conteúdo...</span>
        </div>
      )}
    </AppLayout>
  );
}
