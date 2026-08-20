import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

/**
 * O usuário é admin DESTA empresa?
 *
 * Até aqui existia um único helper de papel no banco, `pode_escrever_na_empresa`,
 * que aprovava admin e member igualmente. Não havia como gatear convite de
 * usuário nem a leitura da trilha de auditoria, que existe justamente para o
 * dono conferir o funcionário.
 *
 * A resposta vem do banco, não de um campo no cliente: papel decidido no front
 * é sugestão, não controle. A RLS continua sendo a trava de verdade.
 */
export function useIsAdmin() {
  const { company } = useCompany();

  const { data, isLoading } = useQuery({
    queryKey: ["is_company_admin", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_company_admin", { p_company_id: company!.id });
      if (error) throw error;
      return Boolean(data);
    },
  });

  // Enquanto carrega, trata como NÃO admin: mostrar a tela e escondê-la depois
  // é pior que esperar meio segundo.
  return { isAdmin: data === true, carregando: isLoading };
}
