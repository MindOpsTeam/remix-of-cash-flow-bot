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
 * Tour guiado: cada passo mostra UMA capacidade que o cliente sente na pele. O
 * meio é o arco fiscal (emitir, nota virar dinheiro, compras, conciliar, cancelar,
 * segurança) e o último converte. Texto curto de propósito: mais que isso vira aula.
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
      "O banco sincroniza e a IA já classifica: os lançamentos esperam um clique para virar caixa contabilizado. Sem digitar, sem colar planilha.",
  },
  {
    rota: "/consolidado",
    titulo: "Três CNPJs, um resultado",
    texto:
      "Matriz, Digital e Varejo consolidados de verdade: DRE do grupo inteiro, com as operações entre empresas eliminadas.",
  },
  {
    rota: "/fiscal/nfse/emit",
    titulo: "Emita a nota fiscal de verdade",
    texto:
      "NFS-e pelo Ambiente Nacional com o seu certificado A1. Uma trava anti-duplicidade garante que timeout ou clique dobrado nunca transmitam a mesma nota duas vezes.",
  },
  {
    rota: "/fiscal",
    titulo: "A nota vira dinheiro sozinha",
    texto:
      "Nota autorizada abre a conta a receber já com vencimento, conta contábil certa, valor líquido de retenções e parcelada pelas duplicatas do XML. Cancelou? O recebível estorna sozinho.",
  },
  {
    rota: "/fiscal/contas-a-pagar",
    titulo: "As compras entram sem digitar",
    texto:
      "A nota de entrada, por XML ou foto no leitor, vira uma conta a pagar por parcela, nas datas reais. A Ciência da Operação junto à SEFAZ fica registrada com prazo.",
  },
  {
    rota: "/bank-inbox",
    titulo: "Baixa parcial e o contábil fecha",
    texto:
      "O crédito ou débito real do banco baixa o título, inteiro ou em parte deixando saldo, e a receita ou despesa cai na conta certa do DRE. Nada é contado duas vezes.",
  },
  {
    rota: "/settings/integrations/nfse",
    titulo: "Seu certificado, blindado",
    texto:
      "O certificado A1 e a senha ficam só no servidor. Nem quem usa o sistema lê o segredo pelo navegador: a emissão busca no cofre, na hora.",
  },
  {
    rota: "/dashboard",
    titulo: "Pronto para o seu CNPJ?",
    texto:
      "Isso foi a Aurora. Crie sua conta e o assistente de instalação te leva do zero ao primeiro fechamento, com todas as integrações explicadas.",
  },
];
