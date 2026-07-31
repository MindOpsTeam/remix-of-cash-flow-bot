import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

/**
 * Status ao vivo de cada serviço conectável da empresa.
 *
 * Existe porque a plataforma passou a oferecer muita coisa (três emissores
 * fiscais, Open Finance, cobrança, banco) e a UI mostrava tudo como card
 * estático: não dava para saber o que já está ligado sem entrar em cada tela.
 */
export type ProviderKey = "asaas" | "inter" | "nfse" | "plugnotas" | "focus" | "openfinance" | "contaazul";

export interface ProviderStatus {
  configurado: boolean;
  /** Frase curta para a UI, ex.: "homologação" ou "sandbox". */
  detalhe?: string;
}

export type IntegrationsStatus = Record<ProviderKey, ProviderStatus>;

const VAZIO: IntegrationsStatus = {
  asaas: { configurado: false },
  inter: { configurado: false },
  nfse: { configurado: false },
  plugnotas: { configurado: false },
  focus: { configurado: false },
  openfinance: { configurado: false },
  contaazul: { configurado: false },
};

export function useIntegrationsStatus() {
  const { company } = useCompany();

  return useQuery({
    queryKey: ["integrations_status", company?.id],
    enabled: !!company?.id,
    staleTime: 30_000,
    queryFn: async (): Promise<IntegrationsStatus> => {
      const id = company!.id;
      const tabela = (nome: string, colunas: string) =>
        supabase.from(nome as never).select(colunas).eq("company_id", id).maybeSingle();

      const [asaas, inter, nfse, plugnotas, focus, openfinance, contaazul] = await Promise.all([
        tabela("company_asaas_config", "company_id"),
        tabela("inter_config", "active"),
        tabela("nfse_config", "active, cert_pfx_base64"),
        tabela("plugnotas_config", "active, api_key, environment"),
        tabela("focus_config", "active, environment, token_homologacao_preview, token_producao_preview"),
        tabela("openfinance_config", "active, sandbox, client_id_preview"),
        tabela("contaazul_config", "ativo, client_id_preview"),
      ]);

      const d = <T,>(r: { data: unknown }) => (r.data ?? null) as T | null;

      const f = d<{
        active: boolean; environment: string;
        token_homologacao_preview: string | null; token_producao_preview: string | null;
      }>(focus);
      const temTokenFocus = f
        ? Boolean(f.environment === "producao" ? f.token_producao_preview : f.token_homologacao_preview)
        : false;

      const p = d<{ active: boolean; api_key: string; environment: string }>(plugnotas);
      const n = d<{ active: boolean; cert_pfx_base64: string | null }>(nfse);
      const of = d<{ active: boolean; sandbox: boolean; client_id_preview: string | null }>(openfinance);
      const i = d<{ active: boolean }>(inter);
      const ca = d<{ ativo: boolean; client_id_preview: string | null }>(contaazul);

      return {
        asaas: { configurado: !!asaas.data },
        inter: { configurado: !!i?.active },
        nfse: { configurado: !!n?.active && !!n?.cert_pfx_base64, detalhe: "certificado A1" },
        plugnotas: {
          configurado: !!p?.active && !!p?.api_key,
          detalhe: p?.environment === "sandbox" ? "sandbox" : undefined,
        },
        focus: {
          configurado: !!f?.active && temTokenFocus,
          detalhe: f?.environment === "homologacao" ? "homologação" : undefined,
        },
        openfinance: {
          configurado: !!of?.active && !!of?.client_id_preview,
          detalhe: of?.sandbox ? "sandbox" : undefined,
        },
        contaazul: { configurado: !!ca?.ativo && !!ca?.client_id_preview },
      };
    },
    initialData: VAZIO,
  });
}
