# Todo registro é clicável: o padrão de detalhe

Regra de UX que o produto assume: **nada na tela é um beco sem saída**. Linha de
tabela, cartão de lista, linha de demonstrativo — clicar abre o registro e mostra o
que é, quanto vale, quem lançou, quando, de onde veio e para onde leva.

## Como funciona

Um **único modal** serve o app inteiro. Não há estado de dialog espalhado por tela:

```
DetalheProvider (montado uma vez no App)
  └── useDetalhe() → abrirDetalhe({ tipo, id })
        └── DetalheRegistroDialog (busca, formata e navega)
```

O provider mantém uma **pilha**: abrir um relacionado empilha, e o botão *Voltar*
desfaz um passo. Dá para ir de um recebível ao cliente, do cliente a um lançamento,
e voltar sem perder o caminho. `Esc` fecha; o fundo continua acessível.

## O que o modal mostra

| Bloco | Conteúdo |
|---|---|
| Cabeçalho | tipo do registro, título e valor em destaque |
| Rastro | **quem lançou** e **quando** (ou "gerado pelo sistema") |
| Documento | link do comprovante/boleto quando o registro tem um |
| Campos | tudo que está preenchido, com rótulo em português e formato certo |
| Composição | os lançamentos que alimentam a conta, o centro de custo ou o contato |
| Ligados | atalhos para os registros conectados (cliente, contrato, pedido…) |
| Rodapé | "ver todos" na lista completa daquele tipo |

O "quem lançou" vem da RPC `autores_da_empresa`, que resolve o nome sem expor
`auth.users` — só devolve membros da mesma empresa.

## Como ligar uma tela nova

Tabela:

```tsx
import { LinhaDetalhe } from "@/components/detalhe/LinhaDetalhe";

<LinhaDetalhe tipo="receivable" id={r.id} key={r.id} className="border-b">
  <td>…</td>
</LinhaDetalhe>
```

Cartão, item de lista ou ponto de gráfico:

```tsx
const { abrirDetalhe } = useDetalhe();
<button onClick={() => abrirDetalhe({ tipo: "contact", id: c.id })}>…</button>
```

Um tipo novo entra em `src/lib/detalhe-registro.ts` declarando tabela, select,
campos e formatos. Nenhum componente muda.

## Acessibilidade

As linhas viram `role="button"` com `tabIndex`, respondem a **Enter** e **Espaço** e
têm foco visível. Botões e links dentro da linha continuam funcionando: o handler
ignora o clique quando o alvo é interativo.

> **Armadilha que custou tempo**: como a própria linha ganha `role="button"`, o
> `closest("… , [role='button']")` do guard encontrava a si mesma e cancelava todo
> clique. É preciso excluir `currentTarget` da checagem. O sintoma foi o modal nunca
> abrir, sem erro no console.

## Cobertura atual

Contas a Receber · Contas a Pagar · Contratos · Lançamentos · Clientes e Fornecedores ·
Produtos · Pedidos de Venda · Calendário de Impostos · Caixa de entrada bancária ·
Recorrência e Recompra · DRE (linha de conta abre a conta com seus lançamentos).

Telas que ainda listam registros sem detalhe seguem o mesmo padrão acima — é uma
linha de import e a troca da tag.
