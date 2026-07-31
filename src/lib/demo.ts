/**
 * Conta de demonstração compartilhada (grupo Aurora, seed em
 * supabase/seed-demo.sql). O usuário demo é viewer em 3 CNPJs: a RLS
 * (políticas RESTRICTIVE de escrita) garante o somente-leitura; nada aqui
 * depende de esconder botão no front. A senha é pública por design.
 */

export const DEMO_EMAIL = "demo@financeai.app";
export const DEMO_PASSWORD = "demo-financeai-2026";

export const DEMO_TOUR_STEP_KEY = "financeai:demo-tour-step";
export const DEMO_TOUR_DISMISSED_KEY = "financeai:demo-tour-dismissed";

export function isDemoUser(email: string | null | undefined): boolean {
  return (email ?? "").toLowerCase() === DEMO_EMAIL;
}

export interface PassoDoTour {
  rota: string;
  titulo: string;
  texto: string;
}

/** Ordem wow-first: consolidação e automação antes de cadastros e ajustes. */
export const PASSOS_DO_TOUR: PassoDoTour[] = [
  {
    rota: "/dashboard",
    titulo: "O cockpit do seu dinheiro",
    texto:
      "Receita, margem e metas dos últimos 12 meses num painel só. Tudo o que você vê é o grupo Aurora, uma operação fictícia com 3 CNPJs.",
  },
  {
    rota: "/bank-inbox",
    titulo: "Extrato que chega sozinho",
    texto:
      "O banco da matriz sincroniza via Open Finance: 12 lançamentos esperando um clique para virar caixa classificado. Sem colar extrato, sem digitação.",
  },
  {
    rota: "/agents",
    titulo: "Agentes de olho no caixa",
    texto:
      "O Vigia de Caixa e a Sentinela de Contas rodam todo dia e avisam antes do problema. Repare no sino de notificações no topo: eles já deixaram recado.",
  },
  {
    rota: "/consolidado",
    titulo: "O grupo inteiro numa tela",
    texto:
      "Matriz, Digital e Varejo consolidados: caixa, resultado e obrigações dos 3 CNPJs lado a lado, sem abrir três sistemas.",
  },
  {
    rota: "/dashboard",
    titulo: "BI do seu jeito",
    texto:
      "Em Minhas visões você monta os próprios widgets: receita por período, aging de recebíveis, centro de custo. Sem depender de ninguém para criar relatório.",
  },
  {
    rota: "/pdv",
    titulo: "Frente de caixa",
    texto:
      "Venda de balcão com produto, estoque e NFC-e nativa. O turno do dia fecha com sangria e suprimento registrados.",
  },
  {
    rota: "/contador",
    titulo: "Central do Contador",
    texto:
      "Exportações contábeis prontas para fechar o mês: lançamentos classificados, DRE e razão saem daqui direto para o seu contador.",
  },
  {
    rota: "/reforma",
    titulo: "Reforma tributária sem susto",
    texto:
      "Simule o impacto de CBS e IBS na sua operação com os seus números, antes de a regra virar boleto.",
  },
  {
    rota: "/settings/integrations",
    titulo: "Conecte no seu ritmo",
    texto:
      "Open Finance, Asaas, Inter, Conta Azul, notas fiscais e WhatsApp. Tudo opcional: o produto funciona no manual e melhora a cada integração ligada.",
  },
  {
    rota: "/dashboard",
    titulo: "Pronto para o seu CNPJ?",
    texto:
      "Isso foi a Aurora. Crie sua conta grátis, cadastre sua empresa e o assistente de instalação te guia do zero ao primeiro fechamento.",
  },
];
