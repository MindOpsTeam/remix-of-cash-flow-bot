import { mensagemDeErro } from "@/lib/erros";
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Check, FileText, Clock, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * A proposta que o cliente abre.
 *
 * Página pública, sem login. O token da URL é a credencial, então tudo passa
 * por duas funções do banco (`ver_proposta` e `aceitar_proposta`) que rodam com
 * o token e devolvem SÓ o que o comprador precisa ver. A tabela de pedidos
 * continua fechada para o anônimo: o que ele não deveria ver não sai do banco,
 * em vez de sair e ser escondido aqui.
 *
 * Antes disso, "orçamento" era só um status no mesmo registro do pedido. O
 * cliente respondia "fechado" no WhatsApp e alguém tinha que lembrar de mudar
 * o status na mão. O aceite não ficava registrado em lugar nenhum.
 */

interface Item {
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  total: number;
}

interface Proposta {
  estado: "aberta" | "aceita" | "vencida" | "cancelada" | "invalido";
  numero?: number;
  empresa?: string;
  cliente?: string;
  emissao?: string;
  validade?: string;
  subtotal?: number;
  desconto?: number;
  frete?: number;
  total?: number;
  observacoes?: string | null;
  itens?: Item[];
  aceite_em?: string;
  aceite_nome?: string;
}

const brl = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dia = (s?: string | null) => (s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "");

function Aviso({ icone: Icone, titulo, texto }: { icone: typeof Clock; titulo: string; texto: string }) {
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <Icone className="mx-auto h-8 w-8 text-muted-foreground" />
      <h1 className="mt-4 text-lg font-semibold">{titulo}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}

export default function PropostaPublica() {
  const { token } = useParams<{ token: string }>();
  const [proposta, setProposta] = useState<Proposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState("");
  const [aceitando, setAceitando] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("ver_proposta" as never, { p_token: token } as never);
      setProposta(error ? { estado: "invalido" } : ((data ?? { estado: "invalido" }) as unknown as Proposta));
      setCarregando(false);
    })();
  }, [token]);

  async function aceitar() {
    if (nome.trim().length < 3) {
      toast.error("Escreva seu nome completo para aceitar.");
      return;
    }
    setAceitando(true);
    try {
      const { error } = await supabase.rpc("aceitar_proposta" as never, {
        p_token: token,
        p_nome: nome.trim(),
      } as never);
      if (error) throw error;
      setProposta({ estado: "aceita", aceite_nome: nome.trim(), aceite_em: new Date().toISOString() });
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setAceitando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!proposta || proposta.estado === "invalido") {
    return <Aviso icone={Ban} titulo="Proposta não encontrada" texto="Confira o link que você recebeu." />;
  }
  if (proposta.estado === "cancelada") {
    return <Aviso icone={Ban} titulo="Proposta cancelada" texto="Fale com quem enviou para receber uma nova." />;
  }
  if (proposta.estado === "vencida") {
    return (
      <Aviso
        icone={Clock}
        titulo="Proposta vencida"
        texto={`Esta proposta valeu até ${dia(proposta.validade)}. Peça uma atualizada.`}
      />
    );
  }
  if (proposta.estado === "aceita") {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--success))]/15">
          <Check className="h-6 w-6 text-[hsl(var(--success))]" />
        </div>
        <h1 className="mt-4 text-lg font-semibold">Proposta aceita</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aceita por {proposta.aceite_nome}
          {proposta.aceite_em ? ` em ${new Date(proposta.aceite_em).toLocaleString("pt-BR")}` : ""}. Pode fechar
          esta página, já avisamos quem enviou.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span className="text-xs uppercase tracking-wide">Proposta {proposta.numero}</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">{proposta.empresa}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Para {proposta.cliente ?? "você"} · emitida em {dia(proposta.emissao)} · válida até{" "}
          <span className="font-medium text-foreground">{dia(proposta.validade)}</span>
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-4 py-2.5 font-medium">Item</th>
              <th className="px-4 py-2.5 text-right font-medium">Qtd</th>
              <th className="px-4 py-2.5 text-right font-medium">Unitário</th>
              <th className="px-4 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {(proposta.itens ?? []).map((i, n) => (
              <tr key={n} className="border-t border-border">
                <td className="px-4 py-2.5">{i.descricao}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{i.quantidade}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{brl(i.valor_unitario)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{brl(i.total)}</td>
              </tr>
            ))}
            {(proposta.itens ?? []).length === 0 && (
              <tr className="border-t border-border">
                <td colSpan={4} className="px-4 py-4 text-center text-xs text-muted-foreground">
                  Proposta sem itens detalhados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <dl className="mt-4 space-y-1 text-sm">
        {Number(proposta.desconto) > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <dt>Desconto</dt>
            <dd className="tabular-nums">− {brl(proposta.desconto)}</dd>
          </div>
        )}
        {Number(proposta.frete) > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <dt>Frete</dt>
            <dd className="tabular-nums">{brl(proposta.frete)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{brl(proposta.total)}</dd>
        </div>
      </dl>

      {proposta.observacoes && (
        <p className="mt-4 whitespace-pre-line rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
          {proposta.observacoes}
        </p>
      )}

      <section className="mt-8 rounded-lg border border-border p-5">
        <h2 className="text-sm font-medium">Aceitar esta proposta</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Ao aceitar, registramos seu nome, a data e a hora. O pedido é confirmado na hora.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="min-w-[220px] flex-1">
            <Label htmlFor="nome" className="sr-only">Seu nome completo</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome completo"
            />
          </div>
          <Button onClick={aceitar} disabled={aceitando} className="gap-2">
            {aceitando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aceitar proposta
          </Button>
        </div>
      </section>
    </div>
  );
}
