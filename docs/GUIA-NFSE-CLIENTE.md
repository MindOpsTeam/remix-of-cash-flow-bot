# Guia completo: como emitir NFS-e pelo seu ERP

Bem-vindo. Este guia foi escrito para o dono do negócio, não para um técnico. A ideia é te levar pela mão, do começo ao fim, para você conseguir emitir suas notas de serviço (NFS-e) direto pelo sistema, sem depender de ninguém.

Você não precisa entender de tecnologia. Precisa só seguir os passos na ordem, com calma. No total, se você já tiver o certificado digital em mãos, a configuração leva mais ou menos 10 minutos.

Antes de começar, uma explicação rápida do que vai acontecer, em português claro:

Para emitir uma nota fiscal de verdade, a Receita exige que a nota seja "assinada" digitalmente pela sua empresa (com o certificado digital) e enviada para o sistema oficial do governo (o Ambiente Nacional da NFS-e, que a gente chama de SEFIN). Para fazer isso de um jeito seguro, o seu sistema usa um pequeno servidor só seu, hospedado num serviço chamado Railway. Esse servidor (a gente chama de "worker") é como se fosse um "porteiro particular" da sua empresa: o certificado fica guardado dentro dele, no seu ambiente, e nunca vai parar na mão de terceiros. Você cria esse servidor uma vez só, e depois é só usar.

Parece complicado escrito assim, mas na prática são cliques em telas prontas. Vamos juntos.

---

## 1. O que você vai precisar

Para deixar tudo funcionando, você vai precisar de três coisas: um certificado digital A1 do tipo e-CNPJ (a identidade digital da sua empresa), uma conta no Railway (o serviço que vai hospedar o seu servidor, com um cartão cadastrado para pagar cerca de US$ 5 por mês) e uns 10 minutos de atenção. O item que costuma dar mais trabalho é o certificado, então dedicamos a próxima seção inteira a ele.

Checklist do que ter em mãos antes de começar:

- [ ] Certificado digital **A1 (e-CNPJ)** no formato de arquivo (`.pfx` ou `.p12`)
- [ ] A **senha** desse certificado (definida na hora da emissão)
- [ ] Um **cartão de crédito** para cadastrar no Railway (custo aproximado de US$ 5 por mês)
- [ ] Um **e-mail** (ou conta do GitHub) para criar a conta no Railway
- [ ] O **código do município IBGE** da cidade da sua empresa (7 dígitos, a gente explica onde achar)
- [ ] Sua **inscrição municipal**, se a sua prefeitura te deu uma
- [ ] Cerca de **10 minutos** com calma

Se faltar o certificado, comece pela seção 2. Se você já tem o certificado em arquivo e a senha, pode pular direto para a seção 3.

---

## 2. Certificado Digital A1 (e-CNPJ)

Esta é a parte mais importante do guia. Leia com atenção, porque é aqui que a maioria das pessoas trava.

### O que é e por que você precisa

O certificado digital é, na prática, a **identidade digital da sua empresa**. Ele serve para "assinar" a nota fiscal, provando para a Receita que foi realmente a sua empresa que emitiu aquela nota, e não outra pessoa. Sem certificado, não existe nota fiscal eletrônica. É uma exigência do governo, não do sistema.

Pense nele como a assinatura e o carimbo da empresa, só que em forma digital e impossível de falsificar.

### A1 ou A3? Use sempre o A1

Existem dois tipos de certificado, e a diferença importa para você:

- **A1**: é um **arquivo** que fica no computador (ou, no nosso caso, no seu servidor). Tem extensão `.pfx` ou `.p12`. Vale por 1 ano. É o que a gente usa, porque não depende de nenhum aparelho físico.
- **A3**: fica dentro de um **token USB** (aquele pen drive) ou de um **cartão com leitora**. Precisa do aparelho plugado na hora de emitir. Não serve para o nosso caso, porque o servidor não tem como "plugar" um token.

**Regra simples: compre o A1.** Se o vendedor te oferecer A3, recuse e peça o A1.

### e-CNPJ ou e-CPF? Use sempre o e-CNPJ

- **e-CNPJ**: é o certificado no **CNPJ da empresa**. É o que você precisa.
- **e-CPF**: é no seu CPF, de pessoa física. Não serve para emitir nota da empresa.

