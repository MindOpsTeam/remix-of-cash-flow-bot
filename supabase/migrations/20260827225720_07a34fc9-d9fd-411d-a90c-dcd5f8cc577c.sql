-- =========================================================
-- Módulo STAY — hospedagem por temporada
-- =========================================================

-- Empreendimentos -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stay_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  city text,
  neighborhood text,
  state text,
  kind text NOT NULL DEFAULT 'predio',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stay_properties TO authenticated;
GRANT ALL ON public.stay_properties TO service_role;
ALTER TABLE public.stay_properties ENABLE ROW LEVEL SECURITY;

-- Unidades ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stay_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.stay_properties(id) ON DELETE CASCADE,
  code text NOT NULL,
  typology text,
  capacity integer NOT NULL DEFAULT 2,
  owner_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  payout_model text NOT NULL DEFAULT 'percentual',
  payout_percent numeric(6,3) NOT NULL DEFAULT 20,
  payout_fixed numeric(14,2),
  cleaning_fee numeric(14,2) NOT NULL DEFAULT 0,
  cleaning_cost numeric(14,2) NOT NULL DEFAULT 0,
  base_rate numeric(14,2),
  status text NOT NULL DEFAULT 'ativa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stay_units_unica UNIQUE (property_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stay_units TO authenticated;
GRANT ALL ON public.stay_units TO service_role;
ALTER TABLE public.stay_units ENABLE ROW LEVEL SECURITY;

