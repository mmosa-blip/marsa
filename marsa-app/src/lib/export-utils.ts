import * as XLSX from "xlsx";

// Export table data to Excel
export function exportToExcel(data: Record<string, string | number>[], headers: { key: string; label: string }[], filename: string) {
  const wsData = [
    headers.map(h => h.label),
    ...data.map(row => headers.map(h => row[h.key] ?? ""))
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  // Set RTL
  ws["!cols"] = headers.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