**Regra simples: compre o e-CNPJ, no CNPJ da empresa que vai emitir as notas** (a prestadora do serviço). O CNPJ do certificado precisa ser exatamente o mesmo CNPJ que aparece nas suas notas.

### Onde comprar e quanto custa

O certificado é vendido por empresas autorizadas pelo governo, chamadas de Autoridades Certificadoras (fazem parte do sistema oficial ICP-Brasil). As mais conhecidas são:

- Serpro
- Certisign
- Serasa
- Valid
- Soluti

Todas são confiáveis. Você pode comparar preço entre elas. O preço do A1 e-CNPJ geralmente fica na faixa de **R$ 150 a R$ 300 por ano** (valores aproximados, variam por promoção e certificadora).

A compra costuma envolver uma etapa de **validação de identidade** (por vídeo ou presencial), para confirmar que você é o responsável pela empresa. Isso é normal e faz parte da segurança.

**Importante sobre validade:** o A1 vale por **1 ano**. Depois disso ele vence e para de funcionar. Todo ano você vai precisar renovar (comprar de novo) e subir o arquivo novo no sistema. Anote na agenda a data de vencimento, porque uma nota não sai com certificado vencido.

### Como obter o arquivo `.pfx` (ou `.p12`) e a senha

Na hora de emitir e instalar o certificado A1, a certificadora normalmente gera o arquivo e pede que você **defina uma senha**. Guarde esse arquivo e essa senha com muito cuidado, porque você vai usar os dois na configuração.

O caminho mais fácil é, na hora da emissão, salvar o arquivo `.pfx` (ou `.p12`) já no seu computador. Se a certificadora te deu essa opção, ótimo, é só guardar bem.

Às vezes, porém, o certificado é instalado direto no navegador ou no Windows, sem te entregar o arquivo separado. Nesse caso, você precisa **exportar** o certificado para um arquivo `.pfx`. Veja como, de forma geral:

**No Windows:**

1. Abra o menu Iniciar e digite `certmgr.msc` (gerenciador de certificados) e abra.
2. Vá em **Pessoal > Certificados** e localize o certificado da sua empresa (aparece o CNPJ ou a razão social).
3. Clique com o botão direito nele, escolha **Todas as tarefas > Exportar**.
4. No assistente, escolha **"Sim, exportar a chave privada"** (isso é essencial, sem a chave privada o arquivo não serve).
5. Mantenha o formato **PFX / PKCS #12**.
6. Defina uma **senha** para o arquivo (anote essa senha, é ela que você vai usar depois).
7. Escolha onde salvar e finalize. Você terá um arquivo `.pfx`.

**No Mac:**

1. Abra o aplicativo **Acesso às Chaves** (Keychain Access).
2. Localize o certificado da sua empresa.
3. Clique com o botão direito e escolha **Exportar**.
4. Salve no formato **`.p12`** e defina uma **senha** (anote).

Se você não conseguir exportar, o mais simples é pedir para a sua certificadora reemitir o A1 e te entregar o arquivo `.pfx` diretamente. É um pedido comum, elas sabem fazer.

### Avisos de segurança sobre o certificado

- Guarde o arquivo `.pfx` e a senha em local seguro. Quem tem os dois pode assinar notas no nome da sua empresa.
- Nunca mande o certificado por grupos de WhatsApp ou e-mails abertos.
- Lembre que o certificado **vence em 1 ano**. Renove antes de vencer.
- O CNPJ do certificado tem que ser o **mesmo** da empresa que emite as notas.

---

## 3. Criar o seu servidor (worker) no Railway

Agora vamos criar o servidorzinho que vai assinar e enviar as suas notas. É um processo de clicar em botões. Vá com calma e siga na ordem.

### 3.1. Abrir o Railway a partir do app

No seu sistema, vá em **Configurações > Integrações > NFS-e**. Lá tem um assistente (um passo a passo na tela). Clique no botão **"Criar meu worker"**. Isso vai abrir o Railway em uma nova aba do navegador, já com tudo preparado.

### 3.2. Criar a conta ou entrar

Se for a sua primeira vez no Railway, ele vai pedir para você criar uma conta. Você pode:

- Entrar com a sua **conta do GitHub** (se tiver), ou
- Entrar com **e-mail e senha**.

Qualquer uma das opções funciona. Escolha a que for mais fácil para você e confirme o e-mail se ele pedir.

