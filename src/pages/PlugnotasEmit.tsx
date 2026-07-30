/**
 * Emissão de documentos fiscais via PlugNotas — UI de produção.
 * Tabs por tipo, cada um com formulário estruturado.
 */

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileText, Settings as SettingsIcon, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { DOC_LABEL, formatDocument, type PlugnotasDocType } from "@/lib/plugnotas";
import { NfseForm } from "@/components/plugnotas/NfseForm";
import { NfeForm } from "@/components/plugnotas/NfeForm";
import { NfceForm } from "@/components/plugnotas/NfceForm";
import { CteForm } from "@/components/plugnotas/CteForm";
import { MdfeForm } from "@/components/plugnotas/MdfeForm";
import { EmissionHistory } from "@/components/plugnotas/EmissionHistory";

interface PlugnotasConfig {
  active: boolean;
  environment: "sandbox" | "producao";
  plugnotas_empresa_cnpj: string | null;
  enabled_nfe: boolean;
  enabled_nfse: boolean;
  enabled_nfce: boolean;
  enabled_cte: boolean;
  enabled_mdfe: boolean;
  serie_padrao: string | null;
}

export default function PlugnotasEmitPage() {
  const { company } = useCompany();
  const [activeTab, setActiveTab] = useState<PlugnotasDocType>("nfse");

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["plugnotas_config", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("plugnotas_config")
        .select("*")
        .eq("company_id", company!.id)
        .maybeSingle();
      return data as PlugnotasConfig | null;
    },
  });

  const isEnabled = (t: PlugnotasDocType): boolean => {
    if (!config) return false;
    switch (t) {
      case "nfse": return config.enabled_nfse;
      case "nfe":  return config.enabled_nfe;
      case "nfce": return config.enabled_nfce;
      case "cte":  return config.enabled_cte;
      case "mdfe": return config.enabled_mdfe;
    }
  };

  const availableTabs: PlugnotasDocType[] = (["nfse", "nfe", "nfce", "cte", "mdfe"] as PlugnotasDocType[]).filter(isEnabled);

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTabs.join(",")]);

  if (configLoading) {
    return <AppLayout><div className="text-sm text-muted-foreground py-8">Carregando...</div></AppLayout>;
  }

  if (!config || !config.active) {
    return (
      <AppLayout>
        <div className="space-y-6 animate-fade-in max-w-2xl">
          <div className="flex items-center gap-3">
            <Link to="/fiscal">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-[-0.02em] flex items-center gap-2">
              <FileText className="h-6 w-6" /> PlugNotas
            </h1>
          </div>
          <Card className="border-warning/30 bg-warning/[0.08] dark:bg-warning/[0.08] dark:border-warning/30">
            <CardContent className="py-5 px-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-warning dark:text-warning">
                    {config ? "Integração inativa" : "PlugNotas não configurado"}
                  </p>
                  <p className="text-xs text-warning dark:text-warning">
                    {config
                      ? "Reative a integração nas configurações antes de emitir."
                      : "Configure a integração antes de emitir documentos fiscais."}
                  </p>
                  <Link to="/settings/integrations/plugnotas">
                    <Button size="sm" variant="outline" className="mt-1 gap-2">
                      <SettingsIcon className="h-4 w-4" /> Abrir configurações
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!config.plugnotas_empresa_cnpj) {
    return (
      <AppLayout>
        <div className="space-y-6 animate-fade-in max-w-2xl">
          <div className="flex items-center gap-3">
            <Link to="/fiscal">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-[-0.02em]">PlugNotas</h1>
          </div>
          <Card className="border-warning/30 bg-warning/[0.08] dark:bg-warning/[0.08] dark:border-warning/30">
            <CardContent className="py-5 px-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-warning dark:text-warning">
                    Empresa emissora não vinculada
                  </p>
                  <p className="text-xs text-warning dark:text-warning">
                    Para emitir documentos, vincule o CNPJ da empresa nas configurações e envie o certificado A1.
                  </p>
                  <Link to="/settings/integrations/plugnotas">
                    <Button size="sm" variant="outline" className="mt-1 gap-2">
                      <SettingsIcon className="h-4 w-4" /> Abrir configurações
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const cnpj = config.plugnotas_empresa_cnpj;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Link to="/fiscal">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-[-0.02em] flex items-center gap-2">
                <FileText className="h-6 w-6" /> Emitir nota fiscal
              </h1>
              <Badge variant="outline" className="capitalize">{config.environment}</Badge>
              <Badge variant="secondary" className="font-mono text-[11px]">
                {formatDocument(cnpj)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Provedor: PlugNotas · Documentos habilitados: {availableTabs.map((t) => DOC_LABEL[t]).join(", ") || "nenhum"}
            </p>
          </div>
          <Link to="/settings/integrations/plugnotas">
            <Button variant="outline" size="sm" className="gap-2">
              <SettingsIcon className="h-4 w-4" /> Configurações
            </Button>
          </Link>
        </div>

        {availableTabs.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum tipo de documento habilitado para emissão.{" "}
                <Link to="/settings/integrations/plugnotas" className="text-primary hover:underline">
                  Habilitar nas configurações
                </Link>.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PlugnotasDocType)}>
            <TabsList className="mb-4">
              {availableTabs.map((t) => (
                <TabsTrigger key={t} value={t}>{DOC_LABEL[t]}</TabsTrigger>
              ))}
            </TabsList>

            {availableTabs.includes("nfse") && (
              <TabsContent value="nfse">
                <NfseForm prestadorCnpj={cnpj} inscricaoMunicipalDefault={config.serie_padrao ?? undefined} />
              </TabsContent>
            )}
            {availableTabs.includes("nfe") && (
              <TabsContent value="nfe">
                <NfeForm emitenteCnpj={cnpj} />
              </TabsContent>
            )}
            {availableTabs.includes("nfce") && (
              <TabsContent value="nfce">
                <NfceForm emitenteCnpj={cnpj} />
              </TabsContent>
            )}
            {availableTabs.includes("cte") && (
              <TabsContent value="cte">
                <CteForm emitenteCnpj={cnpj} />
              </TabsContent>
            )}
            {availableTabs.includes("mdfe") && (
              <TabsContent value="mdfe">
                <MdfeForm emitenteCnpj={cnpj} />
              </TabsContent>
            )}
          </Tabs>
        )}

        <EmissionHistory />
      </div>
    </AppLayout>
  );
}
