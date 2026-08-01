import { Link } from "react-router-dom";
import { Settings2 } from "lucide-react";
import { usePlataformaStatus } from "@/hooks/usePlataformaStatus";
import { useAdminPlataforma } from "@/hooks/useAdminPlataforma";

/**
 * Lembrete DISCRETO de terminar a configuração da plataforma.
 *
 * Regras de convivência: só aparece para quem pode configurar (admin/dono), só
 * enquanto falta integração, e some sozinho quando tudo estiver ligado. É um
 * link pequeno no topo — sem modal, sem banner, sem badge de erro. Não atrapalha
 * o fluxo de quem só quer trabalhar.
 */
export function BotaoConcluirConfiguracao() {
  const { souDono, feitas, total, configuracaoCompleta, carregando } = usePlataformaStatus();
  const { ehAdmin } = useAdminPlataforma();

  if (carregando || configuracaoCompleta) return null;
  if (!souDono && !ehAdmin) return null;

  return (
    <Link
      to="/settings/plataforma"
      title="Terminar a configuração da plataforma"
      className="hidden items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground sm:inline-flex"
    >
      <Settings2 className="h-3.5 w-3.5" />
      Concluir configuração
      <span className="tabular-nums opacity-70">
        {feitas}/{total}
      </span>
    </Link>
  );
}
