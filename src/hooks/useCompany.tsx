import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Company {
  id: string;
  name: string;
  cnpj: string | null;
}

interface CompanyContextType {
  company: Company | null;
  loading: boolean;
}

const CompanyContext = createContext<CompanyContextType>({ company: null, loading: true });

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCompany(null);
      setLoading(false);
      return;
    }

    const fetchOrCreate = async () => {
      // Check if user has a company
      const { data: members } = await supabase
        .from("company_members")
        .select("company_id, companies(id, name, cnpj)")
        .eq("user_id", user.id)
        .limit(1);

      if (members && members.length > 0) {
        const c = members[0].companies as any;
        setCompany({ id: c.id, name: c.name, cnpj: c.cnpj });
      } else {
        // Auto-create a company for the user
        // The seed_default_accounts trigger auto-creates chart of accounts, cost centers, and bank accounts
        const { data: newCompany } = await supabase
          .from("companies")
          .insert({ name: "Minha Empresa" })
          .select()
          .single();

        if (newCompany) {
          await supabase.from("company_members").insert({
            company_id: newCompany.id,
            user_id: user.id,
            role: "admin",
          });

          setCompany({ id: newCompany.id, name: newCompany.name, cnpj: newCompany.cnpj });
        }
      }
      setLoading(false);
    };

    fetchOrCreate();
  }, [user]);

  return (
    <CompanyContext.Provider value={{ company, loading }}>
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompany = () => useContext(CompanyContext);
