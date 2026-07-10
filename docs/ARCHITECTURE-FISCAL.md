# Arquitetura fiscal — decisão de vias (2026-07-09)

O projeto acumulou três caminhos de emissão fiscal. Esta é a decisão de qual usar para quê.

## Vias e papéis

| Via | Componentes | Papel decidido |
|---|---|---|
| **NFS-e Nacional própria** | `nfse-worker/` (Express na Railway, mTLS cert A1) + edge `nfse-proxy` + `nfse-operations` | **PRIMÁRIA para NFS-e.** Rota oficial SEFIN/ADN, sem custo por nota. Obrigatória p/ Simples a partir de 01/09/2026 (Res. CGSN 189/2026) — é o motor de aquisição. |
| **PlugNotas** | edges `plugnotas-nfe/nfce/nfse/cte/mdfe/empresa/status` + `_shared/plugnotas.ts` | **ÚNICA via para NFe, NFCe, CTe e MDFe** (não temos emissão própria desses). Para NFS-e é **fallback pago** quando o município/cenário não estiver coberto pelo Emissor Nacional. |
| **nfse-nacional-mcp** | `nfse-nacional-mcp/` (MCP server Node, stdio) | Ferramenta de **dev/suporte/debug** (consultas, homologação, DANFSE manual). NÃO é caminho de produção do app. |

## Regras

1. UI de emissão NFS-e (`/fiscal/nfse/emit`) usa `nfse-operations` → `nfse-proxy` → worker. O form PlugNotas de NFS-e (`/fiscal/plugnotas/emit`) permanece como fallback explícito.
2. O worker (Railway) é a única peça fora do Supabase — segredos: `NFSE_WORKER_URL`, `NFSE_WORKER_API_KEY`. mTLS com cert A1 não roda em Deno Deploy (motivo da existência dele).
3. Certificados A1 (.pfx) dos clientes: upload via `nfse-operations parse_cert`; nunca armazenar a senha em claro em tabela sem cifragem.
4. **Reforma tributária**: desde 01/01/2026 os DF-e devem destacar CBS/IBS (NT 2025.002); rejeição a partir de ~03/08/2026 (regime regular). Cobre NFe, NFCe, NFSe e CTe — MDF-e fora. Implementação no Ciclo 1 do plano (`.claude/plans/pivo-state-of-the-art.plan.md`).

## Reforma Tributária — achados da pesquisa (2026-07-09, verificado nas fontes)

- **PlugNotas suporta IBS/CBS em NFe/NFCe** desde 12/08/2025 (schema `ibscbsNfe`, api.json v2.4.2, esquema **pl_010b**): grupo em `itens[].tributos.ibscbs` com `cst`, `classificacao` (=cClassTrib), `baseCalculo`, `uf`/`municipio`/`cbs` — implementado em `src/lib/plugnotas.ts` (`ibsCbsPayloadGroup`).
- **Calculadora automática RFB**: opcional via cadastro da empresa no PlugNotas (`nfe.config.calculadoraAutomatica.regimeGeral.ativo: true`) — só calcula se o item vier APENAS com NCM+CST+classificacao+baseCalculo. Hoje enviamos calculado (modo manual). Migrar p/ calculadora é opção futura.
- **⚠️ PlugNotas NÃO emite CT-e** (sem endpoint `/cte` na spec). A edge `plugnotas-cte` e o `CteForm` não funcionam de ponta a ponta — precisa de outro provedor (Componentes Tecnospeed) se CT-e for requisito real de algum cliente.
- **NFS-e RTC via PlugNotas**: schema próprio (`servico[].ibscbs` c/ finalidadeNFSe/codigoOperacao/valores) — NÃO implementado; via primária de NFS-e é o Emissor Nacional e Simples só destaca em 2027.
- **Prazos confirmados**: rejeição 1115 em produção a partir de **03/08/2026** (NT 2025.002 v1.40, CRT 3); homologação já rejeita desde 01/07/2026; Simples/MEI: 04/01/2027. Alíquotas LC 214/2025: IBS 0,1% (art. 343, estadual), CBS 0,9% (art. 346); dispensa de recolhimento p/ quem destaca (art. 348 §1º).
- **Consistência**: desde 02/02/2026, grupo enviado com CST×cClassTrib×alíquotas×somas inconsistentes = rejeição.
- Tabela cClassTrib oficial: https://dfe-portal.svrs.rs.gov.br/DFE/ClassificacaoTributaria · Exemplos: github.com/tecnospeed/Arquivos_RTC · Validador: dfe-portal.svrs.rs.gov.br/DFE/ValidadorRTC

## Funções deployadas órfãs (remover)

`asaas-api`, `asaas-webhook`, `ai-classify-personal` estão ACTIVE no projeto mas não existem mais no repo (substituídas por `company-asaas-*`; PF removido no pivô PJ-only `d738400`). São versões pré-hardening → remover no próximo deploy via Lovable.

## Auditoria de auth (2026-07-09)

As 24 funções do repo validam auth: Bearer JWT via `_shared/auth.ts`/`_shared/plugnotas.ts` (+ membership `company_members`), secret dedicado em webhooks (`asaas-access-token`, secret de instância no `whatsapp-webhook`) e `X-Cron-Secret` no `smart-alerts`. `verify_jwt=false` no config.toml é intencional (validação interna) — qualquer função nova DEVE usar `_shared/auth.ts`.
