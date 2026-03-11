

# Corrigir recebimento de mensagens próprias no WhatsApp

## Problema

Na linha 27 do `whatsapp-webhook/index.ts`, existe um filtro que descarta qualquer mensagem com `key.fromMe === true`:

```typescript
if (key?.fromMe) {
  return new Response(JSON.stringify({ ok: true, skipped: "fromMe" }), { ... });
}
```

Quando você envia uma mensagem **para si mesmo**, a Evolution API marca essa mensagem como `fromMe: true`, fazendo com que o webhook a ignore completamente. Por isso nada acontece.

## Solução

Remover o bloqueio de `fromMe`. Mensagens enviadas para si mesmo devem ser processadas normalmente pelo agente financeiro.

O filtro de `fromMe` existia para evitar que mensagens enviadas **pelo próprio bot** (respostas automáticas) fossem reprocessadas em loop. Porém, as respostas do bot são enviadas via API (não pelo WhatsApp do celular), então a Evolution API não as reenvia como webhook — logo, o filtro é desnecessário e causa esse bug.

### Arquivo afetado

- `supabase/functions/whatsapp-webhook/index.ts` — remover o bloco `if (key?.fromMe)` (linhas 27-31)

