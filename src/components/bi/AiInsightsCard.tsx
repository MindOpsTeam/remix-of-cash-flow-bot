import { mensagemDeErro } from "@/lib/erros";
import { useState } from "react";
import { Brain, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartPanel } from "@/components/bi/ChartPanel";
import { edgeAuthHeaders, edgeUrl } from "@/lib/edge";
import { toast } from "sonner";

/**
 * Análise executiva do mês pela IA (edge ai-summary, streaming SSE).
 *
 * Disparo é sempre humano e o resultado fica em sessionStorage por empresa e
 * dia: IA custa dinheiro, então nada de gerar resumo em cada render. O texto
 * chega em markdown; renderizamos como texto com quebras — nunca HTML cru.
 */
interface AiInsightsCardProps {
  companyId: string | undefined;
  companyName: string | undefined;
}

const cacheKey = (companyId: string) => `ai-summary:${companyId}:${new Date().toISOString().slice(0, 10)}`;

export function AiInsightsCard({ companyId, companyName }: AiInsightsCardProps) {
  const [texto, setTexto] = useState<string>(() =>
    companyId ? sessionStorage.getItem(cacheKey(companyId)) ?? "" : "",
  );
  const [gerando, setGerando] = useState(false);

  async function gerar() {
    if (!companyId) return;
    setGerando(true);
    setTexto("");
    try {
      const resp = await fetch(edgeUrl("ai-summary"), {
        method: "POST",
        headers: await edgeAuthHeaders(),
        body: JSON.stringify({ company_id: companyId }),
      });
      if (!resp.ok || !resp.body) throw new Error(`A análise falhou (${resp.status}). Tente de novo.`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acumulado = "";

      for (;;) {
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
              acumulado += c;
              setTexto(acumulado);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
      if (acumulado) sessionStorage.setItem(cacheKey(companyId), acumulado);
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setGerando(false);
    }
  }

  return (
    <ChartPanel
      title="Análise da IA"
      description={companyName ? `Leitura executiva do mês de ${companyName}` : "Leitura executiva do mês"}
      delay={350}
      meta={
        texto ? (
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={gerar} disabled={gerando}>
            {gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </Button>
        ) : undefined
      }
    >
      {!texto && !gerando ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border/80 bg-muted/20 px-6 py-8 text-center">
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
            A IA lê os lançamentos do mês, compara com o anterior e devolve destaques, riscos e recomendações.
          </p>
          <Button size="sm" className="gap-2" onClick={gerar} disabled={!companyId}>
            <Brain className="h-4 w-4" />
            Gerar análise do mês
          </Button>
        </div>
      ) : (
        <div className="max-h-[320px] overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-foreground">
          {texto}
          {gerando && <Loader2 className="ml-1 inline h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
      )}
    </ChartPanel>
  );
}
