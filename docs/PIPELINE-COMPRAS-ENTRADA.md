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

## Ambiente Nacional (ADN): NFS-e tomada

A **NFS-e** em que a empresa é **tomadora** (serviço contratado) é distribuída pelo **Ambiente
Nacional da NFS-e (ADN)** através da **API DFe**: ela entrega os DF-e a quem tem papel de interesse
na nota (prestador, tomador ou intermediário), por NSU, autenticando com **certificado A1**. Como
mTLS com A1 não roda em edge, o puxão passa pelo **worker** (o mesmo que já emite NFS-e e faz mTLS).

Estado: **preparado**. O slot `sync_nfse` já existe na edge `inbound-documents` e o caminho técnico
está documentado; ligar o puxão automático (worker chamando a API DFe do ADN por NSU + parsing do
XML de NFS-e) é o próximo passo. Enquanto isso, NFS-e tomada entra por **Importar XML** ou **OCR**.

## Ingestão manual (sempre disponível, para os dois ambientes)

Independente de provedor, dá para lançar notas na mão — vale para nota **emitida** (saída) e
**recebida** (entrada), cada uma no seu ambiente:

- **Importar XML** (`ImportarNotaXml`): lê o XML da NF-e/NFS-e e extrai os dados **exatos** (sem OCR).
  A direção sai do **CNPJ da empresa** (`companies.cnpj`): se a empresa é a **emitente**, a nota vira
  `invoices` (saída, abre o recebível pelo trigger); se é a **destinatária/tomadora**, vira
  `inbound_documents` (entrada, para lançar conta a pagar). Idempotente por chave.
- **OCR** (leitor de documentos, `/documents` + edge `ocr-document`, Gemini Vision): escaneia imagem
  ou PDF de boleto, nota, recibo ou comprovante, classifica receita/despesa e cria conta a
  pagar/receber ou lançamento — já roteando nota emitida para Vendas → Notas Fiscais.

Regra de produto: **toda coisa deve permitir ingestão manual**. Aqui isso é o XML (exato) + o OCR
(imagem/PDF), cobrindo emitidas e recebidas.

## Pendências / próximos passos (honesto)

- **NFS-e tomada via ADN (automático)**: `sync_nfse` está reservado; falta o worker chamar a API DFe
  do ADN por NSU e parsear o XML. Por enquanto, NFS-e tomada entra por Importar XML / OCR.
- **Manifestação (MDe)**: hoje o `sync` lê o resumo; automatizar a "Ciência da Operação" para baixar
  o XML completo é uma decisão fiscal (tem peso), deixada para configurar.
- **Vencimento**: a conta a pagar nasce com vencimento = emissão + 30 dias (a consulta resumida não
  traz as duplicatas do XML); o usuário ajusta. Ler as duplicatas do XML completo é refinamento.
- **Validação E2E**: depende de um token Focus com destinadas reais; o fluxo está pronto para rodar
  assim que a Focus estiver configurada na empresa.
