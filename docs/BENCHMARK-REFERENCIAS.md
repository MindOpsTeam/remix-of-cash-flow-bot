# Benchmark de referências — Smartledger e Conta Azul Pro (2026-07-10)

Duas referências de mercado analisadas a partir de demos + pesquisa verificada. Complementa o deep research de 09/07 (fechou a pergunta em aberto sobre players BR).

## 1. SmartLedger Brasil — smartledger.com.br

**O que é:** SaaS BR (SP, desde 2020, empresa pequena 2-10 pessoas) de "Inteligência de Dados Contábil e Tributária" com **agentes autônomos de IA**. Vende para **escritórios de contabilidade e BPOs financeiros**, não para a PME final. Slogan: *"Enquanto outros organizam dados, nós executamos."*

**Features-chave:** Open Finance + busca automática de extratos; conciliação contábil autônoma com regras por plano de contas; monitoramento fiscal e-CAC com alertas; **BPO de cobrança com agente conversacional** (cobra via WhatsApp/Telegram/e-mail, régua adaptativa, lê comprovante e dá baixa automática); recuperação de créditos tributários; **white label** (CORE/BAAS/WEALTH/AI) para o parceiro revender com a marca dele. Pricing não público (demo + especialista).

**Leitura estratégica:** é o concorrente de *narrativa* — mesmo discurso agentic que o nosso, mas B2B2B (via contador/BPO) e execução 100% autônoma ("sem intervenção humana"), enquanto nós somos human-in-the-loop. Duas ideias roubáveis: (a) **baixa automática por leitura de comprovante** (cliente manda comprovante no WhatsApp → agente extrai valor/data/pagador, valida contra a cobrança e concilia); (b) **monitoramento e-CAC** como agente de alertas fiscais.

## 2. Conta Azul Pro — contaazul.com

**Contexto:** comprada pela norueguesa **Visma por ~US$ 300M (ago/2025)**. ~100 mil PMEs clientes, 12-14 mil contadores parceiros (o canal de distribuição), Instituição de Pagamento autorizada BC (Conta PJ própria = boleto/Pix/cobrança in-house). R$ 100 bi/ano em NFs emitidas.

**Dashboard (referência de UX do print):** faixa A receber/A pagar cortada em **"Vencidos" × "Vencem hoje" + restante do mês**; contas financeiras com saldo consolidado e CTA "importe seu extrato"; fluxo de caixa **diário** (recebimentos×pagamentos×saldo); gráfico de vendas 12m.

**IA — "Conta AI Captura" (ago/2025, Gemini):** OCR inteligente de boletos/NFs/extratos/faturas recebidos por WhatsApp/e-mail/upload/DDA → extrai, categoriza pelo histórico e **sugere** o lançamento para revisão. Human-in-the-loop, sem custo extra. **É só captura — não age, não cobra, não fecha mês.** Desenhada para o contador, não para o dono.

**Reforma:** já emite NF-e/NFS-e com IBS/CBS automático + hub de conteúdo massivo (calculadora de impacto, simulador de regime) — usam o medo da Reforma como motor de aquisição. Paridade técnica conosco; eles ganham em comunicação.

**Pricing (jul/2026):** Essencial R$ 159,90-259,90 · Controle R$ 309,90-499,90 · Avançado R$ 399,90-649,90 · Performance R$ 719,90-929,90 (mensal, por CNPJ). **Reclame Aqui 6,78**, queixas de reajuste agressivo na renovação e suporte lento (8 dias).

## Comparativo direto vs FinanceAI

| Dimensão | Conta Azul | SmartLedger | FinanceAI (hoje) |
|---|---|---|---|
| IA | OCR + sugestão (Captura) | Agentes autônomos (sem humano) | **Agentes + aprovação humana no WhatsApp** ✓ |
| Multi-CNPJ consolidado | ❌ (1 assinatura por CNPJ) | n/a (B2B2B) | ✅ até 6 + BI margem + intercompany |
| Banco próprio | ✅ Conta PJ (IP no BC) | BAAS white label | ❌ (Asaas/Inter integrados) |
| Open Finance | ✅ 10 bancos D-1 regulado | ✅ | ⚠️ só Inter direto |
| Fiscal | NFe/NFSe/NFCe ilimitadas + CBS/IBS | e-CAC monitor | NFe/NFCe/NFSe+Nacional + CBS/IBS ✓ |
| Fechamento assistido | ❌ | ❌ | ✅ |
| Orçado×realizado | raso | ❌ | ✅ |
| API pública | parcial | via automações | ✅ v1 read-only |
| Distribuição | 12-14 mil contadores | white label p/ BPO | direta |

## Ações derivadas (backlog priorizado)

1. **Dashboard "Vencidos × Vencem hoje"** (padrão Conta Azul) — evoluir o GroupApArCard com o corte temporal deles; é a leitura mais acionável de AP/AR. *(rápido)*
2. **Baixa automática por comprovante** (padrão SmartLedger) — cliente manda comprovante no grupo WhatsApp → `ocr-document` extrai → agente propõe conciliação da cobrança correspondente → aprovação. Encaixa 100% no motor `agent_actions` existente. *(médio, alto valor)*
3. **Open Finance multi-banco via agregador** (Pluggy/Belvo) — a maior lacuna funcional vs Conta Azul; conciliação hoje depende de Inter/import manual. *(estrutural)*
4. **Hub/calculadora da Reforma como conteúdo de aquisição** — paridade técnica já existe; falta a máquina de comunicação. *(marketing)*
5. **Canal contador** — os dois concorrentes distribuem via contador/BPO; avaliar painel multi-cliente estilo "Conta Azul Mais" ou white label estilo SmartLedger. *(estratégico, decisão de negócio)*

Fontes principais: contaazul.com/planos · contaazul.com/blog/conta-ai-captura · ajuda.contaazul.com (Open Finance, Captura) · Finsiders/SC Inova (aquisição Visma) · Exame/Startups.com.br (números) · smartledger.com.br (/plataforma-saas, /white-label) · LinkedIn Smart Ledger · Reclame Aqui.
