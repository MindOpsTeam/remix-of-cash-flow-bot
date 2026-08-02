/**
 * Catálogo de configuração da plataforma — PURO e testável.
 *
 * Declara TUDO que o admin precisa preencher para ligar o FinanceAI: campos de
 * cada integração, o guia passo a passo de onde a chave nasce, o custo do
 * provedor e onde a credencial é guardada. Nada aqui faz I/O: quem salva e
 * testa é integracoes-io.ts. Assim o catálogo entra no vitest e na UI sem
 * duplicar regra.
 *
 * Regra de ouro do wizard: NADA é obrigatório. Cada integração é uma oferta,
 * não uma cobrança — o produto funciona no manual e melhora a cada conexão.
 */

export type CampoTipo = "text" | "password" | "select" | "url" | "tel" | "file";

export interface CampoIntegracao {
  key: string;
  label: string;
  tipo: CampoTipo;
  /** Texto de exemplo no campo (nunca uma credencial real). */
  placeholder?: string;
  /** Opções quando tipo = select. */
  opcoes?: Array<{ value: string; label: string }>;
  /** Ajuda curta abaixo do campo. */
  dica?: string;
  /** Campo é exigido para o "Salvar" daquela integração fazer sentido. */
  obrigatorioParaSalvar?: boolean;
  /** Segredo: some da tela depois de salvo (mostramos só o preview). */
  segredo?: boolean;
  /** Extensões aceitas quando tipo = file. */
  accept?: string;
}

export interface GuiaIntegracao {
  /** Onde a credencial nasce, em passos numerados e literais. */
  passos: string[];
  /** Custo real do provedor, sem eufemismo. */
  custo: string;
  /** Site oficial para o admin conferir. */
  site?: string;
  /** Quando NÃO vale a pena ligar (honestidade poupa suporte). */
  quandoNaoUsar?: string;
}

export type CategoriaIntegracao = "cobranca" | "banco" | "fiscal" | "comunicacao" | "dados";

export interface Integracao {
  id: string;
  nome: string;
  /** Uma linha: o que o negócio ganha ligando isso. */
  ganho: string;
  categoria: CategoriaIntegracao;
  campos: CampoIntegracao[];
  guia: GuiaIntegracao;
  /** Rota da tela dedicada, quando existe configuração avançada. */
  telaDedicada?: string;
  /** Onde a credencial fica guardada — mostrado ao admin, transparência. */
  ondeFicaGuardado: "vault" | "tabela";
  /** Suporta o botão "Testar conexão". */
  testavel: boolean;
}

const AMBIENTE_CAMPO: CampoIntegracao = {
  key: "environment",
  label: "Ambiente",
  tipo: "select",
  opcoes: [
    { value: "sandbox", label: "Sandbox (testes)" },
    { value: "production", label: "Produção (vale dinheiro)" },
  ],
  dica: "Comece em sandbox. Só mude para produção quando o teste passar.",
};

