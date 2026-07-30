import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

/**
 * O cliente inteiro numa tela.
 *
 * `contacts` já guardava limite de crédito, prazo padrão, endereço e documento,
 * e nada disso era lido depois: nenhuma tela agregava pedidos, notas ou
 * recebíveis por cliente, e `credit_limit` nunca era consultado em lugar
 * nenhum. Cadastro que ninguém lê é formulário, não relacionamento.
 *
 * `atraso_medio_dias` olha só o que JÁ FOI PAGO, porque "ele costuma atrasar" e
 * "ele está atrasado agora" são perguntas diferentes: comportamento e situação.
 */

interface Resumo {
  faturado: number;
  em_aberto: number;
  vencido: number;
  recebido: number;
  titulos: number;
  pedidos: number;
  ticket_medio: number | null;
  atraso_medio_dias: number | null;
  credit_limit: number | null;
  uso_do_limite_pct: number | null;
  ultimo_pedido_em: string | null;
}

const brl = (v: number | null) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function Cliente360({ contactId }: { contactId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["cliente_360", contactId],
    queryFn: async () => {
      const { data } = await supabase
        .from("v_cliente_360" as never)
        .select("*")
        .eq("contact_id", contactId)
        .maybeSingle();
      return (data ?? null) as unknown as Resumo | null;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || (data.pedidos === 0 && data.titulos === 0)) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        Nenhum pedido ou título ainda para este cliente.
      </p>
    );
  }

  const estourou = (data.uso_do_limite_pct ?? 0) > 100;

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        {[
          ["Faturado", brl(data.faturado)],
          ["Em aberto", brl(data.em_aberto)],
          ["Vencido", brl(data.vencido)],
          ["Recebido", brl(data.recebido)],
        ].map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt className="text-xs text-muted-foreground">{rotulo}</dt>
            <dd className="font-medium tabular-nums">{valor}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{data.pedidos} pedido(s)</span>
        <span>·</span>
        <span>{data.titulos} título(s)</span>
        {data.ticket_medio != null && (
          <>
            <span>·</span>
            <span>ticket médio {brl(data.ticket_medio)}</span>
          </>
        )}
        {data.atraso_medio_dias != null && (
          <>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              paga em média {data.atraso_medio_dias > 0
                ? `${data.atraso_medio_dias} dia(s) depois`
                : `${Math.abs(data.atraso_medio_dias)} dia(s) antes`} do vencimento
            </span>
          </>
        )}
        {data.ultimo_pedido_em && (
          <>
            <span>·</span>
            <span>último pedido em {new Date(data.ultimo_pedido_em + "T00:00:00").toLocaleDateString("pt-BR")}</span>
          </>
        )}
      </div>

      {data.credit_limit != null && Number(data.credit_limit) > 0 && (
        <div
          className={`flex items-start gap-2 rounded-md border p-3 text-xs ${
            estourou ? "border-warning/30 bg-warning/[0.08]" : "border-border"
          }`}
        >
          {estourou && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning dark:text-warning" />}
          <p className="text-muted-foreground">
            Limite de crédito {brl(data.credit_limit)} ·{" "}
            <span className={estourou ? "font-medium text-foreground" : ""}>
              {data.uso_do_limite_pct ?? 0}% usado
            </span>
            {estourou && " · este cliente já passou do limite combinado"}
          </p>
        </div>
      )}

      {!data.credit_limit && (
        <Badge variant="outline" className="text-[11px]">
          Sem limite de crédito definido
        </Badge>
      )}
    </div>
  );
}
