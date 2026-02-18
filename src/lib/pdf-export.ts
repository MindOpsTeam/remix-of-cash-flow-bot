import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface DRELineForPDF {
  label: string;
  value: number;
  level: number;
  isTotal?: boolean;
}

export function exportDREtoPDF(
  lines: DRELineForPDF[],
  companyName: string,
  period: string
) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Demonstração do Resultado do Exercício", 14, 22);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Empresa: ${companyName}`, 14, 32);
  doc.text(`Período: ${period}`, 14, 38);
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 14, 44);

  doc.setDrawColor(200);
  doc.line(14, 48, 196, 48);

  // Table
  const tableData = lines.map((line) => [
    line.level === 1 ? `    ${line.label}` : line.label,
    formatBRL(line.value),
  ]);

  autoTable(doc, {
    startY: 52,
    head: [["Conta", "Valor (R$)"]],
    body: tableData,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 50, halign: "right" },
    },
    didParseCell: (data: any) => {
      if (data.section === "body") {
        const line = lines[data.row.index];
        if (line?.isTotal) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [245, 245, 245];
        }
        if (line?.value < 0 && data.column.index === 1) {
          data.cell.styles.textColor = [200, 50, 50];
        }
      }
    },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pageCount}`, 196, 285, { align: "right" });
  }

  doc.save(`DRE_${period.replace(/\s/g, "_")}.pdf`);
}

export function exportReportToPDF(
  companyName: string,
  categoryData: { name: string; value: number }[],
  costCenterData: { name: string; receita: number; despesa: number }[]
) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório Gerencial", 14, 22);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Empresa: ${companyName}`, 14, 32);
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 14, 38);

  doc.setDrawColor(200);
  doc.line(14, 42, 196, 42);

  // Categories table
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40);
  doc.text("Despesas por Categoria", 14, 52);

  const totalCat = categoryData.reduce((s, c) => s + c.value, 0);

  autoTable(doc, {
    startY: 56,
    head: [["Categoria", "Valor (R$)", "% do Total"]],
    body: categoryData.map((c) => [
      c.name,
      formatBRL(c.value),
      `${totalCat > 0 ? ((c.value / totalCat) * 100).toFixed(1) : "0"}%`,
    ]),
    foot: [["Total", formatBRL(totalCat), "100%"]],
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: [245, 245, 245], fontStyle: "bold" },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
    },
  });

  // Cost Centers table
  const ccY = (doc as any).lastAutoTable.finalY + 14;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40);
  doc.text("Por Centro de Custo", 14, ccY);

  autoTable(doc, {
    startY: ccY + 4,
    head: [["Centro de Custo", "Receita (R$)", "Despesa (R$)", "Resultado (R$)"]],
    body: costCenterData.map((cc) => [
      cc.name,
      formatBRL(cc.receita),
      formatBRL(cc.despesa),
      formatBRL(cc.receita - cc.despesa),
    ]),
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 3) {
        const cc = costCenterData[data.row.index];
        if (cc && cc.receita - cc.despesa < 0) {
          data.cell.styles.textColor = [200, 50, 50];
        }
      }
    },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pageCount}`, 196, 285, { align: "right" });
  }

  doc.save(`Relatorio_Gerencial_${new Date().toISOString().split("T")[0]}.pdf`);
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
