

## Simplificar Configuracao Inicial e Padronizar Dados

### Situacao Atual
- As politicas RLS ja estao corrigidas (PERMISSIVE)
- O trigger de seed existe (com 3 duplicatas que precisam ser limpas)
- O banco esta vazio porque nenhuma empresa foi criada ainda
- A funcao `seed_default_accounts` ja cria contas, centros e banco, mas com estrutura mais complexa que o desejado

### Mudancas Necessarias

#### 1. Atualizar funcao `seed_default_accounts()`

Simplificar o plano de contas para a estrutura solicitada:

**RECEITAS (codigo 3.x):**
- 3.1 Receita de Servicos
- 3.2 Receita de Produtos
- 3.3 Receita Recorrente
- 3.4 Outras Receitas

**CUSTOS (codigo 4.x):**
- 4.1 Custo de Mercadoria/Servico
- 4.2 Mao de Obra Direta
- 4.3 Taxas de Pagamento
- 4.4 Fretes

**DESPESAS (codigo 5.x):**
- 5.1 Marketing
- 5.2 Salarios
- 5.3 Pro-labore
- 5.4 Aluguel
- 5.5 Softwares
- 5.6 Contabilidade
- 5.7 Impostos
- 5.8 Juros e Tarifas

Todas marcadas com `editable = false` (protegidas, nao excluiveis).

**Centros de Custo** (mantidos como ja estao):
- Administrativo, Financeiro, Comercial, Marketing, Operacional

Remover "Instalacao" que nao esta na lista solicitada.

**Conta Bancaria:**
- Nome: "Banco Inter - Conta Principal"
- bank_name: "Inter"

#### 2. Limpar triggers duplicados

Existem 3 triggers chamando a mesma funcao. A migracao vai remover os duplicados e manter apenas um.

#### 3. Nenhuma alteracao no frontend necessaria

O codigo existente ja:
- Protege contas com `editable = false` (nao mostra botoes de editar/deletar)
- Filtra centros de custo ativos
- Filtra contas contabeis por tipo (receita/despesa)
- Calcula DRE separando custos (4.x) de despesas (5.x)

### Resultado Final
Ao fazer logout e login novamente, a empresa sera criada automaticamente com:
- 16 contas contabeis padrao (protegidas)
- 5 centros de custo ativos
- 1 conta bancaria configurada
- Pronto para lancar transacoes imediatamente
