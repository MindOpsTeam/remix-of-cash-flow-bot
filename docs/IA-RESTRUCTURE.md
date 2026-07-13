# Reestruturação de Arquitetura de Informação — FinanceAI (2026-07-13)

O produto cresceu de um ERP financeiro simples para uma plataforma poderosa (multi-CNPJ,
agentes de IA, Open Finance, fiscal completo, BI). A navegação antiga (8 grupos "orgânicos"
que misturavam módulos de ERP com níveis de análise) não reflete mais isso. Reorganizamos a
IA em torno dos **três níveis de decisão** do usuário do ERP — a pirâmide gerencial clássica.

> **Restrição respeitada:** só o AGRUPAMENTO da navegação muda. Nenhuma rota é renomeada,
> nenhuma lógica de dados é tocada. O DRE continua lendo `transactions.type` (revenue/expense)
> + `chart_of_accounts.code` — receitas/despesas seguem refletindo corretamente. Risco de
> dados = zero.

## Os três perfis (personas)

### 🧭 Estratégico — Dono / Sócio / CFO
- **O que precisa enxergar:** a saúde do negócio como um todo, consolidada entre CNPJs.
- **Dados que deseja:** margem, DRE, orçado × realizado, previsão de caixa, resumo executivo.
- **Funcionalidades:** CFO Digital (perguntar em linguagem natural), simulador "e se?", conselho de decisão.
- **Frequência:** olha o Painel diariamente/semanalmente; decide, não opera.

### 🗂️ Tático — Controller / Gerente Financeiro
- **O que precisa enxergar:** o que exige ação e coordenação neste mês.
- **Dados que deseja:** contas a pagar (aprovação por alçada), cobranças, anomalias, relatórios, calendário de impostos.
- **Funcionalidades:** fechamento mensal assistido, agentes (cobrança/anomalias/aprovações), consolidação do grupo (plano de contas).
- **Frequência:** trabalha a plataforma o dia todo; controla e coordena.

### ⚙️ Operacional — Operador / Lançador / Vendedor
- **O que precisa enxergar:** as telas de execução do dia a dia, rápidas e diretas.
- **Dados que deseja:** lançamentos, movimentações, extrato bancário, notas a emitir.
- **Funcionalidades:** lançar receita/despesa, emitir nota, escanear documento (OCR), conciliar banco, cadastrar cliente/produto, registrar venda/compra.
- **Frequência:** o tempo todo, em fluxo; executa.

## Nova navegação (5 seções + Painel + Configurações)

| Seção | Perfil | Itens |
|---|---|---|
| **Painel** (home) | todos | Painel consolidado |
| **Visão** | estratégico, tático | DRE · Orçamento × Realizado · Previsão de Caixa · Resumo Executivo |
| **Inteligência** | estratégico, tático | CFO Digital · Agentes · Simulador · WhatsApp |
| **Gestão** | tático | Fechamento Mensal · Contas a Pagar · Relatórios · Calendário de Impostos · Consolidação do Grupo |
| **Operação** | operacional | Lançamentos · Movimentações · Sócio ↔ Empresa · Notas Fiscais · Scanner OCR · Conciliação Bancária · Bancos & Open Finance |
| **Cadastros** | operacional | Clientes / Fornecedores · Produtos / Serviços · Vendas · Compras · Estoque |
| **Configurações** (rodapé) | todos (admin) | hub de settings |

### Seletor de perfil ("lente")
Um seletor no topo da sidebar (`Perfil: Estratégico ▾`) filtra as seções mostradas, persistido
em `localStorage` (`cfo:nav-persona`). Padrão = **Completo** (nada escondido). Mapeamento:

- **Estratégico** → Painel · Visão · Inteligência
- **Tático** → Painel · Visão · Gestão · Inteligência
- **Operacional** → Painel · Operação · Cadastros
- **Completo** → tudo

Painel e Configurações aparecem sempre.

## Antes → Depois (todas as rotas preservadas)

| Antes (grupo → item) | Depois (seção → item) | Mudança |
|---|---|---|
| Dashboard | Painel | Rename (Dashboard→Painel) |
| Financeiro → Lançamentos | Operação → Lançamentos | Move |
| Financeiro → Movimentações | Operação → Movimentações | Move |
| Financeiro → Banco Inter | Operação → Conciliação Bancária | Move + rename |
| Financeiro → Sócio ↔ Empresa | Operação → Sócio ↔ Empresa | Move |
| Cadastros → Clientes/Fornecedores | Cadastros → Clientes/Fornecedores | Mantém |
| Cadastros → Produtos/Serviços | Cadastros → Produtos/Serviços | Mantém |
| Vendas → Pedidos/Orçamentos | Cadastros → Vendas | Move + rename |
| Compras → Pedidos de Compra | Cadastros → Compras | Move + rename |
| Compras → Estoque | Cadastros → Estoque | Move |
| Fiscal → Notas Fiscais | Operação → Notas Fiscais | Move |
| Fiscal → Calendário Impostos | Gestão → Calendário de Impostos | Move |
| Fiscal → Contas a Pagar | Gestão → Contas a Pagar | Move |
| Fiscal → Arquivos Fiscais | (sub-página de Notas Fiscais) | Remove do topo |
| Fiscal → Scanner OCR | Operação → Scanner OCR | Move |
| Análise → DRE | Visão → DRE | Move |
| Análise → Orçamento | Visão → Orçamento × Realizado | Move + rename |
| Análise → Relatórios | Gestão → Relatórios | Move |
| Análise → Previsão Fluxo | Visão → Previsão de Caixa | Move + rename |
| Análise → Resumo Executivo | Visão → Resumo Executivo | Mantém |
| Inteligência → CFO Digital | Inteligência → CFO Digital | Mantém |
| Inteligência → Agentes | Inteligência → Agentes | Mantém |
| Inteligência → Fechamento | Gestão → Fechamento Mensal | Move |
| Inteligência → Simulador | Inteligência → Simulador | Mantém |
| Inteligência → WhatsApp | Inteligência → WhatsApp | Mantém |
| Integrações → Configurar | (dentro de Configurações) | Remove do topo |
| — | Gestão → Consolidação do Grupo | Novo no topo (era só settings) |
| — | Operação → Bancos & Open Finance | Novo no topo (era só settings) |

## Teste "encontra em ≤2 cliques" (a partir do Painel)
1. Ver a margem consolidada → Painel (0). ✓
2. Aprovar uma conta a pagar → Gestão → Contas a Pagar (2). ✓
3. Emitir uma NFS-e → Operação → Notas Fiscais (2). ✓
4. Conectar um banco → Operação → Bancos & Open Finance (2). ✓
5. Perguntar ao CFO sobre o caixa → Inteligência → CFO Digital (2). ✓
