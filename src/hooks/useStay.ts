import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { mensagemDeErro } from "@/lib/erros";
import { toast } from "sonner";

// As tabelas stay_* ainda não estão nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface StayProperty {
  id: string;
  company_id: string;
  name: string;
  city: string | null;
  neighborhood: string | null;
  state: string | null;
  kind: string;
  notes: string | null;
  active: boolean;
}

export interface StayUnit {
  id: string;
  company_id: string;
  property_id: string;
  code: string;
  typology: string | null;
  capacity: number | null;
  owner_contact_id: string | null;
  payout_model: string;
  payout_percent: number;
  payout_fixed: number;
  cleaning_fee: number;
  cleaning_cost: number;
  base_rate: number;
  status: string;
}

export interface StayChannel {
  id: string;
  company_id: string;
  name: string;
  commission_percent: number;
  payment_fee_percent: number;
  active: boolean;
}

export interface StayFeeType {
  id: string;
  company_id: string;
  name: string;
  category: string;
  nature: string;
  default_amount: number;
  taxable: boolean;
  active: boolean;
}

export interface StayReservation {
  id: string;
  company_id: string;
  unit_id: string;
  channel_id: string | null;
  guest_name: string | null;
  guest_document: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  external_code: string | null;
  check_in: string;
  check_out: string;
  nights: number;
  guests: number | null;
  nightly_rate: number;
  lodging_total: number;
  cleaning_fee: number;
  extras_total: number;
  gross_total: number;
  channel_commission: number;
  payment_fee: number;
  taxes: number;
  cleaning_cost: number;
  owner_payout: number;
  net_total: number;
  deposit: number;
  status: string;
  payment_status: string;
  source: string | null;
  notes: string | null;
  transaction_id: string | null;
}

export type ReservationInput = Partial<StayReservation> & {
  unit_id: string;
  check_in: string;
  check_out: string;
  nightly_rate: number;
};

export const STATUS_RESERVA: Record<string, string> = {
  pre_reserva: "Pré-reserva",
  confirmada: "Confirmada",
  hospedado: "Hospedado",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
  no_show: "No-show",
  bloqueio: "Bloqueio",
};

export const STATUS_PAGAMENTO: Record<string, string> = {
  pendente: "Pendente",
  parcial: "Parcial",
  pago: "Pago",
  reembolsado: "Reembolsado",
};