export const CATALOGO_INTEGRACOES: Integracao[] = [
  {
    id: "openfinance",
    nome: "Open Finance (Pluggy)",
    ganho: "O extrato do banco entra sozinho e vira lançamento classificado. É a integração que mais poupa digitação.",
    categoria: "banco",
    ondeFicaGuardado: "vault",
    testavel: true,
    telaDedicada: "/settings/integrations/openfinance",
    campos: [
      { key: "client_id", label: "Client ID", tipo: "text", placeholder: "00000000-0000-0000-0000-000000000000", obrigatorioParaSalvar: true },
      { key: "client_secret", label: "Client Secret", tipo: "password", segredo: true, obrigatorioParaSalvar: true },
      {
        key: "sandbox",
        label: "Ambiente",
        tipo: "select",
        opcoes: [
          { value: "true", label: "Sandbox (banco fictício)" },
          { value: "false", label: "Produção (banco real)" },
        ],
      },
    ],
    guia: {
      passos: [
        "Acesse dashboard.pluggy.ai e crie a conta (o cadastro é self-service e o sandbox é gratuito).",
        "No painel, vá em Applications e crie uma aplicação para o seu CNPJ.",
        "Copie o Client ID e o Client Secret que aparecem na aplicação.",
        "Cole os dois aqui, escolha o ambiente e clique em Testar conexão.",
        "Depois, em Bancos & Open Finance, clique em Conectar banco e faça o login do banco pelo widget seguro da Pluggy.",
      ],
      custo:
        "Sandbox gratuito e trial de produção por 14 dias. Em produção a Pluggy cobra por conexão bancária ativa por mês (faixa de dezenas de reais por conexão, conforme volume). Consulte pluggy.ai/precos.",
      site: "https://dashboard.pluggy.ai",
      quandoNaoUsar: "Se você só usa um banco que já tem integração direta aqui (ex.: Inter), a conexão direta sai de graça.",
    },
  },
  {
    id: "asaas",
    nome: "Asaas — cobrança automática",
    ganho: "Emite boleto e Pix para o cliente e baixa o recebimento sozinho, sem você conferir extrato.",
    categoria: "cobranca",
    ondeFicaGuardado: "tabela",
    testavel: true,
    telaDedicada: "/settings/integrations/asaas",
    campos: [
      AMBIENTE_CAMPO,
      { key: "api_key", label: "Chave de API", tipo: "password", segredo: true, obrigatorioParaSalvar: true, dica: "A chave do ambiente escolhido acima." },
      { key: "notification_email", label: "E-mail para avisos (opcional)", tipo: "text", placeholder: "financeiro@suaempresa.com.br" },
    ],
    guia: {
      passos: [
        "Crie a conta em asaas.com (para testar sem valer dinheiro, use sandbox.asaas.com).",
        "Faça login e clique na sua foto de perfil, no canto superior direito.",
        "Vá em Integrações e depois em Chave de API.",
        "Clique em Gerar chave e copie o valor (ele só aparece uma vez).",
        "Cole aqui, confirme o ambiente e clique em Testar conexão.",
      ],
      custo:
        "A conta é gratuita e não tem mensalidade. O Asaas cobra por cobrança recebida: Pix e boleto a partir de cerca de R$ 1,99 por documento; cartão por percentual. Consulte asaas.com/precos.",
      site: "https://www.asaas.com",
    },
  },
  {
    id: "stripe",
    nome: "Stripe — cartão e repasse conciliado",
    ganho:
      "Recebe por cartão e concilia o repasse do jeito que ele realmente cai: líquido e em lote, com a taxa lançada como despesa.",
    categoria: "cobranca",
    ondeFicaGuardado: "vault",
    testavel: true,
    telaDedicada: "/repasses",
    campos: [
      {
        key: "apelido",
        label: "Nome do canal",
        tipo: "text",
        placeholder: "Loja SP",
        dica: "Uma empresa pode ter vários canais Stripe. O nome é como você distingue cada um no repasse e na cobrança.",
      },
      {
        key: "mode",
        label: "Ambiente",
        tipo: "select",
        opcoes: [
          { value: "test", label: "Teste (sandbox, não move dinheiro)" },
          { value: "live", label: "Produção (dinheiro de verdade)" },
        ],
        dica: "No modo teste as chaves começam com sk_test_ e pk_test_.",
      },
      {
        key: "secret_key",
        label: "Chave secreta",
        tipo: "password",
        segredo: true,
        obrigatorioParaSalvar: true,
        placeholder: "sk_test_...",
        dica: "Começa com sk_. Vai para o cofre e nunca aparece de novo na tela.",
      },
      {
        key: "publishable_key",
        label: "Chave publicável",
        tipo: "text",
        placeholder: "pk_test_...",
        dica: "Começa com pk_. Essa pode aparecer no navegador, é pública por definição.",
      },
      {
        key: "webhook_secret",
        label: "Segredo do webhook",
        tipo: "password",
        segredo: true,
        placeholder: "whsec_...",
        dica: "Sem ele o recebimento não baixa sozinho: é o que prova que o aviso veio mesmo do Stripe.",
      },
    ],
    guia: {
      passos: [
        "Crie a conta em stripe.com e mantenha o botão Modo de teste ligado enquanto estiver experimentando.",
        "Vá em Desenvolvedores e depois em Chaves de API; copie a chave publicável (pk_) e revele a secreta (sk_).",
        "Ainda em Desenvolvedores, abra Webhooks e clique em Adicionar endpoint.",
        "Na URL cole o endereço do FinanceAI terminando em /stripe-webhook?company=SUA_EMPRESA e assine os eventos checkout.session.completed, payment_intent.succeeded, charge.succeeded e payout.paid.",
        "Copie o Signing secret (whsec_) do endpoint recém-criado, cole aqui e clique em Testar conexão.",
      ],
      custo:
        "Não tem mensalidade. No Brasil o Stripe cobra por transação aprovada, na casa de 3,99% + R$ 0,39 no cartão nacional, com percentual maior em cartão internacional. Consulte stripe.com/br/pricing.",
      site: "https://dashboard.stripe.com",
      quandoNaoUsar:
        "Se a maioria das suas vendas é boleto ou Pix, o Asaas sai mais barato. O Stripe compensa quando a entrada é cartão.",
    },
  },
  {
    id: "inter",
    nome: "Banco Inter — extrato e saldo",
    ganho: "Saldo e extrato oficiais do Inter direto na conciliação, sem intermediário e sem custo.",
    categoria: "banco",
    ondeFicaGuardado: "tabela",
    testavel: true,
    telaDedicada: "/settings/integrations/inter",
    campos: [
      { key: "client_id", label: "Client ID", tipo: "text", obrigatorioParaSalvar: true },
      { key: "client_secret", label: "Client Secret", tipo: "password", segredo: true, obrigatorioParaSalvar: true },
      { key: "account_number", label: "Número da conta", tipo: "text", placeholder: "123456789" },
      AMBIENTE_CAMPO,
    ],
    guia: {
      passos: [
        "É necessário ter conta PJ no Banco Inter.",
        "Entre no Internet Banking do Inter e vá em Menu, depois Aplicações (API).",
        "Clique em Nova aplicação e marque os escopos de Extrato e Saldo.",
        "Baixe o client_id, o client_secret e o par de certificado (.crt e .key).",
        "Cole client_id e client_secret aqui. O certificado sobe na tela dedicada do Inter, em Configurações.",
      ],
      custo: "Gratuito para correntistas PJ do Inter. A API não tem tarifa.",
      site: "https://developers.inter.co",
      quandoNaoUsar: "Se você não é cliente Inter, use Open Finance (Pluggy), que cobre praticamente todos os bancos.",
    },
  },
  {
    id: "whatsapp",
    nome: "WhatsApp (Evolution API)",
    ganho: "Os agentes te avisam no WhatsApp: caixa baixo, contas vencendo, cliente na hora de recomprar.",
    categoria: "comunicacao",
    ondeFicaGuardado: "tabela",
    testavel: true,
    telaDedicada: "/whatsapp",
    campos: [
      { key: "evolution_api_url", label: "URL do servidor Evolution", tipo: "url", placeholder: "https://api.seudominio.com.br", obrigatorioParaSalvar: true },
      { key: "evolution_api_key", label: "API key da Evolution", tipo: "password", segredo: true, obrigatorioParaSalvar: true },
      { key: "instance_name", label: "Nome da instância", tipo: "text", placeholder: "financeai", obrigatorioParaSalvar: true },
      { key: "notify_number", label: "Número que recebe os avisos", tipo: "tel", placeholder: "11999998888", dica: "Com DDD, só números. É para onde os agentes mandam." },
    ],
    guia: {
      passos: [
        "A Evolution API é um servidor de WhatsApp que você hospeda (uma VPS simples resolve) ou contrata gerenciado.",
        "Suba a Evolution na VPS seguindo a documentação oficial (há imagem Docker pronta).",
        "No painel da Evolution, crie uma instância e copie a URL do servidor e a API key.",
        "Cole os dois aqui junto com o nome da instância e o número que receberá os avisos.",
        "Depois vá em Inteligência, WhatsApp e leia o QR Code com o celular para conectar o número.",
      ],
      custo:
        "O software é aberto e gratuito. O custo é a hospedagem: uma VPS a partir de cerca de R$ 25 por mês. Conecta por QR Code, não é a API oficial da Meta (não há custo por mensagem).",
      site: "https://doc.evolution-api.com",
      quandoNaoUsar: "Se você não quer manter servidor, deixe desligado: os mesmos avisos aparecem no sino dentro do app.",
    },
  },
  {
    id: "contaazul",
    nome: "Conta Azul — importar dados",
    ganho: "Traz clientes, produtos e contas em aberto do Conta Azul, sem redigitar cadastro.",
    categoria: "dados",
    ondeFicaGuardado: "vault",
    testavel: true,
    telaDedicada: "/settings/integrations/contaazul",
    campos: [
      { key: "client_id", label: "Client ID", tipo: "text", obrigatorioParaSalvar: true },
      { key: "client_secret", label: "Client Secret", tipo: "password", segredo: true, obrigatorioParaSalvar: true },
      { key: "refresh_token", label: "Refresh token", tipo: "password", segredo: true, obrigatorioParaSalvar: true, dica: "Vem da autorização OAuth do passo 3 do guia." },
    ],
    guia: {
      passos: [
        "Acesse developers.contaazul.com e faça login com a sua conta Conta Azul.",
        "Crie um aplicativo: você recebe um client_id e um client_secret.",
        "Ainda no portal, use a URL de autorização para autorizar o app com o login da SUA conta. O retorno traz um código.",
        "Troque esse código por um refresh_token (o portal mostra o passo a passo da troca).",
        "Cole os três valores aqui e clique em Testar conexão. Depois use Importar para trazer os cadastros.",
      ],
      custo:
        "A API está inclusa na assinatura Conta Azul (planos que liberam API). A importação pelo FinanceAI não cobra nada a mais.",
      site: "https://developers.contaazul.com",
    },
  },
  {
    id: "plugnotas",
    nome: "PlugNotas — NF-e e NFC-e",
    ganho: "Emite nota de produto (NF-e) e cupom (NFC-e) direto do PDV e dos pedidos.",
    categoria: "fiscal",
    ondeFicaGuardado: "tabela",
    testavel: true,
    telaDedicada: "/settings/integrations/plugnotas",
    campos: [
      { key: "api_key", label: "API key", tipo: "password", segredo: true, obrigatorioParaSalvar: true },
      AMBIENTE_CAMPO,
      { key: "serie_padrao", label: "Série padrão", tipo: "text", placeholder: "1" },
    ],
    guia: {
      passos: [
        "Crie a conta em plugnotas.com.br.",
        "Cadastre o CNPJ emissor no painel e suba o certificado digital A1 do CNPJ.",
        "No painel, copie a API key (há uma de homologação e uma de produção).",
        "Cole aqui, escolha o ambiente e clique em Testar conexão.",
        "Emita uma nota em homologação antes de virar para produção.",
      ],
      custo:
        "Cobrança por documento emitido, na casa de centavos por nota conforme o volume contratado. Exige certificado digital A1 do CNPJ (cerca de R$ 150 a R$ 250 por ano). Consulte plugnotas.com.br.",
      site: "https://plugnotas.com.br",
      quandoNaoUsar: "Se você só emite nota de SERVIÇO, use a NFS-e Nacional: a emissão é gratuita.",
    },
  },
  {
    id: "focus",
    nome: "Focus NFe — emissor alternativo",
    ganho: "Segunda via de emissão fiscal, útil como plano B ou quando a contabilidade já usa a Focus.",
    categoria: "fiscal",
    ondeFicaGuardado: "vault",
    testavel: true,
    telaDedicada: "/settings/integrations/focus",
    campos: [
      {
        key: "environment",
        label: "Ambiente",
        tipo: "select",
        opcoes: [
          { value: "homologacao", label: "Homologação (testes)" },
          { value: "producao", label: "Produção (vale fiscalmente)" },
        ],
      },
      { key: "token", label: "Token", tipo: "password", segredo: true, obrigatorioParaSalvar: true, dica: "A Focus usa tokens diferentes para homologação e produção." },
    ],
    guia: {
      passos: [
        "Crie a conta em focusnfe.com.br.",
        "Cadastre o CNPJ emissor e envie o certificado digital A1.",
        "No painel, abra a área de tokens: há um token de homologação e outro de produção.",
        "Copie o token do ambiente que você vai usar e cole aqui.",
        "Clique em Testar conexão para validar antes de emitir.",
      ],
      custo:
        "Mensalidade por CNPJ emissor, a partir de cerca de R$ 50 por mês, mais o certificado A1 (cerca de R$ 150 a R$ 250 por ano). Consulte focusnfe.com.br.",
      site: "https://focusnfe.com.br",
      quandoNaoUsar: "Ter dois emissores é redundância paga. Se o PlugNotas já atende, deixe este desligado.",
    },
  },
  {
    id: "nfse",
    nome: "NFS-e Nacional — nota de serviço",
    ganho: "Emite nota de serviço direto no ambiente nacional da Receita. A emissão em si não custa nada.",
    categoria: "fiscal",
    ondeFicaGuardado: "tabela",
    testavel: true,
    telaDedicada: "/settings/integrations/nfse",
    campos: [
      { key: "cert_pfx", label: "Certificado digital A1 (.pfx)", tipo: "file", accept: ".pfx,.p12", obrigatorioParaSalvar: true, dica: "O arquivo fica cifrado; ninguém além do servidor lê." },
      { key: "cert_password", label: "Senha do certificado", tipo: "password", segredo: true, obrigatorioParaSalvar: true },
      {
        key: "ambiente",
        label: "Ambiente",
        tipo: "select",
        opcoes: [
          { value: "homologacao", label: "Homologação (testes)" },
          { value: "producao", label: "Produção (vale fiscalmente)" },
        ],
      },
      { key: "inscricao_municipal", label: "Inscrição municipal", tipo: "text", dica: "Como consta no cadastro da prefeitura." },
    ],
    guia: {
      passos: [
        "Compre um certificado digital A1 do CNPJ numa Autoridade Certificadora (Serasa, Certisign, Soluti e outras). É um arquivo .pfx com senha.",
        "Confirme com a sua prefeitura se o município já emite pelo ambiente nacional da NFS-e.",
        "Tenha em mãos a inscrição municipal da empresa.",
        "Suba o arquivo .pfx aqui e informe a senha do certificado.",
        "Clique em Testar conexão: validamos o certificado e mostramos CNPJ e validade.",
      ],
      custo:
        "Apenas o certificado digital A1: cerca de R$ 150 a R$ 250 por ano. A emissão da nota pelo ambiente nacional é gratuita.",
      site: "https://www.gov.br/nfse",
      quandoNaoUsar: "Se o seu município ainda não aderiu ao ambiente nacional, use o emissor da prefeitura ou o PlugNotas.",
    },
  },
];