### 3.3. Cadastrar a forma de pagamento

O Railway vai pedir um **cartão de crédito**. Vamos ser transparentes sobre isso:

- O plano usado (chamado **Hobby**) custa cerca de **US$ 5 por mês**, cobrado pelo próprio Railway no seu cartão.
- Esse valor é o custo de **ter o seu próprio servidor** rodando o tempo todo. Não é uma cobrança nossa.
- A boa notícia: **a emissão das notas é ilimitada e sem custo por nota**. Você paga o servidor, não paga por nota emitida. Emita 10 ou 10 mil notas no mês, o custo do servidor é o mesmo.

Comparando: em serviços que cobram "por nota", quanto mais você emite, mais paga. Aqui você tem um custo fixo baixo e previsível, e o certificado fica no seu ambiente.

### 3.4. O deploy acontece sozinho

Depois de criar a conta e cadastrar o pagamento, o Railway vai **montar o seu servidor automaticamente**. Esse processo se chama "deploy". Pode levar de um a alguns minutos. Você vai ver uma tela com um andamento (barras, textos, logs). Espere ficar pronto (geralmente aparece algo como "Success", "Deployed" ou uma marcação verde).

Nesse processo, a **chave do worker** (um item técnico chamado `NFSE_WORKER_API_KEY`) é gerada sozinha. Você não precisa inventar nada. Ela é só uma senha interna entre o seu app e o seu servidor, para eles conversarem com segurança. Mais adiante você vai só copiar essa chave, sem precisar entender o que ela faz por dentro.

### 3.5. Gerar o endereço público do servidor (a URL)

O servidor precisa de um endereço na internet para o app conseguir falar com ele. Vamos gerar esse endereço:

1. Dentro do Railway, abra o seu serviço (o worker que acabou de subir).
2. Vá na aba **Settings** (Configurações).
3. Procure a seção **Networking** (Rede).
4. Clique em **Generate Domain** (Gerar Domínio).
5. O Railway vai criar um endereço parecido com `https://xxxxx.up.railway.app`.
6. **Copie essa URL inteira.** Você vai colar ela no app daqui a pouco.

Dica: guarde essa URL em algum lugar (um bloco de notas), você vai usar já já.

### 3.6. Copiar a chave do worker

Agora vamos pegar a chave que o Railway gerou:

1. Ainda dentro do seu serviço no Railway, abra a aba **Variables** (Variáveis).
2. Procure a variável chamada **`NFSE_WORKER_API_KEY`**.
3. Copie o valor dela (é um texto grande e embaralhado, isso é normal).

Pronto. Agora você tem as duas coisas que o app precisa: a **URL** e a **chave**.

---

## 4. Conectar o servidor no app

Volte para o seu sistema, na tela **Configurações > NFS-e**. No assistente, escolha a opção **"Servidor próprio"** (é a opção que usa o worker que você acabou de criar).

1. No campo de endereço (URL), **cole a URL** que você copiou do Railway (aquele `https://xxxxx.up.railway.app`).
2. No campo da chave, **cole a chave** (`NFSE_WORKER_API_KEY`) que você copiou.
3. Clique em **"Testar servidor"**.

O resultado precisa ficar **verde** (indicando "conectado" ou "ok"). Se ficar verde, ótimo, o app já está conversando com o seu servidor. Pode seguir.

Se der erro (vermelho), calma, é comum e tem solução. Pule para a seção 8 (Solução de problemas), item do "Testar servidor".

---

## 5. Subir o seu certificado

Com o servidor conectado, agora você entrega o certificado ao seu próprio servidor. Lembre: o certificado fica **no seu ambiente**, não é enviado para terceiros.

Ainda na tela de NFS-e:

1. Clique para fazer o **upload do arquivo** e selecione o seu `.pfx` (ou `.p12`).
2. Digite a **senha do certificado** (a que você definiu na emissão ou na exportação).
3. Clique em **"Testar certificado"**.

Se estiver tudo certo, a tela vai mostrar os dados lidos do certificado: **CNPJ**, **razão social** (o nome da empresa) e **validade** (a data em que ele vence). Confira se o CNPJ e o nome são mesmo da sua empresa e se a validade ainda está no futuro.

Se der erro de senha ou de CNPJ, veja a seção 8.

---

## 6. Preencher os dados fiscais

