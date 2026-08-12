# Pipeline de compras: notas de entrada → contas a pagar → conciliação (2026-08-12)

Fecha o lado das compras, espelhando o das vendas. Assim como a venda faz
`nota → recebível → extrato → baixa`, a compra faz
`nota destinada → conta a pagar → extrato → baixa`.

## De onde vêm as notas de entrada (distribuição de DF-e)

Notas emitidas **contra** o seu CNPJ. Endpoints reais por via:

| Documento | Via | Endpoint / mecanismo |
|---|---|---|
| **NF-e** (mercadoria) | Ambiente Nacional (SEFAZ) | Web service **NFeDistribuicaoDFe** (NT 2014.002), por NSU, com certificado A1. + Manifestação do Destinatário (MDe). |
| **NF-e** | **Focus NFe** | `GET /v2/nfes_recebidas` (notas destinadas) + manifestação. **Já plugado** (edge `focus-nfe`, tokens no Vault). |
| **NF-e** | PlugNotas/Tecnospeed | `nfe.config.dfe.ativo = true` → consulta automática das destinadas a cada ~1h20, com Ciência da Operação e download do XML. |
| **NFS-e** (serviço tomado) | Ambiente Nacional NFS-e (ADN) | **API DFe** distribui as NFS-e ao **tomador** (mesmo certificado A1 do worker). |
| **NFS-e** | PlugNotas | "NFS-e Nacional: Consulta Distribuição DF-e". |

Nota sobre a MDe: o resumo vem automático, mas o **XML completo** da NF-e geralmente exige
manifestar ao menos "Ciência da Operação". Focus e PlugNotas automatizam essa Ciência.

## O que foi implementado

### Schema
- `inbound_documents`: nota de entrada (tipo, chave, emitente, valor, data, nsu, manifestação, xml,
  status `pendente|lancado|ignorado`, `bill_id` → `bills_payable`). Único por `(company_id, chave)`
  (idempotente). RLS espelhando o padrão da casa.
- `bills_payable` ganhou `transaction_id` e `payment_date` (baixa por conciliação).

### Edge `inbound-documents`
- `sync_nfe`: baixa as NF-e destinadas na **Focus** (`/nfes_recebidas`, path configurável), faz
  upsert idempotente em `inbound_documents`. Token no Vault, escrita barra viewer.
- `to_bill`: transforma a nota em **conta a pagar** (`bills_payable`), reaproveitando o contato do
  fornecedor pelo CNPJ; idempotente (não duplica se já lançada).
- `ignore`: descarta a nota da lista de pendências.

### Conciliação de débitos (edge `reconcile-transactions`)
- `suggest_payables`: casa **débito do extrato** com **conta a pagar em aberto** (valor ±5%, janela
  de 15 dias do vencimento, contato).
- `settle_payable`: dá baixa na conta a pagar usando o **débito real do extrato** (liga
  `transaction_id`, marca `pago` + `payment_date`, concilia a transação). Idempotente.

### UI
- **Contas a Pagar**: seção "Notas recebidas (entrada)" com botão "Buscar notas contra meu CNPJ"
  (sync) e, por nota, "Lançar conta a pagar" / "Ignorar".
- **Conciliação bancária**: "Pagamentos a dar baixa" (espelho de "Recebimentos a dar baixa").

## Ciclo completo do ERP (vendas + compras)

```
VENDA:  produto/serviço → pedido → NOTA (emitida) → recebível → extrato(crédito) → baixa
COMPRA: fornecedor → NOTA DESTINADA → conta a pagar → extrato(débito) → baixa
                       (Focus/ADN)     (inbound_documents)  (conciliação)
```

## Pendências / próximos passos (honesto)

- **NFS-e tomada**: o schema já aceita `tipo='nfse'`, mas o `sync` atual cobre NF-e via Focus. O
  puxão das NFS-e tomadas via ADN (mesmo certificado A1 do worker) é o próximo `sync_nfse`.
- **Manifestação (MDe)**: hoje o `sync` lê o resumo; automatizar a "Ciência da Operação" para baixar
  o XML completo é uma decisão fiscal (tem peso), deixada para configurar.
- **Vencimento**: a conta a pagar nasce com vencimento = emissão + 30 dias (a consulta resumida não
  traz as duplicatas do XML); o usuário ajusta. Ler as duplicatas do XML completo é refinamento.
- **Validação E2E**: depende de um token Focus com destinadas reais; o fluxo está pronto para rodar
  assim que a Focus estiver configurada na empresa.
