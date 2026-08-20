-- Cancelamento no provedor precisa chegar na NOTA, nao parar no documento.
--
-- O DEFEITO
-- plugnotas-nfse marcava plugnotas_documents.status='cancelado' e nunca tocava
-- em `invoices`. Como o gatilho que estorna o recebivel escuta invoices, o
-- titulo continuava ativo: o agente de cobranca montava a mensagem e a empresa
-- cobrava por uma nota que ela mesma tinha cancelado.
--
-- Trigger no banco, e nao no handler, porque o polling de status tambem escreve
-- nessa tabela: assim vale para qualquer caminho que cancele.
create or replace function public.propagar_cancelamento_da_nota()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if NEW.status = 'cancelado'
     and NEW.status is distinct from OLD.status
     and NEW.invoice_id is not null then
    update public.invoices
       set status = 'cancelled', updated_at = now()
     where id = NEW.invoice_id
       and status <> 'cancelled';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_propagar_cancelamento_nota on public.plugnotas_documents;
create trigger trg_propagar_cancelamento_nota
  after update of status on public.plugnotas_documents
  for each row execute function public.propagar_cancelamento_da_nota();

revoke execute on function public.propagar_cancelamento_da_nota() from public, anon, authenticated;