/** Cadastros da operação de temporada: imóveis, unidades, canais e taxas. */
export function useStayCadastros() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const companyId = company?.id;

  const properties = useQuery({
    queryKey: ["stay_properties", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await db
        .from("stay_properties")
        .select("id, company_id, name, city, neighborhood, state, kind, notes, active")
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as StayProperty[];
    },
  });

  const units = useQuery({
    queryKey: ["stay_units", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await db
        .from("stay_units")
        .select(
          "id, company_id, property_id, code, typology, capacity, owner_contact_id, payout_model, payout_percent, payout_fixed, cleaning_fee, cleaning_cost, base_rate, status",
        )
        .eq("company_id", companyId!)
        .order("code");
      if (error) throw error;
      return (data ?? []) as StayUnit[];
    },
  });

  const channels = useQuery({
    queryKey: ["stay_channels", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await db
        .from("stay_channels")
        .select("id, company_id, name, commission_percent, payment_fee_percent, active")
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as StayChannel[];
    },
  });

  const feeTypes = useQuery({
    queryKey: ["stay_fee_types", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await db
        .from("stay_fee_types")
        .select("id, company_id, name, category, nature, default_amount, taxable, active")
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as StayFeeType[];
    },
  });

  const invalidarTudo = () => {
    for (const k of ["stay_properties", "stay_units", "stay_channels", "stay_fee_types"]) {
      queryClient.invalidateQueries({ queryKey: [k, companyId] });
    }
  };

  /** Popula imóveis, canais e taxas padrão da STAY. Idempotente no banco. */
  const semear = useMutation({
    mutationFn: async () => {
      const { error } = await db.rpc("stay_semear_cadastros", { p_company_id: companyId! });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarTudo();
      toast.success("Cadastros da STAY carregados");
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  function salvarEm<T extends Record<string, unknown>>(tabela: string, rotulo: string) {
    return async (valores: T & { id?: string }) => {
      const { id, ...campos } = valores;
      const { error } = id
        ? await db.from(tabela).update(campos).eq("id", id)
        : await db.from(tabela).insert({ ...campos, company_id: companyId! });
      if (error) throw error;
      return rotulo;
    };
  }

  const salvarUnidade = useMutation({
    mutationFn: salvarEm<Partial<StayUnit>>("stay_units", "Unidade"),
    onSuccess: () => {
      invalidarTudo();
      toast.success("Unidade salva");
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const salvarImovel = useMutation({
    mutationFn: salvarEm<Partial<StayProperty>>("stay_properties", "Imóvel"),
    onSuccess: () => {
      invalidarTudo();
      toast.success("Imóvel salvo");
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const salvarCanal = useMutation({
    mutationFn: salvarEm<Partial<StayChannel>>("stay_channels", "Canal"),
    onSuccess: () => {
      invalidarTudo();
      toast.success("Canal salvo");
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const salvarTaxa = useMutation({
    mutationFn: salvarEm<Partial<StayFeeType>>("stay_fee_types", "Taxa"),
    onSuccess: () => {
      invalidarTudo();
      toast.success("Taxa salva");
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  return {
    properties: properties.data ?? [],
    units: units.data ?? [],
    channels: channels.data ?? [],
    feeTypes: feeTypes.data ?? [],
    isLoading:
      properties.isLoading || units.isLoading || channels.isLoading || feeTypes.isLoading,
    semear,
    salvarImovel,
    salvarUnidade,
    salvarCanal,
    salvarTaxa,
  };
}

/**
 * Reservas que tocam o intervalo pedido. O filtro é por sobreposição, não por
 * data de check-in: uma estadia que começou no mês anterior continua ocupando
 * a unidade e precisa entrar no cálculo do mês corrente.
 */
export function useStayReservations(inicio?: string, fim?: string) {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const companyId = company?.id;
  const qk = ["stay_reservations", companyId, inicio ?? null, fim ?? null];

  const query = useQuery({
    queryKey: qk,
    enabled: !!companyId,
    queryFn: async () => {
      let q = db.from("stay_reservations").select("*").eq("company_id", companyId!);
      if (fim) q = q.lte("check_in", fim);
      if (inicio) q = q.gte("check_out", inicio);
      const { data, error } = await q.order("check_in", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as StayReservation[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["stay_reservations", companyId] });
    queryClient.invalidateQueries({ queryKey: ["stay_owner_statements", companyId] });
  };

  const salvar = useMutation({
    mutationFn: async (input: ReservationInput & { id?: string }) => {
      const { id, ...campos } = input;
      const { error } = id
        ? await db.from("stay_reservations").update(campos).eq("id", id)
        : await db.from("stay_reservations").insert({ ...campos, company_id: companyId! });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Reserva salva");
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("stay_reservations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Reserva excluída");
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  return {
    reservations: query.data ?? [],
    isLoading: query.isLoading,
    salvar,
    excluir,
  };
}

export interface StayOwnerStatement {
  id: string;
  company_id: string;
  unit_id: string;
  reference_month: string;
  gross_revenue: number;
  deductions: number;
  owner_payout: number;
  company_result: number;
  nights_sold: number;
  status: string;
  bill_id: string | null;
}

/** Extratos de repasse ao proprietário de um mês de referência. */
export function useStayOwnerStatements(referenceMonth: string) {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const companyId = company?.id;
  const qk = ["stay_owner_statements", companyId, referenceMonth];

  const query = useQuery({
    queryKey: qk,
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await db
        .from("stay_owner_statements")
        .select("*")
        .eq("company_id", companyId!)
        .eq("reference_month", referenceMonth);
      if (error) throw error;
      return (data ?? []) as StayOwnerStatement[];
    },
  });

  const gravar = useMutation({
    mutationFn: async (linhas: Omit<StayOwnerStatement, "id" | "company_id">[]) => {
      const { error } = await db
        .from("stay_owner_statements")
        .upsert(
          linhas.map((l) => ({ ...l, company_id: companyId! })),
          { onConflict: "company_id,unit_id,reference_month" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stay_owner_statements", companyId] });
      toast.success("Repasses do mês gravados");
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  return { statements: query.data ?? [], isLoading: query.isLoading, gravar };
}