export const INTEGRACAO_POR_ID = Object.fromEntries(CATALOGO_INTEGRACOES.map((i) => [i.id, i]));

export const CATEGORIA_LABEL: Record<CategoriaIntegracao, string> = {
  banco: "Bancos e extrato",
  cobranca: "Cobrança",
  fiscal: "Notas fiscais",
  comunicacao: "Avisos",
  dados: "Migração de dados",
};

/** Ordem de apresentação: o que dá mais retorno primeiro. */
export const ORDEM_CATEGORIAS: CategoriaIntegracao[] = ["banco", "cobranca", "fiscal", "comunicacao", "dados"];

export function integracoesPorCategoria(): Array<{ categoria: CategoriaIntegracao; itens: Integracao[] }> {
  return ORDEM_CATEGORIAS.map((categoria) => ({
    categoria,
    itens: CATALOGO_INTEGRACOES.filter((i) => i.categoria === categoria),
  })).filter((g) => g.itens.length > 0);
}

/**
 * Valida o formulário de uma integração. Devolve os campos que faltam para o
 * "Salvar" fazer sentido — vazio significa pronto para salvar. Não bloqueia
 * nada: quem decide pular é o admin.
 */
export function camposFaltando(integracao: Integracao, valores: Record<string, string>): string[] {
  return integracao.campos
    .filter((c) => c.obrigatorioParaSalvar && !String(valores[c.key] ?? "").trim())
    .map((c) => c.label);
}

/** Uma integração está "configurada" quando o banco já tem credencial dela. */
export function progressoConfiguracao(configuradas: string[]): { feitas: number; total: number; pct: number } {
  const total = CATALOGO_INTEGRACOES.length;
  const feitas = CATALOGO_INTEGRACOES.filter((i) => configuradas.includes(i.id)).length;
  return { feitas, total, pct: total > 0 ? Math.round((feitas / total) * 100) : 0 };
}
