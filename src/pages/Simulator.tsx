import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FlaskConical, Loader2, Send, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MarkdownMessage } from "@/components/cfo/MarkdownMessage";

const SCENARIOS = [
  { label: "Demitir 1 funcionário", question: "E se eu demitir 1 funcionário? Qual o impacto no fluxo de caixa e resultado?" },
  { label: "Receita cair 20%", question: "E se minha receita cair 20% no próximo mês? Simule o impacto." },
  { label: "Contratar mais 2 pessoas", question: "E se eu contratar mais 2 funcionários com salário médio? Qual o impacto?" },
  { label: "Reduzir despesas em 15%", question: "E se eu conseguir reduzir todas as despesas operacionais em 15%? Simule." },
  { label: "Aumentar preço em 10%", question: "E se eu aumentar o preço dos meus serviços em 10%? Qual o impacto na margem?" },
  { label: "Perder o maior cliente", question: "E se eu perder meu maior cliente? Simule o pior cenário." },
];

export default function Simulator() {
  const { company } = useCompany();
  const { session } = useAuth();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const simulate = async (question: string) => {
    if (!company) return;
    setIsLoading(true);
    setResult("");
    setInput("");

    let content = "";
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cfo-digital`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          question: `SIMULAÇÃO FINANCEIRA: ${question}. Analise os dados reais da empresa e simule o cenário. Inclua: 1) Impacto no resultado mensal, 2) Impacto na margem, 3) Impacto no fluxo de caixa (3 meses), 4) Riscos do cenário, 5) Recomendação final. Use tabelas markdown quando possível.`,
          company_id: company.id,
        }),
      });

      if (!resp.ok) throw new Error("Erro na simulação");
      if (!resp.body) throw new Error("Sem resposta");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
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
            if (c) { content += c; setResult(content); }
          } catch { break; }
        }
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 animate-fade-in">
          <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <FlaskConical className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-[-0.02em]">Simulador "E se?"</h1>
            <p className="text-sm text-muted-foreground">Simule cenários financeiros com IA</p>
          </div>
        </div>

        {/* Scenario Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SCENARIOS.map((s, i) => (
            <Card
              key={i}
              className="cursor-pointer hover:bg-accent/40 transition-all duration-300 animate-slide-up"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
              onClick={() => simulate(s.question)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FlaskConical className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Custom Input */}
        <Card>
          <CardContent className="p-4">
            <form
              onSubmit={(e) => { e.preventDefault(); if (input.trim() && !isLoading) simulate(input); }}
              className="flex gap-2"
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Descreva seu cenário... Ex: "E se eu abrir uma filial com custo de R$ 15.000/mês?"'
                className="min-h-[44px] max-h-[100px] resize-none bg-background/50 border-border/50"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (input.trim() && !isLoading) simulate(input); }
                }}
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="shrink-0 h-11 w-11" aria-label="Enviar simulação">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Result */}
        {(result || isLoading) && (
          <Card className="animate-fade-in">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                Resultado da Simulação
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading && !result ? (
                <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Calculando cenário...</span>
                </div>
              ) : (
                // Tabela markdown só renderiza com remark-gfm; o ReactMarkdown
                // cru deixava "| Métrica | Cenário |" na tela como texto.
                <MarkdownMessage content={result} className="text-[13px]" />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
