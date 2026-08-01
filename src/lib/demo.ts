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

/**
 * Tour de 5 passos: cada um mostra UMA capacidade que o cliente sente na pele,
 * e o último converte. Mais que isso vira aula e o visitante abandona no meio.
 */
export const PASSOS_DO_TOUR: PassoDoTour[] = [
  {
    rota: "/dashboard",
    titulo: "O cockpit do seu dinheiro",
    texto:
      "Receita, margem, caixa e metas dos últimos 12 meses numa tela. O que você vê é o grupo Aurora, uma operação fictícia com 3 CNPJs.",
  },
  {
    rota: "/bank-inbox",
    titulo: "O extrato chega sozinho",
    texto:
      "O banco sincroniza e a IA já classifica: 12 lançamentos esperando um clique para virar caixa contabilizado. Sem digitar, sem colar planilha.",
  },
  {
    rota: "/consolidado",
    titulo: "Três CNPJs, um resultado",
    texto:
      "Matriz, Digital e Varejo consolidados de verdade: DRE do grupo inteiro, com as operações entre empresas eliminadas.",
  },
  {
    rota: "/recorrencia",
    titulo: "Receita previsível e quem vai comprar de novo",
    texto:
      "MRR, churn e o radar de recompra dizendo quem está na janela de comprar agora. Agentes vigiam isso todo dia e avisam no WhatsApp.",
  },
  {
    rota: "/dashboard",
    titulo: "Pronto para o seu CNPJ?",
    texto:
      "Isso foi a Aurora. Crie sua conta e o assistente de instalação te leva do zero ao primeiro fechamento, com todas as integrações explicadas.",
  },
];
