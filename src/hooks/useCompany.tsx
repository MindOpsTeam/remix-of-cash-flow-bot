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

    const fetchOrCreate = async (retries = 2) => {
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
        const { data: newCompany, error } = await supabase
          .from("companies")
          .insert({ name: "Minha Empresa" })
          .select()
          .single();

        if (error) {
          console.error("Erro ao criar empresa:", error.message);
          if (retries > 0) {
            setTimeout(() => fetchOrCreate(retries - 1), 2000);
            return;
          }
        } else if (newCompany) {
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
