-- NFS-e Nacional integration configuration
create table if not exists nfse_config (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  -- Certificate (PFX stored as base64)
  cert_pfx_base64 text not null default '',
  cert_password text not null default '',
  -- Parsed info (filled after upload/test)
  cert_cnpj text,
  cert_razao_social text,
  cert_expires_at timestamptz,
  -- Settings
  ambiente text not null default 'homologacao' check (ambiente in ('producao', 'homologacao')),
  serie_dps text not null default '1',
  proximo_numero_dps bigint not null default 1,
  codigo_municipio text,
  inscricao_municipal text,
  -- Status
  active boolean not null default true,
  last_test_at timestamptz,
  last_test_status text,
  last_emission_at timestamptz,
  -- Meta
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id)
);

-- RLS
alter table nfse_config enable row level security;

create policy "Company members can view nfse_config"
  on nfse_config for select
  using (
    exists (
      select 1 from company_members cm
      where cm.company_id = nfse_config.company_id
        and cm.user_id = auth.uid()
    )
  );

create policy "Company admins can manage nfse_config"
  on nfse_config for all
  using (
    exists (
      select 1 from company_members cm
      where cm.company_id = nfse_config.company_id
        and cm.user_id = auth.uid()
        and cm.role in ('owner', 'admin')
    )
  );

-- Updated_at trigger
create trigger nfse_config_updated_at
  before update on nfse_config
  for each row execute function update_updated_at();
