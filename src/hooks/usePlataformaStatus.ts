import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { carregarConfiguradas } from "@/lib/integracoes-io";
import { progressoConfiguracao } from "@/lib/integracoes-catalogo";
import { plataformaBloqueada, souDonoDaPlataforma } from "@/lib/rpc-plataforma";

export interface PlataformaStatus {
  /** Sou o dono da instalação (primeiro usuário cadastrado)? */
  souDono: boolean;
  /** Banco de origem do template: escrita bloqueada. */
  modoTemplate: boolean;
  feitas: number;
  total: number;
  pct: number;
  configuracaoCompleta: boolean;
  carregando: boolean;
}

/**
 * Estado de instalação da plataforma: quem é o dono, se estamos no template
 * travado e quanto da configuração já foi feita. Alimenta o lembrete discreto
 * de "terminar a configuração" — que só aparece enquanto faltar algo.
 */
export function usePlataformaStatus(): PlataformaStatus {
  const { company } = useCompany();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["plataforma-status", company?.id, user?.id],
    enabled: !!company && !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const [souDono, modoTemplate, configuradas] = await Promise.all([
        souDonoDaPlataforma(),
        plataformaBloqueada(),
        carregarConfiguradas(company!.id),
      ]);
      return { souDono, modoTemplate, configuradas };
    },
  });

  const progresso = progressoConfiguracao(data?.configuradas ?? []);

  return {
    souDono: data?.souDono ?? false,
    modoTemplate: data?.modoTemplate ?? false,
    feitas: progresso.feitas,
    total: progresso.total,
    pct: progresso.pct,
    configuracaoCompleta: progresso.feitas >= progresso.total && progresso.total > 0,
    carregando: isLoading,
  };
}
