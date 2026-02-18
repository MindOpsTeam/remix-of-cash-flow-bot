

## Adicionar Conta Contabil para Despesa com Pneus

### O que sera feito

Inserir uma nova conta contabil no banco de dados com os seguintes dados:

- **Nome**: Pneus e Manutencao Veicular
- **Codigo**: 5.9
- **Tipo**: expense (despesa)
- **Editavel**: true (voce podera renomear ou excluir depois)
- **Empresa**: vinculada a sua empresa atual

### Como sera feito

Uma unica operacao de INSERT na tabela `chart_of_accounts` usando a ferramenta de dados, sem necessidade de migracao de schema.

### Resultado esperado

A nova conta aparecera automaticamente:
- Na lista do Plano de Contas (em Configuracoes)
- No dropdown "Conta Contabil" ao criar um novo lancamento do tipo Despesa
- Na DRE, agrupada junto as demais despesas (codigo 5.x)

### Nenhuma alteracao no frontend

O codigo ja carrega dinamicamente todas as contas do banco. Basta inserir o registro.

