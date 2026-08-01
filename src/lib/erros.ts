/**
 * Tradutor de erro técnico para linguagem de gente.
 *
 * O Postgres devolve coisas como "new row violates row-level security policy
 * ...". Isso não é mensagem para o usuário: não diz o que aconteceu nem o que
 * fazer. Aqui cada caso vira uma frase que explica a causa E o caminho.
 *
 * Puro e testável de propósito — mensagem de erro é parte do produto.
 */

export interface ErroTraduzido {
  mensagem: string;
  /** Quando o erro é esperado (permissão, modo demo), não é falha do sistema. */
  esperado: boolean;
}

const REGRAS: Array<{ teste: RegExp; mensagem: string; esperado: boolean }> = [
  {
    teste: /Template nao aceita (insert|update|delete)|plataforma_bloqueada|projeto original \(somente leitura\)|REMIX_NECESSARIO/i,
    mensagem:
      "Este é o projeto de demonstração, aberto só para consulta. Faça o remix para ter o seu próprio ambiente e liberar todas as ações.",
    esperado: true,
  },
  {
    teste: /Viewer nao (insere|altera|apaga)|somente leitura nesta empresa|READ_ONLY_ROLE/i,
    mensagem: "Seu perfil nesta empresa é somente leitura. Peça a um administrador para liberar o acesso de edição.",
    esperado: true,
  },
  {
    teste: /conta de demonstra(ç|c)(ã|a)o/i,
    mensagem: "A conta de demonstração não altera dados. Crie a sua conta para trabalhar de verdade.",
    esperado: true,
  },
  {
    teste: /row-level security policy/i,
    mensagem: "Você não tem permissão para esta ação nesta empresa.",
    esperado: true,
  },
  {
    teste: /mes .* esta fechado|mês .* está fechado/i,
    mensagem: "Esse mês já foi fechado. Reabra o fechamento antes de alterar lançamentos do período.",
    esperado: true,
  },
  {
    teste: /duplicate key|already exists|23505/i,
    mensagem: "Já existe um registro com esses dados. Verifique se não é uma duplicidade.",
    esperado: true,
  },
  {
    teste: /violates foreign key|23503/i,
    mensagem: "Este registro está ligado a outros e não pode ser removido enquanto essas ligações existirem.",
    esperado: true,
  },
  {
    teste: /violates check constraint|23514/i,
    mensagem: "Algum campo está com valor fora do permitido. Revise os dados e tente de novo.",
    esperado: true,
  },
  {
    teste: /PLAN_NOT_INCLUDED|não inclui/i,
    mensagem: "Este recurso não está incluído no seu plano atual.",
    esperado: true,
  },
  {
    teste: /Failed to fetch|NetworkError|ERR_NETWORK|timeout/i,
    mensagem: "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.",
    esperado: false,
  },
  {
    teste: /JWT|not authenticated|Unauthorized|401/i,
    mensagem: "Sua sessão expirou. Entre de novo para continuar.",
    esperado: true,
  },
];

export function traduzirErro(erro: unknown): ErroTraduzido {
  const bruto =
    typeof erro === "string"
      ? erro
      : erro instanceof Error
        ? erro.message
        : typeof erro === "object" && erro && "message" in erro
          ? String((erro as { message: unknown }).message)
          : "";

  for (const r of REGRAS) {
    if (r.teste.test(bruto)) return { mensagem: r.mensagem, esperado: r.esperado };
  }

  // Sem tradução: devolve o texto original em vez de engolir a informação —
  // mensagem genérica esconde o problema de quem poderia resolvê-lo.
  return { mensagem: bruto || "Não foi possível concluir a ação.", esperado: false };
}

/** Atalho para os toasts: só o texto. */
export function mensagemDeErro(erro: unknown): string {
  return traduzirErro(erro).mensagem;
}
