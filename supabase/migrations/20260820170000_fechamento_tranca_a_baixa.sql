-- Baixa de titulo datada dentro de mes FECHADO tambem precisa ser barrada.
--
-- O DEFEITO
-- A trava de fechamento existia so em `transactions`. `aplicar_baixa_titulo`
-- escreve em `title_payments` com uma data escolhida por quem opera: em
-- fevereiro dava para registrar um recebimento datado de janeiro, ja fechado, e
-- a posicao de caixa do mes entregue mudava depois de entregue.
create or replace function public.bloquear_baixa_em_mes_fechado()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_data date;
  v_empresa uuid;
begin
  if tg_op = 'DELETE' then
    v_data := OLD.paid_at; v_empresa := OLD.company_id;
  else
    v_data := NEW.paid_at; v_empresa := NEW.company_id;
  end if;

  if public.mes_esta_fechado(v_empresa, v_data) then
    raise exception 'O mês % está fechado. Reabra o fechamento para registrar baixa nesse período.',
      to_char(v_data, 'MM/YYYY') using errcode = '23514';
  end if;

  -- Numa alteracao, o mes de ORIGEM tambem conta: mover a baixa para fora de um
  -- mes fechado burla o fechamento do mesmo jeito.
  if tg_op = 'UPDATE' and public.mes_esta_fechado(OLD.company_id, OLD.paid_at) then
    raise exception 'O mês % está fechado. Não dá para alterar uma baixa desse período.',
      to_char(OLD.paid_at, 'MM/YYYY') using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

drop trigger if exists trg_bloquear_baixa_mes_fechado on public.title_payments;
create trigger trg_bloquear_baixa_mes_fechado
  before insert or update or delete on public.title_payments
  for each row execute function public.bloquear_baixa_em_mes_fechado();

revoke execute on function public.bloquear_baixa_em_mes_fechado() from public, anon, authenticated;
