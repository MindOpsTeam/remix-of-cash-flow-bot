/**
 * Catálogo e régua dos templates de agente.
 *
 * ⚠️ ARQUIVO PURO E BROWSER-SAFE — restrição DURA, não estilo. Ele é
 * importado EM RUNTIME pelo bundle do cliente (GaleriaAgentes.tsx) além do
 * vitest, então NUNCA adicione aqui import por URL (esm.sh), Deno.env ou
 * qualquer API de Deno: isso quebraria o build de produção do dashboard, não
 * a edge. Quem toca banco é o agent-runner; quem redige texto de IA também —
 * aqui mora só a DECISÃO determinística de quando falar e o que dizer com
 * números prontos (mesmo padrão de _shared/agentes.ts).
 */

export interface CampoConfig {
  key: string;
  label: string;
  tipo: "number" | "textarea";
  sufixo?: string;
}

export interface TemplateAgente {
  key: string;
  nome: string;
  descricao: string;
  requerIa: boolean;
  /** Dias sem repetir a mesma notificação (dedupe_key igual). */
  dedupeDias: number;
  configPadrao: Record<string, number | string>;
  campos: CampoConfig[];
  link: string;
}

export const TEMPLATES_AGENTES: TemplateAgente[] = [
  {
    key: "caixa_baixo",
    nome: "Vigia de Caixa",
    descricao: "Avisa quando o saldo somado das contas cai abaixo do limite que você definir.",
    requerIa: false,
    dedupeDias: 3,
    configPadrao: { limite: 10_000 },
    campos: [{ key: "limite", label: "Alertar quando o caixa ficar abaixo de", tipo: "number", sufixo: "R$" }],
    link: "/forecast",
  },
  {
    key: "contas_a_vencer",
    nome: "Sentinela de Contas",
    descricao: "Todo dia, soma as contas a pagar que vencem na janela configurada e as vencidas.",
    requerIa: false,
    dedupeDias: 2,
    configPadrao: { dias: 3 },
    campos: [{ key: "dias", label: "Janela de aviso antes do vencimento", tipo: "number", sufixo: "dias" }],
    link: "/fiscal/contas-a-pagar",
  },
  {
    key: "impostos_a_vencer",
    nome: "Guarda Fiscal",
    descricao: "Vigia as guias de imposto e avisa antes do vencimento.",
    requerIa: false,
    dedupeDias: 3,
    configPadrao: { dias: 7 },
    campos: [{ key: "dias", label: "Janela de aviso antes do vencimento", tipo: "number", sufixo: "dias" }],
    link: "/fiscal/impostos",
  },
  {
    key: "vigia_de_metas",
    nome: "Vigia de Metas",
    descricao: "Acompanha as metas do cockpit e avisa quando uma bate ou estoura.",
    requerIa: false,
    dedupeDias: 7,
    configPadrao: {},
    campos: [],
    link: "/dashboard",
  },
  {
    key: "resumo_semanal",
    nome: "Resumo do CFO",
    descricao: "Toda segunda-feira, um parágrafo executivo sobre a semana financeira, escrito pela IA sobre números reais.",
    requerIa: true,
    dedupeDias: 6,
    configPadrao: {},
    campos: [],
    link: "/dashboard",
  },
  {
    key: "vigia_de_recompra",
    nome: "Vigia de Recompra",
    descricao: "Avisa todo dia quais clientes entraram na janela de recompra ou já passaram dela — a receita previsível que está na mão.",
    requerIa: false,
    dedupeDias: 2,
    configPadrao: { ticket_min: 0 },
    campos: [{ key: "ticket_min", label: "Ignorar clientes com ticket médio abaixo de", tipo: "number", sufixo: "R$" }],
    link: "/recorrencia",
  },
  {
    key: "analista_custom",
    nome: "Analista Sob Medida",
    descricao: "Você escreve a pergunta que ele deve responder todo dia sobre os seus números (ex.: 'algum cliente concentra mais de 40% da receita?').",
    requerIa: true,
    dedupeDias: 1,
    configPadrao: { prompt: "" },
    campos: [{ key: "prompt", label: "O que este agente deve analisar e responder", tipo: "textarea" }],
    link: "/agents",
  },
];

export const TEMPLATE_POR_KEY = Object.fromEntries(TEMPLATES_AGENTES.map((t) => [t.key, t]));

/* ------------------------------------------------------------------ */
/* Réguas determinísticas                                              */
/* ------------------------------------------------------------------ */

