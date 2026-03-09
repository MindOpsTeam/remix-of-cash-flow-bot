import { useAuth } from "@/hooks/useAuth";
import { AsaasIntegrationBase } from "@/components/asaas/AsaasIntegrationBase";

export default function AsaasIntegrationPF() {
  const { user } = useAuth();

  return (
    <AsaasIntegrationBase
      configTable="asaas_config"
      eventsTable="asaas_webhook_events"
      edgeFunction="asaas-api"
      webhookFunction="asaas-webhook"
      ownerKey="user_id"
      ownerId={user?.id}
      backLink="/personal/settings/integrations"
      title="Integração Asaas — Pessoal"
      securityIsolationLabel="usuário"
      description="Sincronize cobranças, transferências e pagamentos da sua conta pessoal Asaas"
      emailPlaceholder="seuemail@pessoal.com"
    />
  );
}
