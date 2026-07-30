import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, FileText, FileArchive, FileKey, Files, MoreHorizontal, Trash2, Download } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useFiscalFiles } from "@/hooks/useFiscalFiles";
import { FiscalFileUploadDialog } from "@/components/fiscal/FiscalFileUploadDialog";
import { DeleteConfirmDialog } from "@/components/fiscal/DeleteConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const typeConfig: Record<string, { label: string; icon: typeof FileText; className: string }> = {
  contrato: { label: "Contrato", icon: FileText, className: "bg-primary/[0.08] text-primary dark:bg-primary/[0.08] dark:text-primary" },
  xml: { label: "XML", icon: FileArchive, className: "bg-primary/[0.08] text-primary dark:bg-primary/[0.08] dark:text-primary" },
  certificado: { label: "Certificado", icon: FileKey, className: "bg-warning/[0.08] text-warning dark:bg-warning/[0.08] dark:text-warning" },
  outro: { label: "Outro", icon: Files, className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

export default function FiscalFiles() {
  const { files, isLoading, uploadFile, deleteFile } = useFiscalFiles();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const counts = {
    total: files.length,
    contratos: files.filter(f => f.tipo === "contrato").length,
    xmls: files.filter(f => f.tipo === "xml").length,
    certificados: files.filter(f => f.tipo === "certificado").length,
  };

  const handleDownload = async (fileUrl: string | null, nome: string) => {
    if (!fileUrl) return;
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(fileUrl, 60);
    if (error || !data?.signedUrl) { toast.error("Erro ao gerar link"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Arquivos Fiscais</h1>
            <p className="text-sm text-muted-foreground mt-1">Contratos, XMLs, certificados e outros documentos</p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4" /> Adicionar Documento
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {([
            { label: "Total", value: counts.total, Icon: Files, bg: "bg-muted" },
            { label: "Contratos", value: counts.contratos, Icon: FileText, bg: "bg-primary/[0.08] dark:bg-primary/[0.08]" },
            { label: "XMLs", value: counts.xmls, Icon: FileArchive, bg: "bg-primary/[0.08] dark:bg-primary/[0.08]" },
            { label: "Certificados", value: counts.certificados, Icon: FileKey, bg: "bg-warning/[0.08] dark:bg-warning/[0.08]" },
          ] as const).map(({ label, value, Icon, bg }) => (
            <Card key={label}><CardContent className="p-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center`}><Icon className="h-4 w-4 text-foreground/60" /></div>
              <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold">{value}</p></div>
            </CardContent></Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : files.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Files className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum arquivo cadastrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data Upload</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Tamanho</th>
                      <th className="w-10 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map(f => {
                      const tc = typeConfig[f.tipo] ?? typeConfig.outro;
                      const TcIcon = tc.icon;
                      return (
                        <tr key={f.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium flex items-center gap-2">
                            <TcIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                            {f.nome}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${tc.className}`}>{tc.label}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(f.created_at)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{f.file_size ?? "—"}</td>
                          <td className="px-2 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {f.file_url && (
                                  <DropdownMenuItem onClick={() => handleDownload(f.file_url, f.nome)}>
                                    <Download className="h-4 w-4 mr-2" /> Baixar
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(f.id)}>
                                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <FiscalFileUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSubmit={(data) => uploadFile.mutate(data)}
        isPending={uploadFile.isPending}
      />

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        onConfirm={() => { if (deleteId) { deleteFile.mutate(deleteId); setDeleteId(null); } }}
        description="O arquivo será removido permanentemente."
      />
    </AppLayout>
  );
}
