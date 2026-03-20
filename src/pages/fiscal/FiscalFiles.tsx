import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, FileText, FileArchive, FileKey, Files } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useFiscalFiles } from "@/hooks/useFiscalFiles";

const typeConfig: Record<string, { label: string; icon: typeof FileText; className: string }> = {
  contrato: { label: "Contrato", icon: FileText, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  xml: { label: "XML", icon: FileArchive, className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  certificado: { label: "Certificado", icon: FileKey, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  outro: { label: "Outro", icon: Files, className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

export default function FiscalFiles() {
  const { files, isLoading } = useFiscalFiles();

  const counts = {
    total: files.length,
    contratos: files.filter(f => f.tipo === "contrato").length,
    xmls: files.filter(f => f.tipo === "xml").length,
    certificados: files.filter(f => f.tipo === "certificado").length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Arquivos Fiscais</h1>
            <p className="text-sm text-muted-foreground mt-1">Contratos, XMLs, certificados e outros documentos</p>
          </div>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Adicionar Documento
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {([
            { label: "Total", value: counts.total, Icon: Files, bg: "bg-muted" },
            { label: "Contratos", value: counts.contratos, Icon: FileText, bg: "bg-blue-100 dark:bg-blue-900/30" },
            { label: "XMLs", value: counts.xmls, Icon: FileArchive, bg: "bg-purple-100 dark:bg-purple-900/30" },
            { label: "Certificados", value: counts.certificados, Icon: FileKey, bg: "bg-amber-100 dark:bg-amber-900/30" },
          ] as const).map(({ label, value, Icon, bg }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className="h-4 w-4 text-foreground/60" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-semibold">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
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
                            <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${tc.className}`}>
                              {tc.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(f.created_at)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{f.file_size ?? "—"}</td>
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
    </AppLayout>
  );
}
