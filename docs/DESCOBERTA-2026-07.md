# Sprint de descoberta — 31/07/2026

Fonte: agregados read-only do banco de produção (117 usuários, 132 empresas).
Nenhum dado individual neste doc.

## Os números que contam a história

| Métrica | Valor | Leitura |
|---|---|---|
| Usuários que logaram SÓ no primeiro dia | 77 de 103 que logaram (75%) | O produto não entrega valor na 1ª sessão |
| Ativos 7d / 30d | 8 / 29 | Núcleo vivo minúsculo, mas existe |
| Empresas novas em 30d | 49 | Topo de funil SAUDÁVEL; o buraco é o meio |
| Empresas "Minha Empresa" (placeholder) | 80 (61%) | Maioria é curioso testando, não PME operando |
| Empresas sem CNPJ | 87 (66%) | Idem; qualificação de ICP necessária |
| Onboarding incompleto | 53 (40%) | O wizard perdia gente antes do valor |
| Empresas com 1+ lançamento | 10 de 132 | Ativação de 7,5% |
| Origens dos 34 lançamentos | manual 19, inter 8, scanner 5, sócio 2 | **Colar extrato: ZERO usos. Open Finance: ZERO. Asaas: ZERO** |
| Conexões bancárias | 0 | A fundação existia; ninguém chegou nela |
| Recebíveis / ações de agente | 0 / 0 | Sem recebível, a cobrança automática não tem o que varrer |
| Chamadas de IA registradas | 5 (só ai-forecast) | IA subusada E subinstrumentada |

## As 5 descobertas (priorizadas)

**D1 — O único caminho bancário que converteu foi o Inter (integração direta).**
8 dos 34 lançamentos vieram do Inter; zero do Open Finance. Hipótese forte: a
fricção do Open Finance atual é a tela pedir credencial Pluggy própria
(client_id/secret) — PME não tem e não vai criar conta na Pluggy. O backend JÁ
suporta credencial global da plataforma (fallback env em
`pluggyCredsForCompany`). **Ação: modelo de credencial da casa — o cliente só
clica "Conectar banco" no widget; a credencial Pluggy é da plataforma (custo
absorvido no plano Pro). Mudança é majoritariamente de copy/fluxo, não de
código.**

**D2 — 75% somem no dia 1: a primeira sessão precisa entregar um DRE, não um
formulário.** O onboarding novo (banco como passo 1) + checklist de ativação
atacam isso, mas só funcionam publicados. **Ação: Publish + campanha (kit
pronto) + medir a coorte de agosto contra os 7,5% atuais.**

**D3 — A base atual é 2/3 curiosos e 1/3 empresa real.** A lista curada de 35
contatos com empresa nomeada e e-mail corporativo é o alvo que importa; o
resto é alcance de curso. **Ação: campanha segmentada (A/B do kit); métricas
de ativação SEMPRE sobre o segmento real, não sobre o total.**

**D4 — Colar extrato nunca foi usado — rebaixá-lo foi correto, e o motor de
classificação da IA nunca rodou em produção de verdade.** A cascata
classificar-lote (regra aprendida → modelo) estreia junto com a primeira
conexão bancária. **Ação: nenhum código; observar o custo/acerto quando a
caixa de entrada começar a rodar e calibrar o prompt com dados reais.**

**D5 — Instrumentação de IA incompleta.** `ai_usage` só registra as funções
novas; cfo-digital e whatsapp-webhook (os mais caros) não medem. **Ação:
padronizar `registrarUso` em TODAS as edges de IA — sem medir, o plano Pro
não tem base de custo.**

## Quick wins que saíram da descoberta

1. Copy da tela Open Finance: "Conectar banco" sem pedir credencial quando a
   credencial global existir (D1).
2. `registrarUso` no cfo-digital e whatsapp-webhook (D5, ~10 linhas cada).
3. Alerta interno semanal (agente para NÓS): coorte de ativação da semana no
   WhatsApp do Guilherme — o produto medindo o próprio funil.

## O que a descoberta NÃO recomenda agora

- Cobrar: com 8 ativos/7d, monetizar é prematuro; a infra de planos está
  pronta e espera a ativação subir.
- Mais features de superfície: o gargalo é distribuição+ativação, não
  capacidade. O produto está objetivamente à frente do uso.
