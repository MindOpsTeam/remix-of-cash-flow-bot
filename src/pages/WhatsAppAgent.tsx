import { AppLayout } from "@/components/AppLayout";
import { MessageSquare, Camera, Mic, FileText } from "lucide-react";

const features = [
  { icon: Camera, title: "OCR de Notas Fiscais", description: "Envie uma foto de nota fiscal e o sistema extrai automaticamente os dados para lançamento." },
  { icon: Mic, title: "Registro por Áudio", description: "Grave um áudio descrevendo a despesa e o sistema transcreve e classifica automaticamente." },
  { icon: FileText, title: "Relatórios sob Demanda", description: "Peça um relatório DRE ou fluxo de caixa e receba em PDF diretamente no WhatsApp." },
  { icon: MessageSquare, title: "Consultas Rápidas", description: "Pergunte sobre saldo, receitas ou despesas e receba respostas instantâneas." },
];

export default function WhatsApp() {
  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Agente WhatsApp</h1>
        <p className="text-sm text-muted-foreground mt-1">Assistente financeiro inteligente via WhatsApp</p>
      </div>

      <div className="glass-card p-8 mb-6 text-center max-w-2xl mx-auto">
        <div className="h-16 w-16 rounded-2xl bg-revenue/10 flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="h-8 w-8 text-revenue" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-2">Integração em Breve</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          O agente WhatsApp permitirá registrar lançamentos, consultar saldo e receber relatórios diretamente pelo seu celular.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {features.map((f) => (
          <div key={f.title} className="glass-card p-5">
            <f.icon className="h-5 w-5 text-primary mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-1">{f.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
