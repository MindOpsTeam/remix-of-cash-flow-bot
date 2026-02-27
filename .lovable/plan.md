

# Migration: Auto-update personal_accounts.current_balance

## What will be executed

A single SQL migration containing 5 operations (no frontend changes):

1. **Backfill** - Recalculate `current_balance` for all `personal_accounts` from `initial_balance` + sum of transactions
2. **Trigger function + trigger** on `personal_transactions` - Auto-adjust account balance on INSERT/UPDATE/DELETE
3. **Trigger function + trigger** on `personal_transfers` - Auto-adjust both source and destination account balances
4. **CHECK constraint** on `personal_transfers` - Prevent transfers to the same account (`from_account_id != to_account_id`)
5. **Realtime** - Add `personal_transactions` and `personal_accounts` to `supabase_realtime` publication

## Execution approach

- The entire SQL will be executed as a single database migration
- The backfill runs first (before triggers exist), so no double-counting
- No frontend files will be modified

## Technical details

- Two new functions: `update_personal_account_balance()` and `update_personal_transfer_balance()` (both `SECURITY DEFINER`)
- Two new triggers: `trg_update_personal_account_balance` and `trg_update_personal_transfer_balance`
- One new constraint: `chk_different_accounts`

