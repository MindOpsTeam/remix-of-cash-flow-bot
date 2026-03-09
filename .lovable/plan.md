

# Fix: Confusão Patrimonial — 5 Correções de Segurança RLS + Triggers

O usuário forneceu SQL pronto com 5 correções de segurança para prevenir confusão patrimonial via RLS e triggers. O plano é executar esse SQL como uma migration.

## Correções

1. **owner_transactions INSERT/UPDATE** — Valida que `pf_account_id` pertence ao usuário e `pj_bank_account_id` pertence à empresa
2. **personal_transfers INSERT/UPDATE** — Valida que `from_account_id` e `to_account_id` pertencem ao usuário
3. **Trigger `update_personal_account_balance`** — Adiciona `AND user_id = OLD/NEW.user_id` nos UPDATEs de saldo
4. **Trigger `update_personal_transfer_balance`** — Mesmo filtro de `user_id` nos UPDATEs de saldo
5. **personal_subcategories policies** — Restringe ao dono da categoria pai

## Implementação

Uma única migration SQL contendo todo o SQL fornecido pelo usuário, sem alterações.

Nenhuma mudança de código frontend necessária — são apenas políticas RLS e funções de trigger.

