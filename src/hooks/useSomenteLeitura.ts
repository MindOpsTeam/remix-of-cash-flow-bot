import { useAuth } from "@/hooks/useAuth";
import { useAdminPlataforma } from "@/hooks/useAdminPlataforma";
import { usePlataformaStatus } from "@/hooks/usePlataformaStatus";
import { isDemoUser } from "@/lib/demo";

export interface SomenteLeitura {
  /** Escrever é impossível neste contexto. */
  bloqueado: boolean;
  /** Por que — em linguagem de usuário, pronto para tooltip/aviso. */
  motivo: string;
  /** Rótulo curto para badge. */
  rotulo: string;
}

/**
 * Diz, ANTES do clique, se a escrita é possível.
 *
 * Sem isso o produto oferece um botão que só produz erro: o usuário clica em
 * "Ativar", o banco recusa por RLS e ele recebe uma mensagem de Postgres na
 * cara. Oferecer ação impossível é pior do que não oferecer — some a ação ou
 * explique por que ela está indisponível.
 */
export function useSomenteLeitura(): SomenteLeitura {
  const { user } = useAuth();
  const { papel } = useAdminPlataforma();
  const { modoTemplate } = usePlataformaStatus();

  if (isDemoUser(user?.email)) {
    return {
      bloqueado: true,
      rotulo: "Demonstração",
      motivo:
        "Você está na conta de demonstração, que é somente leitura. Crie a sua conta para ativar, editar e lançar.",
    };
  }

  if (modoTemplate) {
    return {
      bloqueado: true,
      rotulo: "Projeto modelo",
      motivo:
        "Este é o projeto original, aberto apenas para consulta. Faça o remix para ter o seu ambiente com todas as ações liberadas.",
    };
  }

  if (papel === "viewer") {
    return {
      bloqueado: true,
      rotulo: "Somente leitura",
      motivo: "Seu perfil nesta empresa é somente leitura. Um administrador pode liberar o acesso de edição.",
    };
  }

  return { bloqueado: false, rotulo: "", motivo: "" };
}
