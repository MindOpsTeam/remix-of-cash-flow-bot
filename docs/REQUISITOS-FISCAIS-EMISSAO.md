# Requisitos fiscais por documento e como o catálogo alimenta cada emissão (2026-08-11)

O cadastro único **Produtos e Serviços** (`products`, com `type` = `product` ou `service`) é a fonte
dos dados fiscais de todas as emissões. Este doc mapeia o que cada documento exige e de onde vem.

## Cadastro (products): campos fiscais

| Campo | Para | Usado por |
|---|---|---|
| `ncm` | produto | NF-e, NFC-e (PlugNotas) |
| `cfop` | produto | NF-e, NFC-e |
| `tax_origin` (origem) | produto | NF-e, NFC-e |
| `cclasstrib` (cClassTrib Reforma) | produto | NF-e, NFC-e (IBS/CBS) |
| `codigo_trib_nac` (cTribNac) | serviço | **NFS-e Nacional (worker)** |
| `codigo_servico_municipal` | serviço | NFS-e PlugNotas (cód. trib. município) |
| `item_lista_servico` (LC 116) | serviço | NFS-e PlugNotas, NFS-e Focus |
| `aliquota_iss` | serviço | NFS-e PlugNotas, Focus |
| `nbs` | serviço | NFS-e (opcional) |
| `cnae` | serviço | referência da atividade |

## Requisitos por documento

### NF-e e NFC-e (produto) — via PlugNotas
- Item: **produto** do catálogo. Puxa via `ProductPicker`: descrição, NCM, CFOP, origem, unidade,
  preço, cClassTrib (Reforma).
- Ainda no catálogo? CST/CSOSN e GTIN/EAN não existem como coluna dedicada; hoje entram no form da
  emissão quando exigidos. (Evolução futura: adicionar ao catálogo.)
- **Status: já fluía** do catálogo (ProductPicker já era usado nos dois forms).

### NFS-e Nacional (serviço) — via worker próprio (Railway → SEFIN)
- Item: **serviço** do catálogo. Obrigatório: `codigo_trib_nac` (cTribNac), descrição, valor.
- Regime (`optante_simples`) vem de `nfse_config`; define `opSimpNac` e a totalização de tributos
  (não-optante usa `vTotTrib`, corrigido no worker — rejeição E0713).
- **Status: conectado** — `NfseEmit` tem o seletor "Serviço cadastrado" que preenche código,
  descrição e valor.

### NFS-e (serviço) — via PlugNotas
- Obrigatório: **código de tributação do município** (`codigo_servico_municipal`), **item da lista
  LC 116** (`item_lista_servico`), alíquota ISS, discriminação, valor.
- **Status: conectado** — o `ProductPicker` do `NfseForm` agora preenche esses três campos além de
  descrição e valor.

### NFS-e (serviço) — via Focus
- Obrigatório: **item da lista de serviço** (`item_lista_servico`), valor; alíquota ISS e descrição
  complementam.
- **Status: conectado** — adicionado `ProductPicker` (serviço) no `FocusEmit`, preenchendo
  discriminação, valor, item da lista e alíquota.

## Resumo do que mudou nesta entrega

1. `products` ganhou os campos fiscais de serviço (`codigo_trib_nac`, `codigo_servico_municipal`,
   `item_lista_servico`, `aliquota_iss`, `nbs`, `cnae`) — antes só tinha os de produto.
2. `ProductPicker` (que já alimentava NF-e/NFC-e) passou a **carregar também os campos de serviço**,
   então serve as três vias de NFS-e.
3. Os forms de NFS-e do **PlugNotas** e do **Focus** passaram a preencher os campos de serviço a
   partir do catálogo (antes só descrição/valor, ou digitação manual no Focus).
4. A tela **Produtos e Serviços** cadastra tudo isso num lugar só: produto (NCM/CFOP/cClassTrib) e
   serviço (cTribNac/código municipal/LC116/ISS/NBS/CNAE).

## O que NÃO está no catálogo ainda (entra na emissão, evolução futura)
- Produto: CST/CSOSN, GTIN/EAN, unidade tributável, valores de tributos aproximados por item.
- Tabelas oficiais com busca (códigos de tributação nacional, lista LC 116) para escolher em vez de
  digitar. Hoje os códigos são de digitação livre no cadastro.
