import { edgeAuthHeaders, edgeUrl } from "@/lib/edge";
import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useCompany } from "@/hooks/useCompany";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Send, RefreshCw, TrendingUp, AlertTriangle, Target, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCFODashboard } from "@/hooks/useCFODashboard";
import { CFODashboard } from "@/components/cfo/CFODashboard";
import { MarkdownMessage } from "@/components/cfo/MarkdownMessage";

type Message = { role: "user" | "assistant"; content: string };

const QUICK_QUESTIONS = [
  "Qual o score financeiro da empresa?",
  "Quais são os maiores riscos financeiros?",
  "Posso contratar mais um funcionário?",
  "Como reduzir despesas em 10%?",
  "Projeção de fluxo de caixa para o próximo mês",
  "Análise dos centros de custo",
];

export default function CFODigital() {
  const { company } = useCompany();
  const { toast } = useToast();
  const dashboardData = useCFODashboard();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasInitialAnalysis, setHasInitialAnalysis] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const streamChat = async (question?: string) => {
    if (!company) return;
    setIsLoading(true);

    const userMessage = question || input.trim();
    if (userMessage) {
      setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
      setInput("");
    }

    let assistantContent = "";
    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content.includes("─")) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
        }
        return [...prev, { role: "assistant", content: assistantContent }];
      });
    };

    try {
      const resp = await fetch(edgeUrl("cfo-digital"), {
        method: "POST",
        headers: await edgeAuthHeaders(),
        body: JSON.stringify({
          question: userMessage || undefined,
          company_id: company.id,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || `Erro ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) updateAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (!hasInitialAnalysis) setHasInitialAnalysis(true);
    } catch (e: any) {
      console.error("CFO Digital error:", e);
      toast({
        title: "Erro",
        description: e.message || "Não foi possível conectar ao CFO Digital",
        variant: "destructive",
      });
      setMessages((prev) => prev.filter((m) => !(m.role === "assistant" && m.content === "")));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    streamChat();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-[-0.02em]">CFO Digital</h1>
              <p className="text-sm text-muted-foreground">Assistente Estratégico Financeiro</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMessages([]);
              setHasInitialAnalysis(false);
              streamChat();
            }}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Novo Diagnóstico
          </Button>
        </div>

        {/* Dashboard */}
        <CFODashboard data={dashboardData} />

        {/* Quick Actions */}
        {!hasInitialAnalysis && messages.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card
              className="cursor-pointer hover:bg-accent/40 transition-all"
              onClick={() => streamChat()}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <TrendingUp className="h-8 w-8 text-primary shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-foreground">Resumo Estratégico</p>
                  <p className="text-xs text-muted-foreground">Score financeiro + diagnóstico completo</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:bg-accent/40 transition-all"
              onClick={() => streamChat("Identifique os 5 maiores riscos financeiros e sugira ações preventivas.")}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <AlertTriangle className="h-8 w-8 text-warning shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-foreground">Alertas de Risco</p>
                  <p className="text-xs text-muted-foreground">Riscos financeiros e ações preventivas</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:bg-accent/40 transition-all"
              onClick={() => streamChat("Faça uma análise detalhada dos centros de custo e sugira otimizações.")}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <Target className="h-8 w-8 text-chart-5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-foreground">Centros de Custo</p>
                  <p className="text-xs text-muted-foreground">Análise e otimizações por centro</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Chat Area */}
        {(messages.length > 0 || isLoading) && (
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <MarkdownMessage content={msg.content} />
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex justify-start">
                    <div className="bg-secondary rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analisando dados financeiros...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Questions */}
        {messages.length > 0 && !isLoading && (
          <div className="flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map((q) => (
              <Button
                key={q}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => streamChat(q)}
              >
                {q}
              </Button>
            ))}
          </div>
        )}

        {/* Input */}
        <Card>
          <CardContent className="p-3">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte ao CFO Digital... Ex: Posso contratar mais um funcionário?"
                className="min-h-[44px] max-h-[120px] resize-none bg-background/50 border-border/50"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="shrink-0 h-11 w-11" aria-label="Enviar mensagem">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
