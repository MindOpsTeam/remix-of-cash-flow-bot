# Revisão do onboarding e das configurações

**Data:** 2026-08-20
**Projeto:** FinanceAI (template) · `~/code/mindops/financeai-original` · Lovable `c5ba5dcd`

## Goal

Fechar os sete defeitos apontados na revisão do onboarding e da tela de configurações,
todos na mesma superfície: a hora em que o cliente liga as integrações. É o momento em
que ele decide se o produto é sério, e hoje ele encontra campo que não salva, botão que
não existe, guia que ensina o caminho errado e erro que não explica nada.

## Suposição declarada

O worker de NFS-e continua sendo hospedado no Railway (o repo `MindOpsTeam/nfse-worker`
já tem `railway.json`); Hostinger e Cloudfy passam a ser as **únicas** vias ensinadas para
a Evolution API, conforme instrução direta.

## O que eu verifiquei antes de planejar

Tudo abaixo foi lido no código ou consultado no banco, não inferido.

---

## Defeito 1 · Certificado digital A1 não salva nada

**Evidência:**
- `src/lib/integracoes-catalogo.ts:586` declara a integração `certificado` com
  `testavel: true` e dois campos obrigatórios (`cert_pfx_base64`, `cert_password`).
- `src/lib/integracoes-io.ts` — `salvarIntegracao()` **não tem `case "certificado"`**.
  Verificado por grep: cai no `default` → `{ ok: false, mensagem: "Integração desconhecida." }`.
- `testarIntegracao()` também não tem `certificado` no mapa de chamadas → devolve
  "Esta integração não tem teste automático", que é exatamente o texto vermelho da tela.

**O que acontece:** o admin escolhe o `.pfx`, digita a senha, clica em Salvar e o
certificado **não vai para lugar nenhum**. Ele segue o onboarding achando que configurou.
Na primeira emissão, a nota não assina.

**Correção:**
1. Em `integracoes-io.ts`, criar `case "certificado"` gravando em `nfse_config`
   (`cert_pfx_base64`, `cert_password`) por upsert em `company_id`, exatamente como o
   `case "nfse"` já faz.
2. Unificar as chaves de campo: hoje `nfse` usa `cert_pfx` e `certificado` usa
   `cert_pfx_base64` para a mesma coisa. Padronizar em `cert_pfx_base64` nos dois.
3. Registrar `certificado` no mapa de `testarIntegracao` apontando para a operação de
   leitura do certificado (ver Defeito 2), para o botão "Testar conexão" deixar de mentir.
4. Teste de contrato: **todo id do catálogo tem case no `salvarIntegracao`**. É o guarda
   que impede este defeito de voltar por outra integração.

**Arquivos:** `src/lib/integracoes-io.ts`, `src/lib/integracoes-catalogo.ts`,
`src/test/guias-integracao.test.tsx` (ou teste novo `integracoes-contrato.test.ts`).

---

## Defeito 2 · O teste da NFS-e passa sem testar nada

**Evidência:**
- `integracoes-io.ts` chama `nfse-operations` com `operation: "parse_cert"`.
- `supabase/functions/nfse-operations/index.ts:148` — o `switch (op)` aceita `status`,
  `validar_dps`, `cancelar`, `consultar_chave`, `parametros_municipio`, `codigos_servico`.
  **Não existe `parse_cert` e não existe `default`.**
- Sem `default`, `result` fica `undefined` e a função responde
  `{ success: true, data: undefined }` com HTTP 200.

**O que acontece:** o teste devolve "Conexão bem-sucedida" para uma operação que a função
não conhece. Falso verde é pior que erro: o admin encerra o assunto.

**Correção:**
1. Trocar a chamada de teste para `operation: "status"`, que já existe e devolve CNPJ,
   razão social e dias restantes do certificado.
2. Acrescentar `default:` no switch da edge, devolvendo 400 com
   `"Operação desconhecida: <op>"`. Função que aceita qualquer coisa em silêncio é a
   origem deste tipo de bug.
