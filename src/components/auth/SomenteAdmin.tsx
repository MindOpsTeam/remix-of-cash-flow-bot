import type { ReactNode } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/**
 * Barreira de tela para o que é do dono, não do operador.
 *
 * É camada de conveniência, não de segurança: a trava real está na RLS e nas
 * policies. Serve para o funcionário não bater numa tela que vai negar tudo, e
 * para o convite de usuário deixar de ser acessível a qualquer membro.
 */
export function SomenteAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, carregando } = useIsAdmin();

  if (carregando) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="p-8 text-center">
            <ShieldAlert className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Esta área é do administrador da empresa.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Peça a quem administra a conta para liberar o acesso ou executar a ação por você.
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return <>{children}</>;
}
