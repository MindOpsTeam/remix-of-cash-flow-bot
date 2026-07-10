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

## Funções deployadas órfãs (remover)

`asaas-api`, `asaas-webhook`, `ai-classify-personal` estão ACTIVE no projeto mas não existem mais no repo (substituídas por `company-asaas-*`; PF removido no pivô PJ-only `d738400`). São versões pré-hardening → remover no próximo deploy via Lovable.

## Auditoria de auth (2026-07-09)

As 24 funções do repo validam auth: Bearer JWT via `_shared/auth.ts`/`_shared/plugnotas.ts` (+ membership `company_members`), secret dedicado em webhooks (`asaas-access-token`, secret de instância no `whatsapp-webhook`) e `X-Cron-Secret` no `smart-alerts`. `verify_jwt=false` no config.toml é intencional (validação interna) — qualquer função nova DEVE usar `_shared/auth.ts`.