3. Na tela, mostrar o retorno útil: "Certificado de {CNPJ} válido até {data} ({n} dias)".

**Arquivos:** `src/lib/integracoes-io.ts`, `supabase/functions/nfse-operations/index.ts`.
**Deploy:** `nfse-operations` (gitsync não deploya edge function).

---

## Defeito 3 · Asaas sem webhook na guia de configuração

**Evidência:**
- `integracoes-catalogo.ts:135` — a integração `asaas` tem só três campos: ambiente,
  `api_key` e e-mail de aviso. **Não tem `webhook_auth_token` nem a URL do webhook.**
- A edge `company-asaas-webhook/index.ts:77` autentica cada evento comparando o header
  com `segredoDaIntegracao(..., "asaas", "webhook_auth_token")` — ou seja, **o Vault**.
- A tela dedicada `src/components/asaas/AsaasIntegrationBase.tsx:260` grava
  `webhook_auth_token` **direto na coluna** de `company_asaas_config`, não no Vault.

**O que acontece:** dois problemas somados. Pela central de configuração não há como
definir o token. Pela tela dedicada, o token vai para a coluna e o webhook procura no
cofre: **nenhum evento do Asaas é aceito**, e a baixa automática nunca acontece. O
sintoma é o pior possível: tudo verde e nada baixando.

**Correção:**
1. Acrescentar ao catálogo do Asaas:
   - campo `webhook_auth_token` (segredo, com botão **gerar chave** para o admin não
     inventar valor fraco);
   - bloco somente-leitura com a **URL do webhook** desta instalação, com botão copiar:
     `${VITE_SUPABASE_URL}/functions/v1/company-asaas-webhook`.
2. Em `integracoes-io.ts`, no `case "asaas"`, gravar o token via
   `gravarSegredo(companyId, "asaas", "webhook_auth_token", ...)`.
3. Corrigir `AsaasIntegrationBase.tsx` para gravar o token pelo mesmo caminho (Vault) e
   parar de escrever a coluna. Duas réguas para a mesma credencial é como uma delas
   fica desatualizada.
4. Acrescentar ao guia os passos de cadastro do webhook no painel do Asaas
   (Integrações → Webhooks → URL, token, eventos de cobrança).
5. Verificação: gravar token, simular um POST no webhook com o header certo e com o
   header errado; o certo processa, o errado devolve 401.

**Arquivos:** `src/lib/integracoes-catalogo.ts`, `src/lib/integracoes-io.ts`,
`src/components/asaas/AsaasIntegrationBase.tsx`.

---

## Defeito 4 · Stripe: webhook sem a URL, e "erro de edge function" que não explica nada

**Evidência:**
- O Stripe **tem** campo `webhook_secret` no catálogo (`integracoes-catalogo.ts:175`) e o
  guia manda "informe o endereço desta instalação seguido de /functions/v1/stripe-webhook".
  Mas a tela **não mostra o endereço**: o admin tem que descobrir sozinho qual é.
- O erro genérico: `integracoes-io.ts` faz `if (error) throw error` sobre o retorno de
  `supabase.functions.invoke`. Quando a edge responde 400 com `{ error: "..." }`, o
  supabase-js lança `FunctionsHttpError` e a mensagem que chega na tela é
  **"Edge Function returned a non-2xx status code"**. Confirmei por grep que **não existe**
  nenhum tratamento de `FunctionsHttpError` nem leitura de `error.context` no projeto.
