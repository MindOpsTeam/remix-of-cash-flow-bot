import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, FileArchive, FileKey, Files } from "lucide-react";
import { formatDate } from "@/lib/utils";

type FileType = "contrato" | "xml" | "certificado" | "outro";

interface FiscalFile {
  id: string;
  nome: string;
  tipo: FileType;
  uploadedAt: string;
  tamanho: string;
}

const mockFiles: FiscalFile[] = [
  { id: "1", nome: "Contrato_Locacao_Sede.pdf", tipo: "contrato", uploadedAt: "2026-02-15", tamanho: "1.2 MB" },
  { id: "2", nome: "NFe_000142_XML.xml", tipo: "xml", uploadedAt: "2026-03-01", tamanho: "48 KB" },
  { id: "3", nome: "Certificado_A1_2026.pfx", tipo: "certificado", uploadedAt: "2026-01-10", tamanho: "3.8 KB" },
  { id: "4", nome: "Contrato_Social_Alteracao.pdf", tipo: "contrato", uploadedAt: "2026-03-12", tamanho: "890 KB" },
  { id: "5", nome: "SPED_Contribuicoes_022026.xml", tipo: "xml", uploadedAt: "2026-03-18", tamanho: "2.1 MB" },
  { id: "6", nome: "Procuracao_ECAC.pdf", tipo: "outro", uploadedAt: "2026-02-28", tamanho: "320 KB" },
];

const typeConfig: Record<FileType, { label: string; icon: typeof FileText; className: string }> = {
  contrato: { label: "Contrato", icon: FileText, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  xml: { label: "XML", icon: FileArchive, className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  certificado: { label: "Certificado", icon: FileKey, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  outro: { label: "Outro", icon: Files, className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

export default function FiscalFiles() {
  const [files] = useState(mockFiles);

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
                    const tc = typeConfig[f.tipo];
                    return (
                      <tr key={f.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium flex items-center gap-2">
                          <tc.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          {f.nome}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${tc.className}`}>
                            {tc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(f.uploadedAt)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{f.tamanho}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
