# Plan: Próximo horizonte — ativação, monetização e profundidade

**Fonte**: PDCA da entrega "alavancagem total" (2026-07-30/31). Tudo do plano
anterior foi aplicado; este plano é o "para onde ir" que sai do aprendizado.
**Complexidade**: LARGE (6 horizontes independentes, priorizados por impacto
no negócio, não por facilidade).

## Contexto pós-entrega

O produto agora tem: cockpit denso com BI self-service, agentes multi-canal,
Open Finance fechado ponta a ponta, consolidação total, Central do Contador,
PDV transacional, trilho de migração Conta Azul (MCP + import) e harness
Evolution endurecido. O que ele NÃO tem: usuários ativos (129 empresas, ~34
transações) e cobrança. Feature nova sem ativação agora é vaidade.

## H1 — Ativação (a métrica que importa) — PRIORIDADE 1

- **T1.1** Onboarding com banco: o wizard atual não pede conexão bancária;
  adicionar passo "Conecte seu banco" (widget Pluggy) como etapa 1 pós-CNPJ,
  com skip explícito. A F1 anterior construiu o caminho; o onboarding precisa
  apontar para ele.
- **T1.2** Checklist de ativação no cockpit: card persistente com os 4 passos
  (conectar banco OU importar do Conta Azul → revisar caixa de entrada →
  definir 1 meta → ativar 1 agente), sumindo quando completo. `v_ativacao_empresa`
  já existe como fonte.
- **T1.3** Campanha de reativação para a base: e-mail/WhatsApp para as 129
  empresas com o pitch "conecte o banco em 2 minutos e veja seu DRE montar
  sozinho". Execução fora do produto (lista + copy + disparo); o produto
  entrega a landing do passo 1.
- **Métrica de 30 dias**: empresas com 1+ conexão bancária E 1º lançamento
  confirmado. Hoje: zero conexões.

## H2 — Monetização: planos e entitlements

- Não existe tabela de plano, limite ou billing. Desenhar: `plans` +
  `company_entitlements` (agentes ativos máx., widgets BI máx., canal
  WhatsApp sim/não, PDV sim/não, Conta Azul sim/não), enforcement nas RPCs e
  edges (não só UI). `ai_usage` já mede custo por empresa para precificar.
- Cobrança via Asaas (a infra de assinatura já existe no produto: usar o
  próprio dogfood — FinanceAI cobrando pelo FinanceAI via company-asaas-api).
- Base (ERP) × Pro (cockpit + BI + agentes + WhatsApp + PDV + integrações).

## H3 — Conta Azul: da fundação ao piloto

- **Bloqueado pela key** (Guilherme vai mandar): gravar em ~/.claude/secrets.md,
  ligar os envs do MCP `contaazul`, rodar `ca_status` + `ca_list_pessoas`.
- Piloto de migração assistida num cliente real: import-cadastros +
  import-financeiro, validar volumes e mapeamentos contra dados reais (os
  mapeadores são defensivos mas foram calibrados por doc, não por payload real).
- Se houver app OAuth registrado: fluxo self-service (T3.4 do plano anterior).

## H4 — PDV v2

- Emissão NFC-e NATIVA pós-venda: montar o payload de mapNfce com os itens do
  pedido automaticamente (hoje o recibo tem atalho para a tela de emissão);
  exige NCM nos produtos — aproveitar o lote fiscal com IA (ProntoParaAgosto).
- Operador de caixa: papel restrito (vender e nada mais) — depende do RBAC de H5.
- Sangria/suprimento de caixa e fechamento de turno (resumo do dia por forma
  de pagamento).

## H5 — Fundação staged que começou a doer

- **RBAC real por role** (admin/member/viewer hoje é UI): enforcement em RLS
  e nas RPCs; pré-requisito do operador de caixa do H4.
- **Período global com estado na URL** no cockpit/DRE/Reports (staged desde a
  revisão profunda; presets de Reports foram o primeiro passo).
- **DRE consolidada na Central do Contador** (export direto, sem pular de tela).

## H6 — Robustez contínua (dívidas nomeadas)

- E2E dedicado de favoritos (persistência entre reloads) e E2E tenant real da
  caixa de entrada bancária (issue #28).
- ConfiguracaoAgentes importar defaults de _shared/agentes.ts (issue #28).
- Sprint de lint: derrubar os 216 erros do baseline (na maioria `any`) por
  módulo, sem misturar com features.
- Issue #26 (artefatos .aidesigner/screenshots no repo).

## Aprendizados do PDCA que este plano institucionaliza

1. **Smoke E2E real com rollback** (DO block + RAISE EXCEPTION) vira etapa
   obrigatória de toda RPC nova — pegou 3 bugs na venda_balcao antes de
   qualquer cliente. Técnica documentada na memória.
2. **CHECKs de enum são o ponto cego recorrente**: todo `source`/`status`
   novo exige grep por `_check` nas tabelas alvo NA MESMA migration.
3. **Proxy que espelha paths** (evolution-proxy) minimiza refactor de página
   grande: trocar base+headers em vez de reescrever helpers.
4. **Mapeador defensivo com aliases** para API sem payload real em mãos;
   validar no piloto (H3) antes de confiar.

## Ordem recomendada

H1 (0,5 sessão de produto + campanha) → H2 (1-1,5) → H3 (0,5 quando a key
chegar) → H5 RBAC (1) → H4 (1) → H6 (contínuo).

## Aceite

- [ ] 10+ empresas com banco conectado em 30 dias (H1)
- [ ] Plano Pro definido com enforcement e primeira cobrança emitida (H2)
- [ ] Piloto Conta Azul migrado com dados reais (H3)
- [ ] NFC-e sai do PDV sem redigitar item (H4)
- [ ] viewer não escreve em nada via API (H5)
