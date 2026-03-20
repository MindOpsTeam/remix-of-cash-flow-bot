import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

export interface FiscalFile {
  id: string;
  company_id: string;
  nome: string;
  tipo: string;
  file_url: string | null;
  file_size: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export function useFiscalFiles() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const companyId = company?.id;

  const query = useQuery({
    queryKey: ["fiscal_files", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_files")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FiscalFile[];
    },
  });

  const createFile = useMutation({
    mutationFn: async (input: Omit<FiscalFile, "id" | "company_id" | "created_at" | "updated_at">) => {
      const { error } = await supabase
        .from("fiscal_files")
        .insert({ ...input, company_id: companyId! });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fiscal_files", companyId] }),
  });

  const deleteFile = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fiscal_files").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fiscal_files", companyId] }),
  });

  return { ...query, files: query.data ?? [], createFile, deleteFile };
}