export interface Aviso {
  titulo: string;
  corpo: string;
  dedupeKey: string;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function avaliarCaixaBaixo(saldo: number | null, limite: number): Aviso | null {
  if (saldo === null || saldo >= limite) return null;
  return {
    titulo: "Caixa abaixo do limite",
    corpo: `O saldo somado das contas está em ${brl(saldo)}, abaixo do limite de ${brl(limite)} que você definiu.`,
    dedupeKey: "caixa_baixo",
  };
}

export function avaliarContasAVencer(
  contas: Array<{ valor: number; vencimento: string; fornecedor?: string | null }>,
  hojeIso: string,
  dias: number,
): Aviso | null {
  const limite = new Date(`${hojeIso}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + dias);
  const limiteIso = limite.toISOString().slice(0, 10);

  const naJanela = contas.filter((c) => c.vencimento <= limiteIso);
  if (naJanela.length === 0) return null;

  const vencidas = naJanela.filter((c) => c.vencimento < hojeIso);
  const total = naJanela.reduce((s, c) => s + c.valor, 0);
  const partes = [
    `${naJanela.length} conta(s) somando ${brl(total)} ${vencidas.length > 0 ? "exigem atenção" : `vencem em até ${dias} dia(s)`}.`,
  ];
  if (vencidas.length > 0) {
    partes.push(`${vencidas.length} já vencida(s), somando ${brl(vencidas.reduce((s, c) => s + c.valor, 0))}.`);
  }
  const maior = [...naJanela].sort((a, b) => b.valor - a.valor)[0];
  if (maior?.fornecedor) partes.push(`Maior: ${maior.fornecedor} (${brl(maior.valor)}).`);

  return {
    titulo: vencidas.length > 0 ? "Contas a pagar vencidas" : "Contas vencendo",
    corpo: partes.join(" "),
    dedupeKey: `contas_a_vencer:${limiteIso}`,
  };
}

export function avaliarImpostos(
  guias: Array<{ valor: number; vencimento: string; tipo?: string | null }>,
  hojeIso: string,
  dias: number,
): Aviso | null {
  const limite = new Date(`${hojeIso}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + dias);
  const limiteIso = limite.toISOString().slice(0, 10);

  const naJanela = guias.filter((g) => g.vencimento >= hojeIso && g.vencimento <= limiteIso);
  if (naJanela.length === 0) return null;

  const total = naJanela.reduce((s, g) => s + g.valor, 0);
  const tipos = [...new Set(naJanela.map((g) => g.tipo).filter(Boolean))].join(", ");
  return {
    titulo: "Impostos vencendo",
    corpo: `${naJanela.length} guia(s) somando ${brl(total)} vencem até ${new Date(`${limiteIso}T00:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}${tipos ? ` (${tipos})` : ""}.`,
    dedupeKey: `impostos:${limiteIso}`,
  };
}

export function avaliarRecompra(
  clientes: Array<{ name: string; status: string; ticket_medio: number | null }>,
  ticketMin: number,
  hojeIso: string,
): Aviso | null {
  const quentes = clientes.filter(
    (c) => (c.status === "previsto" || c.status === "atrasado") && Number(c.ticket_medio ?? 0) >= ticketMin,
  );
  if (quentes.length === 0) return null;

  const previstos = quentes.filter((c) => c.status === "previsto");
  const atrasados = quentes.filter((c) => c.status === "atrasado");
  const potencial = quentes.reduce((s, c) => s + Number(c.ticket_medio ?? 0), 0);
  const maior = [...quentes].sort((a, b) => Number(b.ticket_medio ?? 0) - Number(a.ticket_medio ?? 0))[0];

  const partes = [
    `${quentes.length} cliente(s) na janela de recompra, somando ${brl(potencial)} de ticket médio.`,
  ];
  if (previstos.length > 0) partes.push(`${previstos.length} na hora de comprar.`);
  if (atrasados.length > 0) partes.push(`${atrasados.length} já atrasado(s).`);
  if (maior) partes.push(`Maior: ${maior.name} (${brl(Number(maior.ticket_medio ?? 0))}).`);

  return {
    titulo: "Clientes prontos para recomprar",
    corpo: partes.join(" "),
    dedupeKey: `recompra:${hojeIso}`,
  };
}

export function avaliarMeta(meta: {
  metric_key: string;
  label: string;
  valor: number;
  alvo: number;
  direcao: "acima" | "abaixo";
  formato: "currency" | "percent";
}): Aviso | null {
  const fmt = (v: number) => (meta.formato === "percent" ? `${v.toFixed(1)}%` : brl(v));
  if (meta.direcao === "acima" && meta.valor >= meta.alvo) {
    return {
      titulo: `Meta batida: ${meta.label}`,
      corpo: `${meta.label} chegou a ${fmt(meta.valor)}, acima do alvo de ${fmt(meta.alvo)}.`,
      dedupeKey: `meta:${meta.metric_key}:batida`,
    };
  }
  if (meta.direcao === "abaixo" && meta.valor > meta.alvo) {
    return {
      titulo: `Meta estourada: ${meta.label}`,
      corpo: `${meta.label} está em ${fmt(meta.valor)}, acima do teto de ${fmt(meta.alvo)}.`,
      dedupeKey: `meta:${meta.metric_key}:estourada`,
    };
  }
  return null;
}
