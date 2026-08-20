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

export type CampoTipo = "text" | "password" | "select" | "url" | "tel" | "file" | "textarea";

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
  /**
   * Mostra um botão que GERA o valor.
   *
   * Existe para credencial que nasce do nosso lado e é colada no provedor, não
   * o contrário: token de webhook e chave do worker. Sem isso o admin inventa
   * "123456" ou fica travado procurando no painel um valor que ninguém criou.
   */
  gerarChave?: boolean;
}

/**
 * Webhook que o provedor precisa chamar de volta.
 *
 * A URL é DESTA instalação e o admin não tem como adivinhá-la. Deixar isso
 * escrito só no passo a passo ("informe o endereço desta instalação seguido
 * de...") transfere para ele um trabalho que a tela pode fazer: mostrar o
 * endereço pronto, com botão copiar.
 */
export interface WebhookIntegracao {
  /** Slug da edge function que recebe o evento. */
  funcao: string;
  /** O que deixa de funcionar quando o webhook não é cadastrado. */
  seNaoConfigurar: string;
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
  /** Dá para testar sem pagar? Diga o que o teste alcança e o que não alcança. */
  trial?: string;
  /** O que o admin precisa ter em mãos ANTES de começar. */
  preRequisitos?: string[];
  /** Quanto tempo leva, para ele não começar no meio de outra coisa. */
  tempoEstimado?: string;
  /** Armadilhas que o provedor não avisa, na ordem em que costumam acontecer. */
  armadilhas?: string[];
  /** Link direto da documentação oficial, para conferir quando a tela mudar. */
  documentacao?: string;
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
  /** Quando o provedor precisa chamar de volta, a URL aparece pronta na tela. */
  webhook?: WebhookIntegracao;
  /**
   * Botão que leva o admin a criar a infraestrutura antes de preencher os
   * campos. Existe porque a dica do campo prometia "botão no assistente" e o
   * botão só existia na tela dedicada: quem estava no onboarding procurava um
   * botão que não estava ali.
   */
  provisionar?: { rotulo: string; url: string; explicacao: string };
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
      tempoEstimado: "10 minutos para as credenciais. A liberação dos bancos reais depende da Pluggy e leva dias.",
      preRequisitos: [
        "E-mail corporativo para o cadastro.",
        "Para bancos reais: CNPJ e uma conversa comercial com a Pluggy.",
      ],
      passos: [
        "Crie a conta em dashboard.pluggy.ai.",
        "No menu lateral, abra a aba Applications.",
        "Clique em criar uma aplicação e dê o nome da sua empresa.",
        "Assim que ela é criada, aparecem o CLIENT_ID e o CLIENT_SECRET. Copie os dois.",
        "Cole aqui embaixo e clique em Testar conexão.",
        "Depois de salvo, cada banco é conectado em Importar, aba Open Finance, pelo botão Conectar banco. Quem digita a senha é o usuário, dentro da janela da Pluggy.",
      ],
      armadilhas: [
        "Esta é a pegadinha que mais custa tempo: uma aplicação de DESENVOLVIMENTO só enxerga bancos simulados. Ao abrir a tela de escolher a instituição, a lista vem VAZIA, com um aviso de aplicação demo. Não é erro de configuração e não adianta procurar o banco.",
        "Para conectar Itaú, Bradesco, Nubank e os demais, é preciso uma aplicação de PRODUÇÃO, liberada pela Pluggy. Resolva isso antes de prometer a integração para o time.",
        "O consentimento de Open Finance tem prazo definido pelo Banco Central, normalmente 12 meses. Perto do vencimento é preciso renovar pelo mesmo caminho da primeira conexão, senão a sincronização para em silêncio.",
        "O histórico que vem na primeira conexão varia por banco: alguns entregam 3 meses, outros 12. Se vier pouco, importe o antigo por arquivo uma vez; os dois caminhos convivem e o sistema não duplica.",
      ],
      trial:
        "Dá para testar de graça e por tempo indeterminado com os conectores sandbox (o Pluggy Bank, usuário user-ok e senha password-ok): o fluxo inteiro funciona, com transações fictícias. O que o teste NÃO alcança é banco real, que exige a aplicação de produção.",
      custo:
        "Modelo de assinatura, cobrado por conexão ativa por mês. Para uma empresa com duas ou três contas o valor é baixo, mas peça a proposta: eles não publicam preço fechado no site.",
      site: "https://www.pluggy.ai",
      documentacao: "https://docs.pluggy.ai/docs/get-your-api-keys",
    },
  },
  {
    id: "asaas",
    nome: "Asaas — cobrança automática",
    ganho: "Emite boleto e Pix para o cliente e baixa o recebimento sozinho, sem você conferir extrato.",
    categoria: "cobranca",
    ondeFicaGuardado: "vault",
    testavel: true,
    telaDedicada: "/settings/integrations/asaas",
    webhook: {
      funcao: "company-asaas-webhook",
      seNaoConfigurar:
        "Sem o webhook cadastrado, o Asaas cobra normalmente mas nunca avisa que recebeu: o título continua em aberto aqui dentro e alguém precisa dar baixa na mão, conferindo extrato.",
    },
    campos: [
      AMBIENTE_CAMPO,
      { key: "api_key", label: "Chave de API", tipo: "password", segredo: true, obrigatorioParaSalvar: true, dica: "A chave do ambiente escolhido acima." },
      {
        key: "webhook_auth_token",
        label: "Token do webhook",
        tipo: "password",
        segredo: true,
        gerarChave: true,
        dica: "É o que prova que o aviso veio mesmo do Asaas. Gere aqui e cole no cadastro do webhook, no painel deles.",
      },
      { key: "notification_email", label: "E-mail para avisos (opcional)", tipo: "text", placeholder: "financeiro@suaempresa.com.br" },
    ],
    guia: {
      tempoEstimado: "5 minutos, contando a criação da conta.",
      preRequisitos: [
        "CNPJ ou CPF do titular da conta que vai receber.",
        "Nenhum documento é exigido para testar em sandbox.",
      ],
      passos: [
        "Para TESTAR sem valer dinheiro, crie a conta em sandbox.asaas.com. Para valer, crie em asaas.com. São contas separadas: a chave de uma não funciona na outra.",
        "Faça login e clique no seu nome ou foto, no canto superior direito.",
        "No menu, escolha Integrações.",
        "Clique em Gerar nova Chave de API e dê um nome que você reconheça depois, por exemplo FinanceAI.",
        "Copie a chave INTEIRA. Ela aparece uma única vez e não dá para recuperar depois; se perder, gere outra.",
        "Volte aqui, escolha o mesmo ambiente da conta onde você gerou (sandbox ou produção), cole a chave e clique em Testar conexão.",
        "Agora o webhook, que é o que faz o recebimento baixar sozinho. Aqui nesta tela, clique em Gerar no campo Token do webhook e copie o valor. Copie também a URL do webhook que aparece logo acima.",
        "No Asaas, vá em Integrações e depois em Webhooks, e clique em Adicionar webhook.",
        "Cole a URL no campo de URL e o token no campo de Token de autenticação. São dois campos diferentes: o token não vai dentro da URL.",
        "Marque os eventos de cobrança (criada, recebida, confirmada, vencida) e também os de estorno e chargeback, que são os que retiram a receita quando o dinheiro volta.",
        "Salve aqui também, para o token ficar guardado no cofre desta instalação. Sem o token dos dois lados, todo aviso do Asaas é recusado.",
      ],
      armadilhas: [
        "A chave de produção começa com $aact_prod_ e a de sandbox com $aact_hmlg_. Se o começo não bate com o ambiente escolhido acima, a conexão falha.",
        "A chave é longa e costuma quebrar em várias linhas na tela do Asaas: selecione tudo antes de copiar, um pedaço só não autentica.",
        "Uma conta aceita no máximo 10 chaves. Se estourar, apague as antigas antes de gerar outra.",
        "O token do webhook é diferente da chave de API. Confundir os dois faz o Asaas enviar o evento e nós recusarmos, com a cobrança aparecendo como paga lá e em aberto aqui.",
      ],
      trial:
        "O sandbox é gratuito e ilimitado, com dados fictícios: dá para emitir boleto e Pix de mentira e ver a baixa acontecer aqui dentro. A conta de produção também é gratuita para abrir e manter.",
      custo:
        "Sem mensalidade. Você paga por documento recebido: Pix e boleto na faixa de R$ 1,99, cartão por percentual. Confira em asaas.com/precos, porque muda.",
      site: "https://www.asaas.com",
      documentacao: "https://docs.asaas.com/docs/chaves-de-api",
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
    webhook: {
      funcao: "stripe-webhook",
      seNaoConfigurar:
        "Sem o webhook, o pagamento acontece no Stripe e não aparece aqui: nem a baixa do título, nem o repasse líquido com a taxa lançada como despesa.",
    },
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
      tempoEstimado: "10 minutos, sendo metade no cadastro do webhook.",
      preRequisitos: [
        "Conta Stripe criada (o cadastro de teste não pede documento).",
        "O endereço público desta instalação, para o webhook apontar para cá.",
      ],
      passos: [
        "Entre em dashboard.stripe.com. No topo, deixe o botão de modo de teste LIGADO para experimentar sem cobrar de verdade.",
        "Vá em Desenvolvedores e depois em Chaves de API.",
        "Na linha Chave secreta, clique em Revelar e copie o valor. Em teste ela começa com sk_test_; em produção, com sk_live_.",
        "Cole a chave secreta aqui embaixo e salve.",
        "Agora o webhook, que é o que faz o recebimento aparecer sozinho: no Stripe, vá em Desenvolvedores, Webhooks, e clique em Adicionar destino.",
        "No campo de URL, cole o endereço que aparece no bloco de webhook aqui desta tela, no botão copiar. Não precisa montar nada à mão.",
        "Selecione ao menos os eventos de pagamento concluído e de repasse (payout), que são os que alimentam a conciliação.",
        "Depois de criar, abra o endpoint e clique em Revelar no Signing secret. Ele começa com whsec_. Cole no campo de segredo do webhook aqui.",
      ],
      armadilhas: [
        "A chave publicável (pk_) não serve: ela é pública e não autentica. Tem que ser a secreta (sk_ ou rk_).",
        "Chave de teste não enxerga dado de produção e vice-versa. Se os pagamentos não aparecem, quase sempre é modo trocado.",
        "O signing secret do webhook é diferente da chave de API. Sem ele o Stripe até envia o evento, mas nós recusamos por não conseguir validar a assinatura.",
      ],
      trial:
        "O modo de teste é gratuito e permanente, com cartões fictícios para simular pagamento aprovado, recusado e estorno. Não é um trial que expira: é um ambiente paralelo que fica disponível para sempre.",
      custo:
        "Sem mensalidade. No Brasil, a taxa fica em torno de 3,99% mais R$ 0,39 por transação aprovada em cartão nacional. Confira em stripe.com/br/pricing.",
      site: "https://stripe.com/br",
      documentacao: "https://docs.stripe.com/keys",
    },
  },
  {
    id: "inter",
    nome: "Banco Inter — extrato e saldo",
    ganho: "Saldo e extrato oficiais do Inter direto na conciliação, sem intermediário e sem custo.",
    categoria: "banco",
    ondeFicaGuardado: "vault",
    testavel: true,
    telaDedicada: "/settings/integrations/inter",
    campos: [
      { key: "client_id", label: "Client ID", tipo: "text", obrigatorioParaSalvar: true },
      { key: "client_secret", label: "Client Secret", tipo: "password", segredo: true, obrigatorioParaSalvar: true },
      { key: "account_number", label: "Número da conta", tipo: "text", placeholder: "123456789" },
      AMBIENTE_CAMPO,
    ],
    guia: {
      tempoEstimado: "20 a 30 minutos, porque envolve confirmação por SMS e download de certificado.",
      preRequisitos: [
        "Conta PJ no Banco Inter, com acesso ao Internet Banking.",
        "Ser o titular ou ter procuração para criar integrações.",
        "Celular em mãos: a criação é confirmada por código SMS.",
      ],
      passos: [
        "Entre no Internet Banking PJ do Inter pelo computador e faça login lendo o QR Code com o app.",
        "No menu, vá em Soluções para sua empresa e clique em Nova Integração. Em alguns layouts o caminho é Conta digital, depois Aplicações, depois Nova aplicação.",
        "Dê um nome à aplicação, por exemplo FinanceAI.",
        "Selecione as CONTAS CORRENTES que a integração vai poder consultar.",
        "Marque as permissões. Para leitura de extrato e saldo, as de consulta bastam; só marque as de pagamento se você realmente for pagar por aqui.",
        "Confirme com o código que chega por SMS.",
        "Na lista de integrações, clique nos três pontinhos da sua aplicação e baixe o CERTIFICADO e a CHAVE. São dois arquivos, e é aqui que nascem também o Client ID e o Client Secret.",
        "Cole o Client ID e o Client Secret nos campos, e suba o certificado e a chave na tela dedicada do Inter.",
      ],
      armadilhas: [
        "O certificado do Inter vence em 1 ano. Quando vencer, a integração para de autenticar e é preciso gerar outra e baixar os arquivos de novo. Anote a data.",
        "A chave privada é um arquivo separado do certificado. Subir só o certificado não conecta.",
        "Depois de criar, é preciso ATIVAR as chaves na área de integrações, senão a API recusa mesmo com tudo preenchido.",
        "As permissões marcadas na criação não mudam depois: se faltou uma, o caminho é criar outra integração.",
      ],
      trial:
        "Não existe ambiente de teste aberto: a API do Inter trabalha direto na conta real. Por isso comece marcando apenas permissões de consulta, que não movimentam dinheiro.",
      custo:
        "A API Banking do Inter não tem tarifa própria para consulta de extrato e saldo em conta PJ. Operações que movimentam dinheiro seguem as tarifas normais da sua conta.",
      site: "https://developers.inter.co",
      documentacao: "https://developers.inter.co/docs/introducao/como-criar-uma-aplicacao",
      quandoNaoUsar:
        "Se a sua empresa não é cliente Inter. Para trazer extrato de outros bancos, use Open Finance, que cobre a maioria das instituições.",
    },
  },
  {
    id: "whatsapp",
    nome: "WhatsApp (Evolution API)",
    ganho: "Os agentes te avisam no WhatsApp: caixa baixo, contas vencendo, cliente na hora de recomprar.",
    categoria: "comunicacao",
    ondeFicaGuardado: "vault",
    testavel: true,
    telaDedicada: "/whatsapp",
    campos: [
      { key: "evolution_api_url", label: "URL do servidor Evolution", tipo: "url", placeholder: "https://api.seudominio.com.br", obrigatorioParaSalvar: true },
      { key: "evolution_api_key", label: "API key da Evolution", tipo: "password", segredo: true, obrigatorioParaSalvar: true },
      { key: "instance_name", label: "Nome da instância", tipo: "text", placeholder: "financeai", obrigatorioParaSalvar: true },
      { key: "notify_number", label: "Número que recebe os avisos", tipo: "tel", placeholder: "11999998888", dica: "Com DDD, só números. É para onde os agentes mandam." },
    ],
    guia: {
      tempoEstimado: "15 minutos, contando a contratação do servidor. 5 minutos se você já tem um.",
      preRequisitos: [
        "Um número de WhatsApp DA EMPRESA, não o pessoal de alguém.",
        "O celular com esse número em mãos, para ler o QR Code.",
        "Cartão para contratar o servidor, se você ainda não tiver um.",
      ],
      passos: [
        "Se a sua empresa já usa Evolution para outra automação, use o MESMO servidor: peça a quem cuida a URL e a chave global, e pule para o passo 5.",
        "Se ainda não tem, escolha um dos dois caminhos abaixo. Os dois entregam a Evolution pronta, com a URL e a chave no painel: você não instala nada nem mexe em linha de comando.",
        "CAMINHO 1, Hostinger: contrate uma VPS e, na escolha do sistema, selecione o modelo de aplicação Evolution API. A Hostinger provisiona já configurada. Terminado o provisionamento, o painel mostra o endereço do servidor e a chave de autenticação da Evolution.",
        "CAMINHO 2, Cloudfy: contrate um plano em cloudfy.host. Em poucos minutos as credenciais chegam no seu e-mail, com a Evolution já no ar e um subdomínio pronto. A URL e a chave global vêm nesse e-mail e ficam no painel.",
        "Com a URL e a chave em mãos, cole as duas nos campos aqui. A URL vai sem barra no final.",
        "Escolha o nome da instância. Pode deixar financeai. Ao salvar, o sistema cria a instância no seu servidor se ela ainda não existir, e reaproveita se já existir.",
        "Vá em Inteligência e depois WhatsApp para ler o QR Code. No celular da empresa: menu do WhatsApp, Aparelhos conectados, Conectar aparelho, e aponte para a tela.",
        "Confira que o status ficou conectado. Cada pessoa do time ainda ativa o canal no próprio Perfil para receber os avisos.",
      ],
      armadilhas: [
        "Use número da empresa. Se for o WhatsApp pessoal de um funcionário e ele sair, o canal de alerta vai embora junto.",
        "Se o celular ficar muito tempo sem internet, ou alguém desconectar os aparelhos no WhatsApp, a sessão CAI e o sistema para de enviar SEM AVISAR, porque quem avisaria era justamente o canal que caiu. Confira o status uma vez por mês.",
        "A chave é a GLOBAL do servidor, aquela que o painel do provedor mostra, e não a chave de uma instância específica. Com a chave de instância, criar e consultar instância falha.",
        "Endereço com barra no final costuma dar erro de rota: informe sem a barra.",
        "Se o nome da instância aqui for diferente do que existe no painel do provedor, o teste acusa que a instância não existe. Use exatamente o mesmo nome, ou deixe o sistema criar.",
      ],
      trial:
        "A Evolution API é open source e gratuita, sem trial nem licença. O que você paga é o servidor onde ela roda, e uma máquina pequena dá conta dos alertas.",
      custo:
        "Software gratuito. Na Hostinger, VPS a partir de cerca de R$ 30 por mês. Na Cloudfy, plano gerenciado a partir de valores parecidos, com a vantagem de já vir configurada. Não há custo por mensagem.",
      site: "https://www.hostinger.com/applications/evolution-api",
      documentacao: "https://www.cloudfy.host/br",
      quandoNaoUsar:
        "Se ninguém do time acompanha WhatsApp durante o expediente. Os alertas continuam aparecendo dentro do sistema, no sino e no topo do painel.",
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
      tempoEstimado: "15 minutos, incluindo a autorização OAuth.",
      preRequisitos: [
        "Conta Azul Pro ativa (a integração por API não funciona nos planos menores).",
        "Login de administrador da conta que será integrada.",
      ],
      passos: [
        "Acesse portaldevs.contaazul.com e crie a sua conta no Portal do Desenvolvedor. É um cadastro separado do seu login normal da Conta Azul.",
        "Já dentro do portal, clique em Criar uma aplicação.",
        "Escolha o tipo: Desenvolvimento para testar, Produção para valer. Comece por Desenvolvimento.",
        "Preencha o nome da aplicação e a URL de redirecionamento (redirect URI) que esta instalação usa. Ela precisa bater exatamente, incluindo https e barra final.",
        "Abra a página da aplicação criada: o Client ID e o Client Secret ficam ali.",
        "Cole os dois aqui e salve. Depois clique em autorizar para fazer o login da Conta Azul e conceder o acesso.",
      ],
      armadilhas: [
        "A URL de redirecionamento tem que ser idêntica à cadastrada. Um caractere diferente, inclusive a barra no fim, derruba a autorização com erro genérico.",
        "O access token expira e é renovado pelo refresh token. Se ninguém usar a integração por muito tempo, pode ser preciso autorizar de novo.",
        "As credenciais têm poder de agir em seu nome dentro da Conta Azul: trate como senha de alto risco.",
      ],
      trial:
        "O portal e a aplicação de Desenvolvimento são gratuitos e servem para validar o fluxo inteiro. O que custa é o plano Pro da Conta Azul, que é pré-requisito para a API funcionar na conta real.",
      custo:
        "A API não é cobrada à parte. O custo é a assinatura do plano Pro da Conta Azul, que você provavelmente já paga se usa o sistema.",
      site: "https://portaldevs.contaazul.com",
      documentacao: "https://developers.contaazul.com/guide",
      quandoNaoUsar:
        "Se a sua contabilidade não usa Conta Azul. O extrato bancário já entra por Open Finance ou arquivo, sem depender deste passo.",
    },
  },
  {
    id: "plugnotas",
    nome: "PlugNotas — NF-e e NFC-e",
    ganho: "Emite nota de produto (NF-e) e cupom (NFC-e) direto do PDV e dos pedidos.",
    categoria: "fiscal",
    ondeFicaGuardado: "vault",
    testavel: true,
    telaDedicada: "/settings/integrations/plugnotas",
    campos: [
      { key: "api_key", label: "API key", tipo: "password", segredo: true, obrigatorioParaSalvar: true },
      AMBIENTE_CAMPO,
      { key: "serie_padrao", label: "Série padrão", tipo: "text", placeholder: "1" },
    ],
    guia: {
      tempoEstimado: "15 minutos no sandbox. A homologação na prefeitura, quando exigida, leva dias.",
      preRequisitos: [
        "CNPJ da empresa emissora.",
        "Certificado digital A1 da empresa (arquivo .pfx e a senha), para emitir de verdade.",
        "Inscrição municipal ativa, se for emitir NFS-e.",
      ],
      passos: [
        "Para testar, crie a conta em app2.sandbox.plugnotas.com.br. Para produção, em app.plugnotas.com.br. São ambientes separados e a chave de um não vale no outro.",
        "Faça login e procure a área de integração ou API nas configurações da conta.",
        "Gere ou copie a API Key da empresa.",
        "Cole a chave aqui, escolha o ambiente correspondente e salve.",
        "Cadastre a empresa emissora com o certificado A1 na tela dedicada do PlugNotas, antes de tentar emitir.",
      ],
      armadilhas: [
        "Chave de sandbox não emite documento com valor fiscal, e chave de produção não funciona no sandbox. Se as emissões somem, confira o ambiente antes de qualquer outra coisa.",
        "Sem o certificado A1 cadastrado, a chave autentica mas a emissão falha. São dois passos diferentes.",
        "Para NFS-e, cada prefeitura tem regra própria. Confirme que o seu município é atendido antes de prometer emissão para o cliente.",
      ],
      trial:
        "O ambiente de sandbox é gratuito e serve para validar o fluxo inteiro de emissão com documentos sem valor fiscal. Produção exige contratação.",
      custo:
        "Cobrança por documento emitido, com pacotes por volume. Peça a proposta, porque o preço varia bastante conforme o tipo de nota e a quantidade.",
      site: "https://plugnotas.com.br",
      documentacao: "https://docs.plugnotas.com.br",
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
      tempoEstimado: "15 minutos para os tokens, mais o cadastro da empresa emissora.",
      preRequisitos: [
        "CNPJ da empresa.",
        "Certificado digital A1 para emitir em produção.",
      ],
      passos: [
        "Crie a conta e acesse o painel em app-v2.focusnfe.com.br.",
        "Cadastre a empresa emissora com os dados fiscais e o certificado digital.",
        "Ainda no painel, abra a área de tokens da empresa.",
        "Copie o token de HOMOLOGAÇÃO (emite nota de teste, sem valor fiscal) e o de PRODUÇÃO (emite de verdade). São dois valores diferentes.",
        "Cole cada um no campo correspondente aqui e escolha em qual ambiente você quer operar agora.",
      ],
      armadilhas: [
        "Os dois tokens parecem iguais à primeira vista. Trocá-los faz a nota de teste sair como válida, ou a real falhar sem motivo aparente. Confira o rótulo ao copiar.",
        "Cada empresa emissora tem os seus tokens. Se você emite por mais de um CNPJ, são pares diferentes.",
        "Emitir em produção sem certificado válido falha na SEFAZ, não aqui: a mensagem de erro vem do fisco e costuma ser críptica.",
      ],
      trial:
        "O ambiente de homologação é gratuito e ilimitado para testes, com notas sem valor fiscal. Dá para validar o fluxo inteiro antes de contratar.",
      custo:
        "Planos por volume de documentos, com faixa de entrada acessível para quem emite pouco. Confira em focusnfe.com.br/precos.",
      site: "https://focusnfe.com.br",
      documentacao: "https://focusnfe.com.br/doc/",
    },
  },
  {
    id: "nfse",
    nome: "NFS-e Nacional — nota de serviço",
    ganho: "Emite nota de serviço direto no ambiente nacional da Receita. A emissão em si não custa nada.",
    categoria: "fiscal",
    ondeFicaGuardado: "vault",
    testavel: true,
    telaDedicada: "/settings/integrations/nfse",
    provisionar: {
      rotulo: "Criar meu worker no Railway",
      // Deploy a partir do repositório. O link antigo abria só a página do
      // GitHub, e o texto prometia "1 clique": o admin caía num repositório e
      // não sabia o que fazer com ele.
      url: "https://railway.com/deploy?repo=https%3A%2F%2Fgithub.com%2FMindOpsTeam%2Fnfse-worker",
      explicacao:
        "Abre o Railway já apontado para o repositório do worker. Depois do deploy, volte aqui para gerar a chave e colar a URL.",
    },
    campos: [
      { key: "worker_url", label: "URL do seu servidor (worker)", tipo: "text", placeholder: "https://seu-worker.up.railway.app", obrigatorioParaSalvar: true, dica: "Depois do deploy, em Settings e Networking, clique em Generate Domain e cole aqui a URL, sem barra no final." },
      {
        key: "worker_api_key",
        label: "Chave do servidor",
        tipo: "password",
        segredo: true,
        gerarChave: true,
        obrigatorioParaSalvar: true,
        dica: "Clique em Gerar. Esta chave nasce aqui e você a cola no Railway: o worker recusa TODA chamada enquanto a variável NFSE_WORKER_API_KEY não existir lá.",
      },
      { key: "cert_pfx_base64", label: "Certificado digital A1 (.pfx)", tipo: "file", accept: ".pfx,.p12", segredo: true, obrigatorioParaSalvar: true, dica: "Mesma chave da integração de Certificado digital: é um certificado por empresa, não dois." },
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
      tempoEstimado: "Depende de você já ter o worker no ar. A configuração aqui leva 5 minutos.",
      preRequisitos: [
        "Certificado digital A1 da empresa (.pfx) e a senha dele.",
        "Inscrição municipal ativa.",
        "Se for pela via de servidor próprio: o worker de NFS-e publicado e acessível.",
      ],
      passos: [
        "Escolha a via: por provedor (PlugNotas ou Focus, que já cuidam da comunicação com a prefeitura) ou por servidor próprio, que é o worker desta solução. O resto destes passos é da via servidor próprio.",
        "Clique no botão Criar meu worker no Railway, aqui embaixo. Entre ou crie a conta e confirme o deploy a partir do repositório. O Railway constrói sozinho, leva poucos minutos.",
        "Adicione forma de pagamento no Railway (plano Hobby, cerca de US$ 5 por mês). É o custo do seu servidor, não desta solução.",
        "Aqui nesta tela, clique em Gerar no campo Chave do servidor. A chave é criada e copiada.",
        "No Railway, abra a aba Variables e clique em New Variable. Nome: NFSE_WORKER_API_KEY. Valor: a chave que você acabou de gerar. Salve, e o Railway reinicia o serviço sozinho.",
        "Ainda no Railway, vá em Settings e Networking e clique em Generate Domain. Copie a URL gerada e cole no campo URL do seu servidor, sem barra no final.",
        "Suba o certificado A1 (.pfx) e informe a senha. O certificado fica cifrado no cofre e nunca volta para o navegador.",
        "Clique em Testar conexão. Só depois de passar, faça uma emissão em homologação, e só então emita com valor fiscal.",
      ],
      armadilhas: [
        "O certificado A1 vence em 1 ano. Quando vencer, a emissão para. A tela mostra a data de validade: acompanhe.",
        "Cada prefeitura tem seu padrão de NFS-e. Confirme que o seu município é atendido pela via escolhida antes de prometer emissão.",
        "A senha do certificado é diferente da senha do e-CNPJ. Se errar, o erro aparece só na hora de assinar a nota.",
        "O worker sobe e responde ao teste de saúde do Railway MESMO sem a variável NFSE_WORKER_API_KEY, porque essa checagem é pública. Só que ele recusa toda chamada real: parece vivo e não serve para nada. Se pulou o passo da variável, é isso que está acontecendo.",
        "Depois de criar ou trocar a variável no Railway, espere o serviço reiniciar antes de testar. Testar durante o reinício dá erro de conexão que não tem nada a ver com a chave.",
      ],
      trial:
        "Sem custo de licença nesta via: o que existe é o custo do provedor escolhido, quando você usa provedor. O certificado A1 é uma compra anual à parte, na casa de 200 a 400 reais.",
      custo:
        "Via servidor próprio: só o custo do servidor. Via provedor: o preço por documento do PlugNotas ou da Focus.",
      quandoNaoUsar:
        "Se a sua empresa não emite nota de serviço. Para nota de produto, a via é NF-e pelos provedores fiscais.",
    },
  },
  {
    id: "gcp",
    nome: "Motor de previsão — Google Cloud (TimesFM)",
    ganho:
      "Troca a média do histórico pelo TimesFM, o modelo de séries temporais do Google: ele reconhece dezembro, décimo terceiro e imposto sazonal sem ninguém explicar.",
    categoria: "dados",
    ondeFicaGuardado: "vault",
    testavel: true,
    campos: [
      {
        key: "service_account",
        label: "Chave JSON da conta de serviço",
        tipo: "textarea",
        segredo: true,
        obrigatorioParaSalvar: true,
        placeholder: '{ "type": "service_account", "project_id": "...", ... }',
        dica: "Cole o conteúdo INTEIRO do arquivo .json que o Google baixou, não o nome dele.",
      },
      {
        key: "project_id",
        label: "Project ID (opcional)",
        tipo: "text",
        placeholder: "meu-projeto-123",
        dica: "Só preencha se for diferente do project_id que já está dentro do JSON.",
      },
    ],
    guia: {
      tempoEstimado: "10 minutos, sendo a maior parte esperando a API ativar.",
      preRequisitos: [
        "Conta Google com faturamento ativo no projeto (mesmo sem gastar nada, o Google exige cartão cadastrado).",
        "Permissão para criar contas de serviço no projeto.",
      ],
      passos: [
        "Abra console.cloud.google.com e crie um projeto, ou selecione um existente. O nome não importa para nós.",
        "Confirme que o projeto tem faturamento ativo, em Faturamento. Sem isso a chave é criada mas nenhuma consulta roda, e a mensagem do Google não deixa claro que é esse o motivo.",
        "Na busca do topo, procure BigQuery API e clique em Ativar. Leva de alguns segundos a um minuto.",
        "Vá em IAM e administrador, depois Contas de serviço, e clique em Criar conta de serviço. Dê um nome, por exemplo financeai-forecast.",
        "No passo de permissões, escolha exatamente o papel BigQuery Job User. Só ele.",
        "Abra a conta criada, aba Chaves, Adicionar chave, Criar nova chave, formato JSON. O arquivo baixa sozinho.",
        "Abra o arquivo num editor de texto, copie tudo e cole no campo abaixo. Clique em Testar conexão antes de salvar.",
      ],
      armadilhas: [
        "Não escolha Editor nem Proprietário no papel. BigQuery Job User permite executar a consulta e mais nada: se a chave vazar, quem pegou não lê nem apaga dado, e não consegue criar recurso que gere fatura.",
        "O campo quer o CONTEÚDO do JSON. Se o que você colou não começa com chave e a palavra type, copiou a coisa errada.",
        "Faturamento inativo é a causa mais comum de falha, e o erro que o Google devolve não diz isso com clareza.",
        "Trate o arquivo como senha: não mande por WhatsApp nem deixe em pasta compartilhada. Depois de colar aqui, pode apagar da sua máquina.",
      ],
      trial:
        "O Google dá crédito inicial para contas novas, e para o volume de uma PME as consultas de previsão cabem na franquia gratuita mensal do BigQuery. Na prática o custo tende a zero, mas o cadastro do cartão é obrigatório.",
      custo:
        "Cobrança por dado processado no BigQuery, com franquia gratuita mensal. Uma empresa com poucos anos de histórico fica dentro da franquia. Confira em cloud.google.com/bigquery/pricing.",
      site: "https://console.cloud.google.com",
      documentacao: "https://cloud.google.com/bigquery/docs/reference/standard-sql/bigqueryml-syntax-ai-forecast",
      quandoNaoUsar:
        "Se a empresa tem menos de 6 meses de histórico. Sem série o modelo não tem o que reconhecer, e a projeção estatística entrega o mesmo resultado sem trabalho nenhum.",
    },
  },
  {
    id: "certificado",
    nome: "Certificado digital A1 — assinatura das notas",
    ganho:
      "É o que assina a nota no padrão exigido pelo fisco. Sem ele nenhum emissor consegue autorizar documento fiscal, por mais que a integração esteja verde.",
    categoria: "fiscal",
    ondeFicaGuardado: "vault",
    testavel: true,
    telaDedicada: "/settings/integrations/nfse",
    campos: [
      {
        key: "cert_pfx_base64",
        label: "Arquivo do certificado (.pfx ou .p12)",
        tipo: "file",
        segredo: true,
        obrigatorioParaSalvar: true,
        accept: ".pfx,.p12",
        dica: "O arquivo que a certificadora entregou. Fica cifrado no cofre e nunca volta para o navegador.",
      },
      {
        key: "cert_password",
        label: "Senha do certificado",
        tipo: "password",
        segredo: true,
        obrigatorioParaSalvar: true,
        dica: "É a senha do arquivo, definida na emissão. Não é a senha do e-CNPJ nem a do gov.br.",
      },
    ],
    guia: {
      tempoEstimado:
        "A configuração aqui leva 3 minutos. Comprar e validar o certificado, se você ainda não tem, leva de 1 a 3 dias.",
      preRequisitos: [
        "CNPJ ativo da empresa emissora.",
        "Certificado A1 em arquivo (.pfx ou .p12) e a senha dele.",
        "Inscrição municipal, no caso de NFS-e.",
      ],
      passos: [
        "Se a empresa já tem certificado A1, pule para o passo 4: peça o arquivo .pfx e a senha a quem cuida da contabilidade.",
        "Se não tem, compre em qualquer Autoridade Certificadora credenciada pela ICP-Brasil (Serasa, Certisign, Soluti, Valid e outras). Peça e-CNPJ A1, que é o modelo em arquivo.",
        "Faça a validação exigida pela certificadora, que hoje costuma ser por videoconferência, e baixe o arquivo .pfx com a senha que você definir.",
        "Nesta tela, envie o arquivo .pfx e informe a senha.",
        "Confira que a tela passou a mostrar o CNPJ e a data de validade lidos do certificado: é a prova de que ele foi aberto com sucesso.",
        "Emita uma nota em homologação antes de emitir com valor fiscal.",
      ],
      armadilhas: [
        "A1 e A3 são coisas diferentes. O A3 fica num cartão ou token físico e NÃO funciona em servidor: para emitir automático, tem que ser A1, que é arquivo.",
        "A senha do certificado não é a senha do e-CNPJ nem a do gov.br. Errar aqui só aparece na hora de assinar a nota, com erro críptico vindo do fisco.",
        "O certificado vence em 1 ano e a emissão para no dia seguinte ao vencimento, sem aviso prévio. A tela mostra a data de validade: coloque um lembrete 30 dias antes.",
        "O CNPJ do certificado precisa ser o mesmo da empresa emissora. Certificado da matriz não assina nota da filial.",
      ],
      trial:
        "Não existe versão gratuita: certificado digital é documento pago e emitido por Autoridade Certificadora credenciada. O que dá para testar de graça é o ambiente de homologação dos emissores, que aceita nota sem valor fiscal.",
      custo:
        "e-CNPJ A1 custa em torno de R$ 200 a R$ 400 por ano, variando por certificadora. É uma compra anual, não uma mensalidade.",
      site: "https://www.gov.br/iti/pt-br/assuntos/icp-brasil",
      documentacao: "https://www.gov.br/iti/pt-br/assuntos/certificado-digital",
      quandoNaoUsar:
        "Se a empresa não emite nota própria, por exemplo quando a contabilidade emite por fora. Aí o certificado fica com quem emite.",
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
