import { useCompany } from "@/hooks/useCompany";
import { AsaasIntegrationBase } from "@/components/asaas/AsaasIntegrationBase";

export default function AsaasIntegrationPJ() {
  const { company } = useCompany();

  return (
    <AsaasIntegrationBase
      configTable="company_asaas_config"
      eventsTable="company_asaas_webhook_events"
      edgeFunction="company-asaas-api"
      webhookFunction="company-asaas-webhook"
      ownerKey="company_id"
      ownerId={company?.id}
      backLink="/settings/integrations"
      title="Integração Asaas — Empresa"
      securityIsolationLabel="empresa"
      description="Sincronize cobranças, transferências e notas fiscais da conta empresarial Asaas"
      emailPlaceholder="alertas@suaempresa.com"
    />
  );
}
