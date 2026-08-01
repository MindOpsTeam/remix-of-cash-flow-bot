import { mensagemDeErro } from "@/lib/erros";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";

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

export type FiscalFileInput = {
  nome: string;
  tipo: string;
  file_url?: string | null;
  file_size?: string | null;
  source?: string;
};

export function useFiscalFiles() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const companyId = company?.id;
  const qk = ["fiscal_files", companyId];

  const query = useQuery({
    queryKey: qk,
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
    mutationFn: async (input: FiscalFileInput) => {
      const { error } = await supabase
        .from("fiscal_files")
        .insert({ ...input, company_id: companyId!, source: input.source ?? "manual" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Arquivo adicionado");
    },
    onError: (e: Error) => toast.error("Erro ao criar arquivo: " + mensagemDeErro(e)),
  });

  const updateFile = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<FiscalFileInput> & { id: string }) => {
      const { error } = await supabase.from("fiscal_files").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Arquivo atualizado");
    },
    onError: (e: Error) => toast.error("Erro ao atualizar: " + mensagemDeErro(e)),
  });

  const deleteFile = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fiscal_files").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Arquivo removido");
    },
    onError: (e: Error) => toast.error("Erro ao remover: " + mensagemDeErro(e)),
  });

  const uploadFile = useMutation({
    mutationFn: async ({ file, tipo }: { file: File; tipo: string }) => {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${companyId}/fiscal/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const sizeKb = file.size / 1024;
      const fileSize = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${Math.round(sizeKb)} KB`;

      const { error } = await supabase.from("fiscal_files").insert({
        company_id: companyId!,
        nome: file.name,
        tipo,
        file_url: path,
        file_size: fileSize,
        source: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Arquivo enviado");
    },
    onError: (e: Error) => toast.error("Erro no upload: " + mensagemDeErro(e)),
  });

  return { ...query, files: query.data ?? [], createFile, updateFile, deleteFile, uploadFile };
}
