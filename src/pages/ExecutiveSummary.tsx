import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/hooks/useCompany";
import { useState, useCallback } from "react";
import { Loader2, FileText, RefreshCw, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function ExecutiveSummary() {
  const { company } = useCompany();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

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
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
            // partial JSON, skip
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [company]);

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Resumo Executivo</h1>
          <p className="text-sm text-muted-foreground mt-1">Relatório mensal gerado por IA com análises e recomendações</p>
        </div>
        <Button onClick={loadSummary} disabled={loading} size="sm">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          {summary ? "Regenerar" : "Gerar Resumo"}
        </Button>
      </div>

      {!summary && !loading && !error && (
        <Card className="glass-card">
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Resumo Executivo Mensal</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              A IA irá analisar todas as transações do mês atual, comparar com o mês anterior e gerar um relatório executivo completo com insights e recomendações.
            </p>
            <Button onClick={loadSummary} size="lg">
              <FileText className="h-4 w-4 mr-2" />
              Gerar Resumo do Mês
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="glass-card border-expense/20">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-expense">{error}</p>
            <Button onClick={loadSummary} className="mt-4" size="sm">Tentar novamente</Button>
          </CardContent>
        </Card>
      )}

      {(summary || loading) && (
        <Card className="glass-card">
          <CardContent className="p-6">
            {loading && !summary && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Analisando transações e gerando relatório...</span>
              </div>
            )}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
            {loading && summary && (
              <div className="flex items-center gap-2 mt-4 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">Gerando...</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
