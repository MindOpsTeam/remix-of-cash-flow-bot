import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { souDonoDaPlataforma } from "@/lib/rpc-plataforma";

export interface AdminPlataforma {
  /** Papel do usuário atual na empresa em foco. */
  papel: "admin" | "member" | "viewer" | null;
  ehAdmin: boolean;
  /** É o primeiro membro da empresa — quem instalou a plataforma. */
  ehPrimeiroUsuario: boolean;
  memberId: string | null;
  onboardingCompleto: boolean;
  carregando: boolean;
}

/**
 * Quem é o dono da instalação. O wizard de configuração da plataforma pede
 * chaves e liga integrações que valem para a empresa inteira, então ele é
 * apresentado ao ADMIN — e o primeiro membro cadastrado (quem criou a conta)
 * é tratado como o administrador da plataforma.
 */
export function useAdminPlataforma(): AdminPlataforma {
  const { user } = useAuth();
  const { company } = useCompany();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-plataforma", user?.id, company?.id],
    enabled: !!user && !!company,
    staleTime: 60_000,
    queryFn: async () => {
      // Membros da empresa em ordem de entrada: o primeiro é quem instalou.
      const { data: membros, error } = await supabase
        .from("company_members")
        .select("id, user_id, role, onboarding_completed, created_at")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const lista = membros ?? [];
      const meu = lista.find((m) => m.user_id === user!.id) ?? null;
      const primeiro = lista[0] ?? null;

      // A posse da instalação é explícita (platform_owner, gravada no 1º
      // cadastro). O "membro mais antigo" fica só como retaguarda para bases
      // criadas antes dessa tabela existir.
      const souDono = await souDonoDaPlataforma();

      return {
        papel: (meu?.role ?? null) as AdminPlataforma["papel"],
        memberId: meu?.id ?? null,
        onboardingCompleto: !!meu?.onboarding_completed,
        ehPrimeiroUsuario: souDono || (!!meu && !!primeiro && meu.id === primeiro.id),
      };
    },
  });

  return {
    papel: data?.papel ?? null,
    ehAdmin: data?.papel === "admin",
    ehPrimeiroUsuario: data?.ehPrimeiroUsuario ?? false,
    memberId: data?.memberId ?? null,
    onboardingCompleto: data?.onboardingCompleto ?? false,
    carregando: isLoading,
  };
}
