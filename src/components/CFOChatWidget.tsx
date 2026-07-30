import { useState, useRef, useEffect } from "react";
import { Brain, Send, X, Loader2, RotateCcw } from "lucide-react";
import { MarkdownMessage } from "@/components/cfo/MarkdownMessage";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

type Message = { role: "user" | "assistant"; content: string };

export function CFOChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { company } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const streamChat = async (question: string) => {
    if (!company || !question.trim()) return;
    setIsLoading(true);

    const userMsg: Message = { role: "user", content: question };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");

    let content = "";
    const update = (chunk: string) => {
      content += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m));
        }
        return [...prev, { role: "assistant", content }];
      });
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cfo-digital`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          company_id: company.id,
        }),
      });

      if (resp.status === 429) {
        toast({ title: "Limite atingido", description: "Aguarde alguns minutos e tente novamente.", variant: "destructive" });
        return;
      }
      if (resp.status === 402) {
        toast({ title: "Créditos insuficientes", description: "Adicione créditos ao workspace.", variant: "destructive" });
        return;
      }
      if (!resp.ok) throw new Error("Erro na resposta");
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
            if (c) update(c);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const panelClasses = isMobile
    ? "fixed inset-0 z-50 flex flex-col bg-card animate-scale-in"
    : "via-glass-panel fixed bottom-6 right-6 z-50 flex max-h-[560px] w-[390px] flex-col overflow-hidden animate-scale-in";

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Abrir CFO Digital"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-[var(--via-navy)] text-white shadow-dropdown transition-[transform,box-shadow] duration-200 ease-via-spring hover:-translate-y-1 hover:scale-[1.03] hover:shadow-modal focus-visible:shadow-focus"
        >
          <Brain className="h-6 w-6" />
        </button>
      )}

      {isOpen && (
        <div className={panelClasses}>
          <div className="flex items-center justify-between border-b border-border bg-card/70 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/10 bg-primary/[0.06]">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">CFO Digital</p>
                <p className="text-[10px] text-muted-foreground">Assistente Financeiro</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button onClick={() => setMessages([])} aria-label="Nova conversa" className="text-muted-foreground hover:text-foreground transition-colors duration-150 mr-1">
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <button onClick={() => setIsOpen(false)} aria-label="Fechar chat" className="text-muted-foreground hover:text-foreground transition-colors duration-150">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto p-3 space-y-3 ${isMobile ? "min-h-0" : "min-h-[200px] max-h-[340px]"}`}>
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Brain className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Pergunte sobre suas finanças</p>
                <div className="mt-3 space-y-1.5">
                  {["Qual meu saldo?", "Extrato do mês", "Últimas transações"].map((q) => (
                    <button
                      key={q}
                      onClick={() => streamChat(q)}
                    className="block w-full rounded-md border border-transparent bg-secondary px-3 py-2 text-left text-xs text-secondary-foreground transition-all duration-150 hover:border-primary/10 hover:bg-secondary/80"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}>
                  {msg.role === "assistant" ? (
                    <MarkdownMessage content={msg.content} />
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-secondary rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Analisando...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-border bg-card/70 p-2 backdrop-blur-xl">
            <form
              onSubmit={(e) => { e.preventDefault(); if (input.trim() && !isLoading) streamChat(input); }}
              className="flex gap-2"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte ao CFO..."
                className="flex-1 bg-[hsl(var(--input-bg))] border border-transparent rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-card focus:border-primary transition-all duration-150"
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="h-9 w-9 shrink-0" aria-label="Enviar mensagem">
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
