export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'revenue' | 'expense';
  category: string;
  account: string;
  costCenter?: string;
  status: 'confirmed' | 'pending' | 'reconciled';
  source: 'manual' | 'whatsapp' | 'bank';
}

export interface KPI {
  label: string;
  value: number;
  change: number;
  format: 'currency' | 'percentage';
}

export interface DRELine {
  label: string;
  currentMonth: number;
  previousMonth: number;
  level: number;
  isTotal?: boolean;
}

export const mockTransactions: Transaction[] = [
  { id: '1', date: '2026-02-18', description: 'Venda de Serviços - Cliente Alpha', amount: 45000, type: 'revenue', category: 'Receita Operacional', account: 'Banco Itaú', costCenter: 'Comercial', status: 'confirmed', source: 'manual' },
  { id: '2', date: '2026-02-17', description: 'Aluguel do Escritório', amount: 8500, type: 'expense', category: 'Despesas Fixas', account: 'Banco Itaú', costCenter: 'Administrativo', status: 'reconciled', source: 'bank' },
  { id: '3', date: '2026-02-17', description: 'Nota Fiscal #4521 - Material de escritório', amount: 1250, type: 'expense', category: 'Despesas Operacionais', account: 'Banco Bradesco', status: 'confirmed', source: 'whatsapp' },
  { id: '4', date: '2026-02-16', description: 'Consultoria - Projeto Beta', amount: 32000, type: 'revenue', category: 'Receita Operacional', account: 'Banco Itaú', costCenter: 'Projetos', status: 'confirmed', source: 'manual' },
  { id: '5', date: '2026-02-16', description: 'Folha de Pagamento - Fev/2026', amount: 67000, type: 'expense', category: 'Custos com Pessoal', account: 'Banco Itaú', costCenter: 'RH', status: 'pending', source: 'manual' },
  { id: '6', date: '2026-02-15', description: 'Licença Software SaaS', amount: 3200, type: 'expense', category: 'Despesas Operacionais', account: 'Banco Bradesco', costCenter: 'TI', status: 'reconciled', source: 'bank' },
  { id: '7', date: '2026-02-15', description: 'Venda de Produto - Lote 23', amount: 28500, type: 'revenue', category: 'Receita de Produtos', account: 'Banco Itaú', status: 'confirmed', source: 'manual' },
  { id: '8', date: '2026-02-14', description: 'Energia Elétrica', amount: 2100, type: 'expense', category: 'Despesas Fixas', account: 'Banco Bradesco', costCenter: 'Administrativo', status: 'reconciled', source: 'bank' },
  { id: '9', date: '2026-02-14', description: 'Marketing Digital - Google Ads', amount: 5600, type: 'expense', category: 'Marketing', account: 'Banco Itaú', costCenter: 'Marketing', status: 'confirmed', source: 'manual' },
  { id: '10', date: '2026-02-13', description: 'Receita Recorrente - Assinaturas', amount: 18700, type: 'revenue', category: 'Receita Recorrente', account: 'Banco Itaú', status: 'confirmed', source: 'manual' },
];

export const mockDRE: DRELine[] = [
  { label: 'Receita Bruta', currentMonth: 124200, previousMonth: 118500, level: 0, isTotal: true },
  { label: 'Receita de Serviços', currentMonth: 77000, previousMonth: 72000, level: 1 },
  { label: 'Receita de Produtos', currentMonth: 28500, previousMonth: 31000, level: 1 },
  { label: 'Receita Recorrente', currentMonth: 18700, previousMonth: 15500, level: 1 },
  { label: '(-) Deduções', currentMonth: -6210, previousMonth: -5925, level: 0 },
  { label: 'Receita Líquida', currentMonth: 117990, previousMonth: 112575, level: 0, isTotal: true },
  { label: '(-) Custos dos Serviços/Produtos', currentMonth: -42000, previousMonth: -39800, level: 0 },
  { label: 'Custos com Pessoal', currentMonth: -67000, previousMonth: -64500, level: 1 },
  { label: 'Custos Diretos', currentMonth: -15000, previousMonth: -14300, level: 1 },
  { label: 'Lucro Bruto', currentMonth: 75990, previousMonth: 72775, level: 0, isTotal: true },
  { label: '(-) Despesas Operacionais', currentMonth: -20650, previousMonth: -19200, level: 0 },
  { label: 'Despesas Fixas', currentMonth: -10600, previousMonth: -10400, level: 1 },
  { label: 'Despesas Operacionais', currentMonth: -4450, previousMonth: -3800, level: 1 },
  { label: 'Marketing', currentMonth: -5600, previousMonth: -5000, level: 1 },
  { label: 'EBITDA', currentMonth: 55340, previousMonth: 53575, level: 0, isTotal: true },
  { label: '(-) Depreciação e Amortização', currentMonth: -3200, previousMonth: -3200, level: 0 },
  { label: 'Resultado antes do IR', currentMonth: 52140, previousMonth: 50375, level: 0, isTotal: true },
  { label: '(-) IR e CSLL', currentMonth: -12535, previousMonth: -12090, level: 0 },
  { label: 'Lucro Líquido', currentMonth: 39605, previousMonth: 38285, level: 0, isTotal: true },
];

export const monthlyChartData = [
  { month: 'Set', receitas: 98000, despesas: 72000 },
  { month: 'Out', receitas: 105000, despesas: 78000 },
  { month: 'Nov', receitas: 112000, despesas: 74000 },
  { month: 'Dez', receitas: 118500, despesas: 80000 },
  { month: 'Jan', receitas: 108000, despesas: 76000 },
  { month: 'Fev', receitas: 124200, despesas: 87650 },
];

export const categoryData = [
  { name: 'Custos com Pessoal', value: 67000, fill: 'hsl(var(--chart-1))' },
  { name: 'Despesas Fixas', value: 10600, fill: 'hsl(var(--chart-3))' },
  { name: 'Marketing', value: 5600, fill: 'hsl(var(--chart-4))' },
  { name: 'Despesas Operacionais', value: 4450, fill: 'hsl(var(--chart-5))' },
];

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR');
}
