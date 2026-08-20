-- Saldo inicial informado pelo dono.
--
-- O DEFEITO
-- `balance` so e escrito pelo sync do Open Finance. Quem nao usa Pluggy (a
-- maioria) fica com saldo NULO para sempre, e a projecao somava `?? 0`. O
-- runway so e calculado com saldo > 0, entao a narrativa entregue virava
-- "A empresa nao esta queimando caixa no ritmo atual" para uma empresa da qual
-- nao se sabia absolutamente nada. Ausencia de medicao nao pode virar zero, e
-- muito menos virar afago numa tela de financas.
alter table public.bank_accounts
  add column if not exists saldo_inicial numeric(14,2),
  add column if not exists saldo_inicial_data date;

comment on column public.bank_accounts.saldo_inicial is
  'Saldo informado pelo dono na abertura da conta no sistema. Usado quando nao ha sincronizacao bancaria.';
comment on column public.bank_accounts.saldo_inicial_data is
  'Data a que o saldo inicial se refere.';
