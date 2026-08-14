# Plano de correção — Open Finance/Pluggy "conexão cancelada" (/settings/bank-accounts)

## Diagnóstico (causa-raiz)

Não é bug de código. O fluxo do app está correto:
- `openfinance-connect` (`token`): autentica na Pluggy (`/auth`) e cria o `connect_token`
  com `options.clientUserId`/`webhookUrl` — **conforme a spec** (`docs/reference/openfinance-apis.md`).
- Widget `PluggyConnect` (com `includeSandbox`) abre → `onSuccess` devolve `itemId` →
  `register` cria `bank_connections` e roda o sync inicial.
- `openfinance-webhook` é público (`verify_jwt=false`).

O que aconteceu, pelas evidências:
1. **1º erro ("erro de edge function")**: credenciais Pluggy ainda ausentes →
   `pluggyAuth` lança `PLUGGY_NOT_CONFIGURED` (503). O front mostra erro genérico.
2. Depois de configurar as credenciais, o **modal abriu** (token OK) mas veio
   **"conexão cancelada"** → o callback `onError` do widget disparou: o banco recusou
   a conexão.

**Por que o banco recusa:** as credenciais em uso são de uma **aplicação Pluggy
Development/Demo** (o print mostra o badge "Development"; o Client Secret é de um app
demo). No banco (`get_pluggy_credentials`) **nenhuma empresa tem credencial no Vault**,
então o token usou o **secret de ENV** — que é um app **sandbox**. Aplicação
Development/Demo do Pluggy **só conecta no conector SANDBOX** ("Pluggy Bank"); ao
escolher um **banco real**, a Pluggy cancela → "conexão cancelada".

## Correção — dois caminhos

### A. Testar AGORA (com o app Development atual) — funciona no Sandbox
No widget, escolher o banco **"Pluggy Bank" (Sandbox)** e logar com:
- usuário `user-ok` / senha `password-ok` (PF, connector 2)
- ou `user-ok`/`password-ok` no connector 14 "Pluggy Bank Business" (PJ/CNPJ)
Isso prova a esteira ponta a ponta (token → item → contas → transações → staging para
conciliação em `/transactions`).

### B. Conectar BANCO REAL (produção)
Exige uma **aplicação Pluggy de PRODUÇÃO** (não Development/Demo). Passos, no
`dashboard.pluggy.ai`:
1. Solicitar/ativar uma aplicação de produção (aprovação Pluggy + plano pago).
2. Pegar o novo `Client ID`/`Client Secret` de produção.
3. Colocar como credencial:
   - por empresa (recomendado): tela de Integrações → grava no **Vault** via
     `set_pluggy_credentials` (o edge lê pelo `get_pluggy_credentials`); ou
   - global: secrets `PLUGGY_CLIENT_ID`/`PLUGGY_CLIENT_SECRET` do projeto (Lovable Cloud).
4. Reconectar o banco pelo widget.

## O que já implementei (código, commitado)

- `OpenFinanceConnect.tsx`:
  - `onError` do widget agora **loga o erro** e mostra mensagem que orienta:
    "conexão cancelada/banco recusou; com credenciais de teste use o Sandbox 'Pluggy
    Bank' (user-ok/password-ok); banco real exige app de produção".
  - **Nota fixa** abaixo do conector explicando o fluxo Sandbox e a exigência de app
    de produção para bancos reais.

## Arquivos

- Alterado: `src/components/openfinance/OpenFinanceConnect.tsx` (só front; rebuild automático).
- Sem migration, sem mudança de edge (o fluxo do backend já está correto).
- Segredos: registrado o app Demo #2 (`b79b0e73…`) em `~/.claude/secrets.md`.

## Validação

1. Preview do demo → `/settings/bank-accounts` → "Conectar banco" → escolher **Pluggy
   Bank (Sandbox)** → `user-ok`/`password-ok` → confirmar "Banco conectado — N transações".
2. Ver as transações staged em `/transactions`.
3. (Produção) repetir com o app de produção conectando um banco real.

## Riscos / notas

- Se a intenção for banco real JÁ, não há fix de código possível: depende da conta
  Pluggy (app de produção). O código está pronto para produção — é só trocar a
  credencial.
- O secret do app Demo #2 veio truncado no chat; pegar o valor completo no dashboard
  se for usá-lo no ENV.