Agora alguns dados da sua empresa e da emissão. Não se assuste com os nomes, a gente explica cada um:

- **Série da DPS**: é um número que identifica a "sequência" das suas notas. Se você não tiver uma orientação específica da contabilidade, pode começar com **1**. É um campo numérico simples.
- **Código do município IBGE**: é um número de **7 dígitos** que identifica a cidade da sua empresa. Toda cidade do Brasil tem um. Você acha pesquisando "código IBGE" mais o nome da sua cidade, ou perguntando à sua contabilidade. Use o código do município onde a **empresa está estabelecida** (a prestadora).
- **Inscrição municipal**: é o número de cadastro da sua empresa na prefeitura. Se a sua prefeitura te deu uma, preencha. Se você não tem, pode deixar em branco (muitos casos funcionam sem, mas confirme com a contabilidade se a sua cidade exige).
- **Ambiente**: aqui você escolhe entre **Homologação** e **Produção**. **Comece sempre em Homologação.** Homologação é o "ambiente de teste" da Receita, serve para você provar que está tudo funcionando sem gerar nota de verdade. Depois a gente troca para Produção.

Salve os dados fiscais e siga.

---

## 7. Emitir uma nota de teste (e depois ir para valer)

Antes de emitir nota de verdade, vamos fazer um teste. Isso te dá segurança de que tudo está certo.

### 7.1. Nota de teste em Homologação

Com o ambiente em **Homologação**, emita uma nota de teste pelo sistema (preencha um serviço qualquer, um valor qualquer maior que zero). Essa nota **não vale como documento fiscal**, ela é só um teste da Receita. Ninguém vai ser cobrado, nada é oficial.

Se a emissão der certo, o sistema vai te mostrar uma **chave de acesso** gerada (um código longo que identifica a nota). Ver essa chave é o sinal de que o caminho inteiro funcionou: o app falou com o seu servidor, o servidor assinou com o seu certificado e enviou para o SEFIN, e o SEFIN aceitou.

Se a nota for **rejeitada**, não se preocupe, isso também ensina. Leia a mensagem de erro e veja a seção 8 (as causas mais comuns são simples de corrigir).

### 7.2. Trocar para Produção

Deu certo o teste? Então volte nos dados fiscais e troque o **ambiente para Produção**. A partir de agora, as notas que você emitir são **reais e oficiais**. Emita a sua primeira nota de verdade com calma, confira os dados do cliente e do serviço, e pronto: você está emitindo NFS-e sozinho.

---

## 8. Solução de problemas (o que fazer quando dá erro)

Erros acontecem e quase todos têm solução simples. Aqui estão os mais comuns:

| Problema | O que provavelmente é | O que fazer |
|---|---|---|
| **"Testar servidor" falha** (fica vermelho) | URL errada, ou o servidor ainda não terminou de subir, ou o pagamento do Railway não está ativo | Confira se a URL está exatamente igual à do Railway, **sem barra no final**. Volte ao Railway e veja se o deploy terminou (marcação verde/"Deployed"). Confirme que o cartão/plano do Railway está ativo. |
| **"Senha do certificado incorreta"** | A senha digitada não bate com a do arquivo | Digite de novo com atenção (cuidado com maiúsculas e espaços). Se não lembrar, reexporte o `.pfx` definindo uma senha nova, ou peça a reemissão à certificadora. |
| **"CNPJ do certificado difere do prestador"** | O certificado é de um CNPJ diferente do da empresa que emite | Use um certificado **e-CNPJ do mesmo CNPJ** da empresa prestadora. e-CPF ou CNPJ de outra filial não servem. |
| **"Certificado expirado"** | O A1 venceu (validade de 1 ano) | Compre/renove o A1, exporte o novo `.pfx` e suba de novo no app (seção 5). |
| **Nota rejeitada pelo SEFIN** | Algum dado da nota não passou na validação da Receita | Leia o **código e a mensagem** de rejeição. Causas comuns: código de serviço (tributação nacional) errado, competência (mês/data) inválida, ou valor zerado. Corrija o campo apontado e emita de novo. |
| **Emissão demora ou dá "timeout"** | O sistema da Receita (SEFIN) pode estar lento ou instável | Espere um pouco e **tente de novo**. Costuma ser temporário, do lado do governo, não seu. |