-- Canais --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stay_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  commission_percent numeric(6,3) NOT NULL DEFAULT 0,
  payment_fee_percent numeric(6,3) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stay_channels_unico UNIQUE (company_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stay_channels TO authenticated;
GRANT ALL ON public.stay_channels TO service_role;
ALTER TABLE public.stay_channels ENABLE ROW LEVEL SECURITY;

-- Tipos de taxa -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stay_fee_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'extra',
  nature text NOT NULL DEFAULT 'receita',
  default_amount numeric(14,2) NOT NULL DEFAULT 0,
  taxable boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stay_fee_types_unico UNIQUE (company_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stay_fee_types TO authenticated;
GRANT ALL ON public.stay_fee_types TO service_role;
ALTER TABLE public.stay_fee_types ENABLE ROW LEVEL SECURITY;

-- Reservas ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stay_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.stay_units(id) ON DELETE RESTRICT,
  channel_id uuid REFERENCES public.stay_channels(id) ON DELETE SET NULL,
  guest_name text NOT NULL,
  guest_document text,
  guest_email text,
  guest_phone text,
  external_code text,
  check_in date NOT NULL,
  check_out date NOT NULL,
  nights integer NOT NULL DEFAULT 1,
  guests integer NOT NULL DEFAULT 1,
  nightly_rate numeric(14,2) NOT NULL DEFAULT 0,
  lodging_total numeric(14,2) NOT NULL DEFAULT 0,
  cleaning_fee numeric(14,2) NOT NULL DEFAULT 0,
  extras_total numeric(14,2) NOT NULL DEFAULT 0,
  gross_total numeric(14,2) NOT NULL DEFAULT 0,
  channel_commission numeric(14,2) NOT NULL DEFAULT 0,
  payment_fee numeric(14,2) NOT NULL DEFAULT 0,
  taxes numeric(14,2) NOT NULL DEFAULT 0,
  cleaning_cost numeric(14,2) NOT NULL DEFAULT 0,
  owner_payout numeric(14,2) NOT NULL DEFAULT 0,
  net_total numeric(14,2) NOT NULL DEFAULT 0,
  deposit numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'confirmada',
  payment_status text NOT NULL DEFAULT 'pendente',
  source text NOT NULL DEFAULT 'manual',
  notes text,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stay_reservations_periodo CHECK (check_out > check_in)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stay_reservations TO authenticated;
GRANT ALL ON public.stay_reservations TO service_role;
ALTER TABLE public.stay_reservations ENABLE ROW LEVEL SECURITY;

-- Itens da reserva ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stay_reservation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES public.stay_reservations(id) ON DELETE CASCADE,
  fee_type_id uuid REFERENCES public.stay_fee_types(id) ON DELETE SET NULL,
  description text NOT NULL,
  nature text NOT NULL DEFAULT 'receita',
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stay_reservation_items TO authenticated;
GRANT ALL ON public.stay_reservation_items TO service_role;
ALTER TABLE public.stay_reservation_items ENABLE ROW LEVEL SECURITY;

-- Extrato do proprietário ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stay_owner_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.stay_units(id) ON DELETE CASCADE,
  reference_month date NOT NULL,
  gross_revenue numeric(14,2) NOT NULL DEFAULT 0,
  deductions numeric(14,2) NOT NULL DEFAULT 0,
  owner_payout numeric(14,2) NOT NULL DEFAULT 0,
  company_result numeric(14,2) NOT NULL DEFAULT 0,
  nights_sold integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberto',
  bill_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stay_owner_statements_unico UNIQUE (unit_id, reference_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stay_owner_statements TO authenticated;
GRANT ALL ON public.stay_owner_statements TO service_role;
ALTER TABLE public.stay_owner_statements ENABLE ROW LEVEL SECURITY;

-- Policies ------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'stay_properties','stay_units','stay_channels','stay_fee_types',
    'stay_reservations','stay_reservation_items','stay_owner_statements'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY "membros leem %1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.is_company_member(company_id))', t);
    EXECUTE format(
      'CREATE POLICY "membros inserem %1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (public.pode_escrever_na_empresa(company_id))', t);
    EXECUTE format(
      'CREATE POLICY "membros atualizam %1$s" ON public.%1$I FOR UPDATE TO authenticated USING (public.pode_escrever_na_empresa(company_id)) WITH CHECK (public.pode_escrever_na_empresa(company_id))', t);
    EXECUTE format(
      'CREATE POLICY "membros excluem %1$s" ON public.%1$I FOR DELETE TO authenticated USING (public.pode_escrever_na_empresa(company_id))', t);
  END LOOP;
END $$;

-- Índices -------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_stay_units_property ON public.stay_units(property_id);
CREATE INDEX IF NOT EXISTS idx_stay_units_company ON public.stay_units(company_id);
CREATE INDEX IF NOT EXISTS idx_stay_reservations_unit ON public.stay_reservations(unit_id);
CREATE INDEX IF NOT EXISTS idx_stay_reservations_periodo ON public.stay_reservations(company_id, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_stay_reservation_items_res ON public.stay_reservation_items(reservation_id);
CREATE INDEX IF NOT EXISTS idx_stay_owner_statements_unit ON public.stay_owner_statements(unit_id, reference_month);

-- updated_at ----------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'stay_properties','stay_units','stay_channels','stay_fee_types',
    'stay_reservations','stay_owner_statements'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t);
  END LOOP;
END $$;

-- Totais da reserva calculados no banco -------------------------------------
CREATE OR REPLACE FUNCTION public.stay_calcular_reserva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit public.stay_units;
  v_comissao numeric(6,3) := 0;
  v_taxa_pgto numeric(6,3) := 0;
  v_base numeric(14,2);
BEGIN
  SELECT * INTO v_unit FROM public.stay_units WHERE id = NEW.unit_id;

  NEW.nights := GREATEST(1, (NEW.check_out - NEW.check_in));
  NEW.lodging_total := ROUND(COALESCE(NEW.nightly_rate,0) * NEW.nights, 2);

  IF NEW.channel_id IS NOT NULL THEN
    SELECT commission_percent, payment_fee_percent
      INTO v_comissao, v_taxa_pgto
      FROM public.stay_channels WHERE id = NEW.channel_id;
  END IF;

  NEW.gross_total := ROUND(NEW.lodging_total + COALESCE(NEW.cleaning_fee,0) + COALESCE(NEW.extras_total,0), 2);
  NEW.channel_commission := ROUND(NEW.gross_total * COALESCE(v_comissao,0) / 100, 2);
  NEW.payment_fee := ROUND(NEW.gross_total * COALESCE(v_taxa_pgto,0) / 100, 2);

  IF NEW.cleaning_cost IS NULL OR NEW.cleaning_cost = 0 THEN
    NEW.cleaning_cost := COALESCE(v_unit.cleaning_cost, 0);
  END IF;

  -- Repasse incide sobre a hospedagem líquida das taxas de canal e pagamento.
  v_base := GREATEST(NEW.lodging_total - NEW.channel_commission - NEW.payment_fee - COALESCE(NEW.taxes,0), 0);

  IF v_unit.payout_model = 'fixo' THEN
    NEW.owner_payout := COALESCE(v_unit.payout_fixed, 0);
  ELSE
    NEW.owner_payout := ROUND(v_base * COALESCE(v_unit.payout_percent, 0) / 100, 2);
  END IF;

  NEW.net_total := ROUND(
    NEW.gross_total
    - NEW.channel_commission
    - NEW.payment_fee
    - COALESCE(NEW.taxes,0)
    - COALESCE(NEW.cleaning_cost,0)
    - NEW.owner_payout, 2);

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.stay_calcular_reserva() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_stay_reservations_calc
BEFORE INSERT OR UPDATE ON public.stay_reservations
FOR EACH ROW EXECUTE FUNCTION public.stay_calcular_reserva();

-- Semente idempotente de empreendimentos, canais e taxas ---------------------
CREATE OR REPLACE FUNCTION public.stay_semear_cadastros(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_props jsonb := '[
    {"n":"STAY Haut Compact Life","b":"Setor Bueno","c":"Goiânia","u":"GO"},
    {"n":"STAY Hub Compact Life","b":"Setor Bueno","c":"Goiânia","u":"GO"},
    {"n":"STAY Lounge 22","b":"Setor Oeste","c":"Goiânia","u":"GO"},
    {"n":"STAY ID Vida Urbana","b":"Setor Oeste","c":"Goiânia","u":"GO"},
    {"n":"STAY Sun Square","b":"Setor Oeste","c":"Goiânia","u":"GO"},
    {"n":"STAY Studio All","b":"Jardim Goiás","c":"Goiânia","u":"GO"},
    {"n":"STAY Metropolitan Barcelona","b":"Jardim Goiás","c":"Goiânia","u":"GO"},
    {"n":"STAY Metropolitan Sidney","b":"Jardim Goiás","c":"Goiânia","u":"GO"},
    {"n":"STAY Live Tower Lozandes","b":"Park Lozandes","c":"Goiânia","u":"GO"},
    {"n":"STAY Liv Urban Marista","b":"Setor Marista","c":"Goiânia","u":"GO"},
    {"n":"STAY You by Fama","b":"Praia da Graciosa","c":"Palmas","u":"TO"},
    {"n":"STAY Vivence Suítes","b":"Plano Diretor Sul","c":"Palmas","u":"TO"},
    {"n":"STAY Cosmopolitan","b":"Plano Diretor Sul","c":"Palmas","u":"TO"},
    {"n":"STAY Premium","b":"Plano Diretor Sul","c":"Palmas","u":"TO"},
    {"n":"STAY Yvy Home","b":"Plano Diretor Sul","c":"Palmas","u":"TO"},
    {"n":"STAY Executive Residence","b":"Plano Diretor Norte","c":"Palmas","u":"TO"}
  ]'::jsonb;
  v_channels jsonb := '[
    {"n":"Direto","c":0,"p":1.99},
    {"n":"Site STAY","c":0,"p":2.99},
    {"n":"Airbnb","c":3,"p":0},
    {"n":"Booking.com","c":15,"p":0},
    {"n":"Expedia","c":17,"p":0},
    {"n":"Corporativo","c":0,"p":0}
  ]'::jsonb;
  v_fees jsonb := '[
    {"n":"Taxa de limpeza","cat":"limpeza","nat":"receita","v":120},
    {"n":"Limpeza extra","cat":"servico","nat":"receita","v":90},
    {"n":"Enxoval extra","cat":"extra","nat":"receita","v":45},
    {"n":"Hóspede adicional","cat":"extra","nat":"receita","v":60},
    {"n":"Early check-in","cat":"extra","nat":"receita","v":80},
    {"n":"Late check-out","cat":"extra","nat":"receita","v":80},
    {"n":"Taxa pet","cat":"extra","nat":"receita","v":100},
    {"n":"Estacionamento","cat":"extra","nat":"receita","v":30},
    {"n":"Lavanderia","cat":"servico","nat":"receita","v":50},
    {"n":"Multa por cancelamento","cat":"multa","nat":"receita","v":0},
    {"n":"No-show","cat":"multa","nat":"receita","v":0},
    {"n":"Caução / danos","cat":"caucao","nat":"receita","v":0},
    {"n":"Custo da faxina","cat":"limpeza","nat":"deducao","v":70},
    {"n":"Comissão do canal","cat":"canal","nat":"deducao","v":0},
    {"n":"Taxa de meio de pagamento","cat":"financeiro","nat":"deducao","v":0}
  ]'::jsonb;
  v_item jsonb;
  v_criados integer := 0;
BEGIN
  IF NOT public.pode_escrever_na_empresa(p_company_id) THEN
    RAISE EXCEPTION 'Sem permissão para esta empresa';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_props) LOOP
    INSERT INTO public.stay_properties (company_id, name, neighborhood, city, state)
    SELECT p_company_id, v_item->>'n', v_item->>'b', v_item->>'c', v_item->>'u'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.stay_properties
      WHERE company_id = p_company_id AND name = v_item->>'n');
    v_criados := v_criados + 1;
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_channels) LOOP
    INSERT INTO public.stay_channels (company_id, name, commission_percent, payment_fee_percent)
    VALUES (p_company_id, v_item->>'n', (v_item->>'c')::numeric, (v_item->>'p')::numeric)
    ON CONFLICT (company_id, name) DO NOTHING;
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_fees) LOOP
    INSERT INTO public.stay_fee_types (company_id, name, category, nature, default_amount)
    VALUES (p_company_id, v_item->>'n', v_item->>'cat', v_item->>'nat', (v_item->>'v')::numeric)
    ON CONFLICT (company_id, name) DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE EXECUTE ON FUNCTION public.stay_semear_cadastros(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stay_semear_cadastros(uuid) TO authenticated;