- As RPCs do Stripe existem no banco (`set_stripe_credentials`, `get_stripe_credentials`,
  `resolver_canal_stripe_unico`) e `stripe-api` trata `action: "testar"` corretamente.
  Ou seja, **o erro real é informativo** ("Stripe não configurado: informe a chave
  secreta", "Canal sem chave secreta", "mais de um canal") e está sendo engolido.

**Correção:**
1. Criar `src/lib/edge-erro.ts` com `mensagemDaEdge(error)`: quando for
   `FunctionsHttpError`, ler `await error.context.json()` e devolver `error`/`detalhe` de
   dentro do corpo; senão, cair na mensagem original. Aplicar em **todo**
   `functions.invoke` de `integracoes-io.ts` (salvar, testar e o teste do WhatsApp).
   Isso conserta a mensagem de todas as integrações de uma vez, não só do Stripe.
2. Acrescentar ao catálogo do Stripe o bloco somente-leitura com a URL do webhook e
   botão copiar, igual ao do Asaas.
3. Teste unitário de `mensagemDaEdge` com um `FunctionsHttpError` simulado.

**Arquivos:** novo `src/lib/edge-erro.ts`, `src/lib/integracoes-io.ts`,
`src/lib/integracoes-catalogo.ts`, novo `src/test/edge-erro.test.ts`.

---

## Defeito 5 · Onboarding sem o botão de instalar o worker

**Evidência:**
- `integracoes-catalogo.ts:487` — a dica do campo `worker_url` diz literalmente
  "Crie o servidor no Railway em 1 clique (**botão no assistente**)".
- `grep -i "railway\|worker" src/components/OnboardingWizard.tsx` → **zero ocorrências**.
  O botão existe só em `src/pages/settings/NfseSetupWizard.tsx:268`.
- E lá o botão aponta para `WORKER_REPO_URL = "https://github.com/MindOpsTeam/nfse-worker"`,
  que é o **repositório**, não um deploy de 1 clique.

**Correção:**
1. Dentro do modal da integração `nfse`, incluir o botão de criar o worker, para ele
   existir onde a dica promete (onboarding e configurações usam o mesmo
   `ConfiguracaoIntegracao`, então uma mudança cobre as duas telas).
2. Trocar o destino: `https://railway.com/deploy?template=<repo>` (deploy a partir do
   repo) em vez do link do GitHub, e ajustar o texto para descrever o que realmente
   acontece, incluindo a criação manual da variável (Defeito 6).
3. Acrescentar link secundário para as vias alternativas que o repo já suporta
   (`DEPLOY-CLOUDRUN.md`, `netlify.toml`).

**Arquivos:** `src/components/integracoes/ConfiguracaoIntegracao.tsx`,
`src/lib/integracoes-catalogo.ts`, `src/pages/settings/NfseSetupWizard.tsx`.

---

## Defeito 6 · O worker sobe sem a variável que ele mesmo exige

**Evidência (lida no repo público):**
- `railway.json` do `MindOpsTeam/nfse-worker` declara build, healthcheck e restart.
  **Não declara variável nenhuma.**
- `.env.example` afirma: "Chave de autenticação entre o app e este worker.
  **O template do Railway gera automaticamente**". Não existe template publicado; o botão
  leva ao GitHub e o deploy vira "Deploy from repo", que não gera variável.
- `src/app.ts:22` do worker é **fail-closed**:
  `if (!API_KEY) { console.error("NFSE_WORKER_API_KEY not set — rejecting all requests") }`.

**O que acontece:** o worker sobe, o healthcheck passa (`/health` é público) e **toda**
chamada real é recusada. O admin vai em Variables copiar `NFSE_WORKER_API_KEY`, como a
dica manda, e a variável não está lá. O worker parece vivo e não serve para nada.

**Correção (a que fecha sem depender de publicar template no Railway):**
1. O **app gera a chave**: botão "Gerar chave" ao lado do campo `worker_api_key`,
   produzindo valor aleatório forte (`crypto.getRandomValues`), com botão copiar.
2. O passo passa a ser explícito e determinístico: "No Railway, aba Variables, clique em
   New Variable, nome `NFSE_WORKER_API_KEY`, e cole a chave que você gerou aqui."
   O valor nasce do nosso lado, vai para o cofre e é o mesmo dos dois lados por
   construção, em vez de depender de o Railway ter gerado algo.
3. Corrigir o `.env.example` do repo do worker, que hoje afirma algo falso.
4. Opcional, se você quiser o 1-clique de verdade depois: publicar um Railway Template
   com `NFSE_WORKER_API_KEY` marcada como gerada, e trocar o destino do botão. Fica
   registrado como passo seguinte, não como pré-requisito.
5. Verificação: subir o worker sem a variável e confirmar que o "Testar servidor" acusa
   401 com mensagem clara, em vez de silêncio.

**Arquivos:** `src/lib/integracoes-catalogo.ts`, `src/components/integracoes/ConfiguracaoIntegracao.tsx`,
`src/pages/settings/NfseSetupWizard.tsx`, e o repo `MindOpsTeam/nfse-worker` (`.env.example`, `README.md`).

---

## Defeito 7 · Guia da Evolution ensina o caminho errado

**Evidência:** `integracoes-catalogo.ts:303` (integração `whatsapp`) manda "suba a
Evolution API seguindo a documentação oficial. A via mais direta é Docker" e "defina a
variável AUTHENTICATION_API_KEY". Isso é caminho de quem administra servidor, não de dono
de PME, e não é o que você usa.

Além disso, o passo 5 promete: "**O sistema CRIA a instância sozinho**, você não precisa
criar nada no painel da Evolution". O `case "whatsapp"` de `integracoes-io.ts` faz apenas
`upsert` em `whatsapp_configs` e grava o segredo: **não chama `instance/create`**. O guia
promete uma coisa e o código faz outra.

**Correção:** reescrever o guia com duas vias, e só elas:

- **Hostinger VPS** — a Evolution API é oferecida como template de aplicação com
  implantação em um clique, pré-configurada, sem instalação manual.
- **Cloudfy** — infra gerenciada com n8n e Evolution já integrados; depois de contratar,
  as credenciais chegam por e-mail em poucos minutos, já funcionando, e o painel reúne os
  números num lugar só.

Os passos passam a terminar em: pegar a **URL** e a **chave global** que o provedor
entrega, colar aqui, salvar, e ler o QR Code em Inteligência → WhatsApp. E o passo 5 é
corrigido para dizer a verdade sobre quem cria a instância (ver Defeito 8, que decide
isso).

**Arquivos:** `src/lib/integracoes-catalogo.ts`.

---

## Defeito 8 · Evolution "dando pau" com tudo certo

Aqui há mais de uma causa possível e a mensagem atual não deixa ver qual é. O primeiro
passo é instrumentar, não adivinhar.

**O que já sei:**
1. **A mensagem some.** O teste do WhatsApp usa `functions.invoke` e faz `throw fnErr`.
   O proxy responde 403 (`Caminho não permitido`), 404 (`Config não encontrada`), 409
   (`EVOLUTION_NOT_CONFIGURED`) ou repassa o status da Evolution — e **todos** chegam na
   tela como "Edge Function returned a non-2xx status code". O Defeito 4 já conserta isso
   e provavelmente revela a causa real em um minuto.
2. **Testa o canal errado.** `testarWhatsapp()` em `integracoes-io.ts:270` busca
   `order("created_at").limit(1)`: com mais de um canal, ele testa o **mais antigo**, não
   o que você acabou de salvar. Confirmado que a tabela aceita N canais por empresa
   (índice único em `company_id, instance_name`).
3. **A instância pode não existir na Evolution.** Como o salvar não chama
   `instance/create`, `connectionState/{nome}` devolve 404 quando a instância foi criada
   com outro nome no painel do provedor.
4. **Contradição na tela do WhatsApp.** `src/pages/WhatsAppAgent.tsx:115` afirma em
   comentário que "a evolution_api_key NUNCA desce ao browser: toda operação passa pelo
   evolution-proxy". A reconexão (`handleReconnect`, linha 456) de fato usa o proxy, mas o
   fluxo de criação (linhas 194, 205, 263, 303) chama a Evolution **direto do navegador**
   com a chave digitada, o que depende de CORS liberado no servidor do provedor — coisa
   que Hostinger e Cloudfy não liberam para origem arbitrária. E `saveConfig` (linha 233)
   ainda grava `evolution_api_key` na coluna, contrariando o desenho do Vault.

**Correção, em ordem:**
1. Aplicar o Defeito 4 e repetir o teste: a mensagem real aparece.
2. `testarWhatsapp` passa a receber o `instance_name` que está no formulário, em vez de
   pegar o primeiro canal. Testar canal diferente do que a pessoa está olhando é enganoso.
3. Decidir e implementar **uma** verdade sobre criação de instância:
   criar de fato no salvar (chamando `instance/create` pelo proxy, tolerando "já existe"),
   e então o guia pode prometer isso. É o caminho melhor para o dono de PME.
4. Migrar as chamadas restantes de `WhatsAppAgent.tsx` para o `evolution-proxy`, eliminando
   o fetch direto do browser e o CORS junto. Remover a escrita de `evolution_api_key` na
   coluna em `saveConfig`.
5. Mensagem de erro específica para o 409 `EVOLUTION_NOT_CONFIGURED` e para o 404 de
   instância inexistente, dizendo o que fazer em cada caso.

**Arquivos:** `src/lib/integracoes-io.ts`, `src/pages/WhatsAppAgent.tsx`,
`supabase/functions/evolution-proxy/index.ts` (liberar `instance/create` já está na
whitelist), `src/lib/integracoes-catalogo.ts`.

---

## Ordem de execução

1. `edge-erro.ts` + aplicação em `integracoes-io.ts` — destrava o diagnóstico de tudo.
2. Certificado A1 (salvar + testar) e `default` no `nfse-operations`.
3. Asaas: webhook no catálogo, no Vault e na tela dedicada.
4. Stripe e Asaas: URL do webhook visível com botão copiar.
5. Worker: geração da chave no app, botão no modal, texto corrigido, `.env.example` do repo.
6. Evolution: guia reescrito (Hostinger e Cloudfy), teste do canal certo, criação de
   instância, migração para o proxy.
7. Teste de contrato catálogo × io × detecção.

## Validação

- `npm run typecheck`, `npx vitest run`, `npm run check:edge` (os três já existem).
- Testes novos: contrato do catálogo (todo id salva, todo id testável tem chamada),
  `mensagemDaEdge`, geração da chave do worker.
- Verificação manual contra o banco do template, no padrão que já usamos: gravar
  `webhook_auth_token` e provar que o webhook aceita o header certo e recusa o errado.
- Deploy das edges tocadas: `nfse-operations`, `company-asaas-webhook`, `evolution-proxy`.

## Riscos e pontos em aberto

- **Alterar `AsaasIntegrationBase.tsx`** mexe numa tela usada também pela via PJ. Manter a
  leitura da coluna antiga por um ciclo, para quem já salvou o token lá não perder o valor.
- **Criar instância no salvar** faz uma chamada externa dentro do fluxo de configuração:
  precisa falhar de forma tolerante, salvando a config mesmo se a Evolution estiver fora.
- **Railway Template de 1 clique** depende de publicar na conta do Railway. O plano não
  bloqueia nisso: a geração de chave pelo app fecha o problema sozinha.
- A causa exata do erro da Evolution só fica confirmada depois do passo 1. O plano trata
  as quatro hipóteses, mas a ordem evita corrigir o que não está quebrado.

## Fontes consultadas

- [Evolution API na Hostinger (template de VPS 1 clique)](https://www.hostinger.com/applications/evolution-api)
- [Cloudfy — infra com Evolution pré-configurada](https://www.cloudfy.host/br)
- [Instalação da Evolution API — documentação oficial](https://docs.evolutionfoundation.com.br/evolution-api/installation)
- [Repo do worker de NFS-e](https://github.com/MindOpsTeam/nfse-worker)
