import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSignature, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useIntegrationsStatus } from "@/hooks/useIntegrationsStatus";

const EMISSORES = [
  {
    chave: "nfse" as const,
    nome: "NFS-e Nacional",
    descricao: "Padrão da Receita Federal (ADN), com certificado A1. Municípios já migrados para o padrão nacional.",
    emitir: "/fiscal/nfse/emit",
    configurar: "/settings/integrations/nfse",
  },
  {
    chave: "plugnotas" as const,
    nome: "PlugNotas",
    descricao: "NF-e, NFS-e, NFC-e, CT-e e MDF-e. Provedor completo para municípios fora do padrão nacional.",
    emitir: "/fiscal/plugnotas/emit",
    configurar: "/settings/integrations/plugnotas",
  },
  {
    chave: "focus" as const,
    nome: "Focus NFe",
    descricao: "NF-e, NFS-e e NFC-e com ambiente de homologação e busca do tomador por CNPJ.",
    emitir: "/fiscal/focus/emit",
    configurar: "/settings/integrations/focus",
  },
];

export default function EmissaoNotasPage() {
  const { data: statusIntegracoes } = useIntegrationsStatus();

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em] flex items-center gap-2">
              <FileSignature className="h-6 w-6" /> Emissão de Notas Fiscais
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Escolha o provedor e emita NF-e, NFS-e, NFC-e e outros documentos fiscais.
            </p>
          </div>
          <Link to="/fiscal">
            <Button variant="outline">Ver notas emitidas</Button>
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {EMISSORES.map((e) => {
            const st = statusIntegracoes?.[e.chave];
            return (
              <Card
                key={e.chave}
                className={st?.configurado ? "border-primary/30" : undefined}
              >
                <CardContent className="p-5 flex flex-col gap-3 h-full">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{e.nome}</span>
                    {st?.configurado ? (
                      <Badge className="text-[10px] gap-1">
                        {st.detalhe ? `Pronto · ${st.detalhe}` : "Pronto"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Não configurado
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex-1 leading-5">
                    {e.descricao}
                  </p>
                  <Link to={st?.configurado ? e.emitir : e.configurar}>
                    <Button
                      size="sm"
                      variant={st?.configurado ? "default" : "outline"}
                      className="w-full"
                    >
                      {st?.configurado ? (
                        <>
                          <Plus className="h-4 w-4 mr-1.5" /> Emitir agora
                        </>
                      ) : (
                        "Configurar provedor"
                      )}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
