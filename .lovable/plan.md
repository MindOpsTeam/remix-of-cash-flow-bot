

## Módulo Fiscal — 3 novas páginas + reorganização sidebar

### Sidebar

Reorganizar o grupo "Vendas" (que hoje tem `/fiscal`) e o item `/documents` em um novo grupo **Fiscal**:

```
Fiscal (accordion)
├── Notas Fiscais       → /fiscal          (existente)
├── Emitir NFS-e        → /fiscal/nfse/emit (existente, fica oculto na sidebar)
├── Calendário Impostos → /fiscal/impostos  (NOVO)
├── Contas a Pagar      → /fiscal/contas-a-pagar (NOVO)
├── Arquivos Fiscais    → /fiscal/arquivos  (NOVO)
└── Scanner OCR         → /documents        (existente, movido do Financeiro)
```

- Remover `/fiscal` do grupo "Vendas" e `/documents` do grupo "Financeiro"
- Remover `/bills` do grupo "Financeiro" (substituído por `/fiscal/contas-a-pagar`)
- Grupo "Vendas" fica com: Pedidos/Orçamentos apenas
- Ícone do grupo: `FileCheck`

### Novas páginas (mock data)

**1. `/fiscal/impostos` — `src/pages/fiscal/TaxCalendar.tsx`**
- Alerta no topo se houver guias vencidas (status "Atrasado")
- Cards resumo: Total A Pagar, Pago este mês, Atrasado
- Lista de guias mock (DAS, DARF, ISS, ICMS) com: tipo, competência, vencimento, valor, status
- Badge colorido: A Pagar (amber), Pago (emerald), Atrasado (red)
- Botão "Adicionar Guia" (dialog placeholder)
- Padrão visual idêntico ao Fiscal.tsx

**2. `/fiscal/contas-a-pagar` — `src/pages/fiscal/BillsPayable.tsx`**
- Cards resumo: A Vencer, Vencido, Pago
- Lista mock de boletos: fornecedor, descrição, valor, vencimento, status
- Badge: A Vencer (amber), Vencido (red), Pago (emerald)
- Botão "Adicionar Boleto" (dialog placeholder)
- Nota: substitui `/bills` (Asaas bills) — rota `/bills` redireciona para `/fiscal/contas-a-pagar`

**3. `/fiscal/arquivos` — `src/pages/fiscal/FiscalFiles.tsx`**
- Lista mock de documentos: nome, tipo (Contrato, XML, Certificado), data upload, tamanho
- Botão "Adicionar Documento" (upload placeholder)
- Cards resumo: Total documentos, por tipo

### Rotas (App.tsx)
- Adicionar: `/fiscal/impostos`, `/fiscal/contas-a-pagar`, `/fiscal/arquivos`
- Manter `/bills` como redirect para `/fiscal/contas-a-pagar`

### Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/pages/fiscal/TaxCalendar.tsx` |
| Criar | `src/pages/fiscal/BillsPayable.tsx` |
| Criar | `src/pages/fiscal/FiscalFiles.tsx` |
| Editar | `src/components/AppSidebar.tsx` — novo grupo Fiscal |
| Editar | `src/App.tsx` — novas rotas lazy |

