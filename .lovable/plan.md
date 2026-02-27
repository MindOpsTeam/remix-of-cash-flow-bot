
# Deploy de 2 Edge Functions: ocr-document + whatsapp-webhook

## Problema
As funcoes `ocr-document` e `whatsapp-webhook` existem no codigo mas:
1. Nao estao registradas no `supabase/config.toml`
2. Nao foram deployadas

## Alteracoes

### 1. Atualizar `supabase/config.toml`
Adicionar entradas para ambas as funcoes com `verify_jwt = false`:
- `ocr-document`: precisa ser chamada pelo frontend (que envia o token via header, mas a validacao e feita no codigo)
- `whatsapp-webhook`: recebe chamadas externas da Evolution API, nao tem JWT

```text
[functions.ocr-document]
verify_jwt = false

[functions.whatsapp-webhook]
verify_jwt = false
```

### 2. Deploy
Deployar ambas as funcoes: `ocr-document` e `whatsapp-webhook`.

### Nenhuma outra alteracao
O codigo das funcoes ja esta correto e nao sera modificado.