Dica geral: quando aparecer uma mensagem de erro, **leia com calma o texto dela**. Quase sempre ela diz exatamente qual campo está errado. Se ficar em dúvida sobre um dado fiscal (código de serviço, competência), a sua contabilidade resolve rápido.

---

## 9. Manutenção (o que fazer de tempos em tempos)

O bom dessa configuração é que ela quase não dá trabalho depois de pronta. Só fique atento a duas coisas:

- **Renovar o certificado todo ano.** O A1 vence em 1 ano. Quando renovar, exporte o novo `.pfx` e suba no app (seção 5), digitando a nova senha e clicando em "Testar certificado". Sem isso, as notas param de sair quando o antigo vence.
- **Manter o Railway pago.** É aquele custo fixo de cerca de US$ 5/mês. Se o cartão vencer ou falhar, o servidor pode parar. Mantenha um cartão válido cadastrado.

O **worker em si não precisa de manutenção**. Ele é "stateless", ou seja, não guarda estado nem acumula lixo: fica lá, quietinho, pronto para assinar e enviar suas notas sempre que você emitir. Você não precisa mexer nele no dia a dia.

---

## 10. Perguntas frequentes (FAQ)

**Preciso mesmo pagar o Railway?**
Sim, porque o servidor é seu. É esse custo fixo (cerca de US$ 5/mês) que garante que o certificado fica no seu ambiente e que a emissão é ilimitada, sem cobrança por nota. Existe uma alternativa (usar um provedor de nota que cobra por nota emitida), mas aí você paga a cada nota e o volume encarece. Para a maioria dos negócios, o servidor próprio sai mais barato e mais seguro.

**Meus dados e o certificado ficam seguros?**
Sim. O certificado fica **no seu servidor** (que é seu, no Railway) e nos seus registros, não na mão de terceiros. A "chave do worker" é só uma senha interna entre o app e o seu servidor. Ninguém de fora tem acesso ao seu certificado.

**Posso cancelar uma nota?**
Em geral sim, dentro das regras e prazos da Receita/prefeitura. O cancelamento é feito pelo próprio sistema (procure a opção de cancelar na nota emitida) e também passa pelo seu certificado, do mesmo jeito que a emissão. Fique atento ao prazo permitido, que varia.

**Homologação vale como nota fiscal?**
Não. Homologação é só o **ambiente de teste** da Receita. Nota emitida em Homologação não tem valor fiscal, não serve para o cliente e não gera imposto. Ela existe só para você conferir que tudo funciona. Para valer, tem que estar em **Produção**.

**Quantas notas posso emitir?**
Quantas quiser. A emissão é ilimitada e sem custo por nota. Você só paga o servidor (Railway) por mês.

**Preciso deixar meu computador ligado?**
Não. O servidor (worker) roda na internet, no Railway, o tempo todo. Você emite pelo app de qualquer lugar, mesmo com o computador desligado depois.

---

## Checklist final

Use esta lista para confirmar que está tudo pronto:

- [ ] Comprei um certificado **A1 e-CNPJ** no CNPJ da empresa prestadora
- [ ] Tenho o arquivo **`.pfx`/`.p12`** e a **senha** guardados em local seguro
- [ ] Criei a conta no **Railway** e cadastrei um **cartão** válido
- [ ] Cliquei em **"Criar meu worker"** e esperei o deploy terminar (verde)
- [ ] Gerei a **URL** (Settings > Networking > Generate Domain) e copiei
- [ ] Copiei a **chave** (Variables > `NFSE_WORKER_API_KEY`)
- [ ] Colei URL e chave no app e o **"Testar servidor" ficou verde**
- [ ] Subi o **certificado**, digitei a senha e o **"Testar certificado"** mostrou CNPJ, razão social e validade corretos
- [ ] Preenchi os **dados fiscais** (série, código IBGE do município, inscrição municipal se houver)
- [ ] Emiti uma **nota de teste em Homologação** e vi a **chave de acesso** gerada
- [ ] Troquei para **Produção** e emiti a primeira nota real
- [ ] Anotei na agenda a **data de validade do certificado** para renovar no ano que vem

Se todos os itens estão marcados, parabéns: você está emitindo NFS-e sozinho, com o certificado no seu ambiente e um custo fixo baixo. Qualquer dúvida em dado fiscal específico (código de serviço, competência, alíquota), a sua contabilidade resolve rápido. O resto, você já domina.
