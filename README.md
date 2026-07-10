# FinanceAI — ERP financeiro com agentes de IA

**O ERP financeiro para PMEs multi-CNPJ em que os agentes de IA trabalham por você — e que já está pronto para a Reforma Tributária.**

## O que ele faz

- **Financeiro completo**: lançamentos, plano de contas, centros de custo, DRE, fluxo de caixa, conciliação bancária (Banco Inter), cobrança (Asaas), contas a pagar com workflow de aprovação por alçada.
- **Multi-CNPJ de verdade** (até 6 por cliente): BI de margem consolidado × individual, plano de contas do grupo, eliminação intercompany, orçamento×realizado por empresa.
- **Agentes de IA com humano no loop**:
  - *Cobrança* — varre cobranças vencidas/a vencer e rascunha a mensagem; você aprova.
  - *Fechamento* — checklist do mês (classificação, pendências, vencidas) e close assistido.
  - *Alertas* — anomalias de valor (lançamento fora da curva histórica).
  - Aprovação direto no **grupo do WhatsApp**: `ações`, `aprovar 1`, `recusar 2`.
- **Fiscal pronto para 2026**: destaque CBS/IBS (LC 214/2025, NT 2025.002) em NFe/NFCe via PlugNotas, emissão **NFS-e Nacional própria** (API SEFIN, obrigatória p/ Simples a partir de 01/09/2026), OCR de documentos por IA.
- **Plataforma**: API pública read-only por chave (`docs/PUBLIC-API.md`), export CSV/PDF, PWA instalável.

## Stack

Vite + React + TypeScript + shadcn/ui · Supabase (Postgres/RLS + 27 edge functions Deno) · Lovable AI Gateway (Gemini) · Evolution API (WhatsApp) · PlugNotas + SEFIN Nacional (fiscal) · Railway (`nfse-worker`, mTLS A1).

Decisões de arquitetura fiscal: `docs/ARCHITECTURE-FISCAL.md`. Plano de evolução: `.claude/plans/pivo-state-of-the-art.plan.md`.

## Desenvolvimento

```bash
npm install
npm run dev        # local (aponta para o Supabase do projeto via .env)
npm test           # vitest (libs puras: margin, plugnotas, reforma, csv)
npm run build      # produção
```

- Migrations em `supabase/migrations` (sempre aditivas — projeto em produção).
- Edge functions em `supabase/functions` — toda função nova valida auth via `_shared/auth.ts`.
- Deploy: gitsync com o Lovable (push na `main` → aplicar no chat do Lovable).
