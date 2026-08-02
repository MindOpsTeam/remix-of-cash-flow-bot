-- Quantas configurações cada integração aceita por empresa, e POR QUÊ.
--
-- Sem isto registrado, a próxima pessoa olha `focus_config_company_id_key` e
-- conclui que é limitação a corrigir — quando na verdade é a modelagem certa.
-- Emissor fiscal está amarrado a CNPJ + certificado digital: uma empresa não tem
-- dois. Já Stripe e WhatsApp são canais, e canal é plural por natureza.
--
-- A regra que separa os dois grupos: se a coisa configurada é uma IDENTIDADE
-- LEGAL da empresa, é 1. Se é um CANAL por onde dinheiro ou mensagem passa, é N.

COMMENT ON CONSTRAINT focus_config_company_id_key ON public.focus_config IS
  '1 por empresa DE PROPÓSITO: emissor fiscal é identidade legal (CNPJ + certificado), não canal. Não transformar em N.';

COMMENT ON CONSTRAINT plugnotas_config_company_id_key ON public.plugnotas_config IS
  '1 por empresa DE PROPÓSITO: emissor fiscal é identidade legal (CNPJ + certificado), não canal. Não transformar em N.';

COMMENT ON CONSTRAINT nfse_config_company_id_key ON public.nfse_config IS
  '1 por empresa DE PROPÓSITO: NFS-e depende do certificado e da inscrição municipal do CNPJ. Não transformar em N.';

COMMENT ON CONSTRAINT company_asaas_config_company_id_key ON public.company_asaas_config IS
  '1 por empresa HOJE, por ausência de demanda — não por impedimento. Se aparecer o caso de duas contas Asaas, seguir o padrão de stripe_config: unique (company_id, apelido) e segredo no cofre nomeado pelo id da config.';

COMMENT ON CONSTRAINT inter_config_company_id_key ON public.inter_config IS
  '1 por empresa HOJE, por ausência de demanda. Contas bancárias plurais já são cobertas por bank_connections/bank_accounts; isto aqui é a credencial da API do Inter.';

COMMENT ON CONSTRAINT contaazul_config_company_id_key ON public.contaazul_config IS
  '1 por empresa DE PROPÓSITO: é a conta do ERP de origem numa migração de dados, não um canal recorrente.';

COMMENT ON TABLE public.bank_connections IS
  'N por empresa: unique em (company_id, provider, external_id). Uma empresa pode ter várias contas em vários bancos — é o caso comum, não a exceção.';

COMMENT ON TABLE public.stripe_config IS
  'N canais por empresa: unique em (company_id, apelido). "Loja SP" e "Checkout site" são canais distintos, cada um com chave própria no cofre (nomeada pelo id DESTA linha) e webhook próprio.';

COMMENT ON TABLE public.whatsapp_configs IS
  'N canais por empresa: unique em (company_id, instance_name). Comercial e cobrança podem ter números diferentes.';
