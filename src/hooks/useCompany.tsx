import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  orgId: string;
  /** Regime tributário (Reforma): simples | regular | mei. Null = não configurado. */
  regimeTributario: "simples" | "regular" | "mei" | null;
  /** cClassTrib padrão usado no destaque CBS/IBS das emissões. */
  cclasstribPadrao: string | null;
}

/** Escopo ativo do dashboard: "all" = visão combinada de todos os CNPJs, ou o id de uma empresa. */
export type CompanyScope = "all" | string;

interface CompanyContextType {
  /** Empresa ativa (single) — usada pelas páginas transacionais existentes. Nunca nula após carregar. */
  company: Company | null;
  /** Todas as empresas (CNPJs) vinculadas ao cliente logado. */
  companies: Company[];
  /** Escopo do dashboard BI: "all" (combinado) ou id de empresa. */
  scope: CompanyScope;
  setScope: (scope: CompanyScope) => void;
  loading: boolean;
  refetch: () => Promise<void>;
}

const SCOPE_STORAGE_KEY = "cfo:company-scope";

const CompanyContext = createContext<CompanyContextType>({
  company: null,
  companies: [],
  scope: "all",
  setScope: () => {},
  loading: true,
  refetch: async () => {},
});

interface MemberRow {
  company_id: string;
  companies: {
    id: string;
    name: string;
    cnpj: string | null;
    org_id: string;
    regime_tributario: "simples" | "regular" | "mei" | null;
    cclasstrib_padrao: string | null;
  } | null;
}

function toCompany(c: NonNullable<MemberRow["companies"]>): Company {
  return {
    id: c.id,
    name: c.name,
    cnpj: c.cnpj,
    orgId: c.org_id,
    regimeTributario: c.regime_tributario ?? null,
    cclasstribPadrao: c.cclasstrib_padrao ?? null,
  };
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [scope, setScopeState] = useState<CompanyScope>(() => {
    return (typeof window !== "undefined" && localStorage.getItem(SCOPE_STORAGE_KEY)) || "all";
  });
  const [loading, setLoading] = useState(true);

  const setScope = useCallback((next: CompanyScope) => {
    setScopeState(next);
    try {
      localStorage.setItem(SCOPE_STORAGE_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const fetchCompanies = useCallback(async (retries = 2): Promise<void> => {
    if (!user) return;

    const { data: members, error } = await supabase
      .from("company_members")
      .select("company_id, companies(id, name, cnpj, org_id, regime_tributario, cclasstrib_padrao)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erro ao carregar empresas:", error.message);
    }

    const rows = (members ?? []) as unknown as MemberRow[];
    const list: Company[] = rows
      .map((row) => row.companies)
      .filter((c): c is NonNullable<MemberRow["companies"]> => Boolean(c))
      .map(toCompany);

    if (list.length > 0) {
      setCompanies(list);
      setLoading(false);
      return;
    }

    // Nenhuma empresa: auto-provisiona a primeira via SECURITY DEFINER
    const { data: created, error: rpcError } = await supabase.rpc("create_company_for_user", {
      company_name: "Minha Empresa",
    });

    if (rpcError) {
      console.error("Erro ao criar empresa:", rpcError.message);
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, 1500));
        return fetchCompanies(retries - 1);
      }
      setLoading(false);
      return;
    }

    if (created) {
      const c = created as NonNullable<MemberRow["companies"]>;
      setCompanies([toCompany(c)]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCompanies([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchCompanies();
  }, [user, fetchCompanies]);

  // Normaliza o escopo se a empresa selecionada não existir mais
  useEffect(() => {
    if (loading || companies.length === 0) return;
    if (scope !== "all" && !companies.some((c) => c.id === scope)) {
      setScope(companies.length > 1 ? "all" : companies[0].id);
    }
  }, [companies, scope, loading, setScope]);

  // Empresa ativa (single) para páginas transacionais:
  // - escopo em um CNPJ -> essa empresa
  // - escopo combinado  -> a primeira empresa (alvo padrão de escrita)
  const company = useMemo<Company | null>(() => {
    if (companies.length === 0) return null;
    if (scope !== "all") {
      return companies.find((c) => c.id === scope) ?? companies[0];
    }
    return companies[0];
  }, [companies, scope]);

  const value = useMemo<CompanyContextType>(
    () => ({ company, companies, scope, setScope, loading, refetch: () => fetchCompanies() }),
    [company, companies, scope, setScope, loading, fetchCompanies],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export const useCompany = () => useContext(CompanyContext);
