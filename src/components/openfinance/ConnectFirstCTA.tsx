import { Link } from "react-router-dom";
import { Building2, Inbox, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBankConnections } from "@/hooks/useBankConnections";
import { ImportarExtrato } from "@/components/importar/ImportarExtrato";

/**
 * O caminho certo primeiro: conectar o banco. O extrato entra sozinho e a IA
 * classifica. Colar texto continua existindo, mas como fallback discreto para
 * quem ainda não conectou nada — nunca como o convite principal.
 */
interface ConnectFirstCTAProps {
  /** Chamado quando o fallback de colagem importa lançamentos. */
  onImportado?: () => void;
  titulo?: string;
  descricao?: string;
}

export function ConnectFirstCTA({ onImportado, titulo, descricao }: ConnectFirstCTAProps) {
  const { connections, pendingCount } = useBankConnections();
  const conectado = connections.length > 0;

  return (
    <div className="mx-auto max-w-md text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
        {conectado ? <Inbox className="h-5 w-5" strokeWidth={1.6} /> : <Building2 className="h-5 w-5" strokeWidth={1.6} />}
      </div>
      <p className="text-sm font-medium text-foreground">
        {titulo ?? (conectado ? "Extrato sincronizado, falta revisar" : "Conecte o banco e o extrato entra sozinho")}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {descricao ??
          (conectado
            ? `Há ${pendingCount} transação(ões) do banco aguardando a sua revisão para entrar no resultado.`
            : "Via Open Finance, os lançamentos chegam todo dia e a IA classifica. Você só confere.")}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {conectado ? (
          <Button asChild className="gap-2">
            <Link to="/bank-inbox">
              <Inbox className="h-4 w-4" />
              Revisar extrato bancário
              {pendingCount > 0 && (
                <span className="rounded-sm bg-primary-foreground/15 px-1.5 text-xs tabular-nums">{pendingCount}</span>
              )}
            </Link>
          </Button>
        ) : (
          <Button asChild className="gap-2">
            <Link to="/settings/bank-accounts">
              <Building2 className="h-4 w-4" />
              Conectar banco
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link to="/settings/integrations">
            Outras integrações
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <div className="mt-3">
        <ImportarExtrato
          onImportado={onImportado}
          trigger={
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
            >
              ou cole um extrato manualmente
            </button>
          }
        />
      </div>
    </div>
  );
}
