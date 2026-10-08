"use client";

import { useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  ChartNoAxesCombined,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { monthTitle, type Transaction } from "@/lib/finance";
import {
  buildFinanceExport,
  selectExportRows,
  type ExportFormat,
  type ExportScope,
} from "@/lib/finance-export";

const formats = [
  {
    value: "xlsx" as ExportFormat,
    title: "Excel",
    extension: ".xlsx",
    description:
      "Resumo mensal e lançamentos em abas, com filtros e valores em reais.",
    icon: FileSpreadsheet,
  },
  {
    value: "csv" as ExportFormat,
    title: "CSV",
    extension: ".csv",
    description:
      "Lista de lançamentos para abrir no Excel ou em outras planilhas.",
    icon: FileText,
  },
  {
    value: "bi" as ExportFormat,
    title: "Power BI",
    extension: ".csv",
    description:
      "Dados organizados para importar e criar suas análises no Power BI.",
    icon: ChartNoAxesCombined,
  },
];

type Props = {
  transactions: Transaction[];
  month: string;
  demo: boolean;
  disabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNotice: (message: string) => void;
};

export default function ExportStatement({
  transactions,
  month,
  demo,
  disabled,
  open,
  onOpenChange,
  onNotice,
}: Props) {
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [scope, setScope] = useState<ExportScope>("month");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const selectedRows = selectExportRows(transactions, month, scope);

  function changeOpen(next: boolean) {
    if (working) return;
    if (next) {
      setScope("month");
      setError("");
    }
    onOpenChange(next);
  }

  async function download(event: React.FormEvent) {
    event.preventDefault();
    if (working || disabled) return;
    setWorking(true);
    setError("");
    try {
      const file = await buildFinanceExport({
        transactions,
        month,
        scope,
        format,
        demo,
      });
      const blob = new Blob([new Uint8Array(file.bytes)], {
        type: file.mimeType,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // O navegador precisa de tempo para consumir o arquivo antes de liberar a URL.
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      onOpenChange(false);
      onNotice(`Download iniciado: ${file.filename}`);
    } catch {
      setError("Não foi possível gerar o extrato. Tente novamente.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <button className="secondary-button" disabled={disabled || working}>
          <Download size={16} /> Baixar extrato
        </button>
      </DialogTrigger>
      <DialogContent
        className="finance-dialog export-dialog"
        showCloseButton={!working}
      >
        <DialogTitle>Seu extrato, do seu jeito</DialogTitle>
        <DialogDescription>
          Escolha o período e o formato para levar seus dados com você.
        </DialogDescription>
        <form
          className="finance-form export-form"
          onSubmit={download}
          aria-busy={working}
        >
          <div className="export-fields">
            <label>
              Período do extrato
              <select
                value={scope}
                disabled={working}
                onChange={(event) =>
                  setScope(event.target.value as ExportScope)
                }
              >
                <option value="month">{monthTitle(month)}</option>
                <option value="all">Todo o histórico</option>
              </select>
            </label>
            <fieldset className="export-formats" disabled={working}>
              <legend>Formato do arquivo</legend>
              {formats.map(
                ({ value, title, extension, description, icon: Icon }) => (
                  <label className="export-format" key={value}>
                    <input
                      type="radio"
                      name="export-format"
                      value={value}
                      checked={format === value}
                      onChange={() => setFormat(value)}
                    />
                    <Icon size={22} aria-hidden="true" />
                    <span>
                      <strong>
                        {title} <small>{extension}</small>
                      </strong>
                      <span>{description}</span>
                    </span>
                  </label>
                ),
              )}
            </fieldset>
            <div className="export-context" aria-live="polite">
              <strong>
                {selectedRows.length}{" "}
                {selectedRows.length === 1 ? "lançamento" : "lançamentos"}
                {demo && " · Demonstração"}
              </strong>
              <p>
                {selectedRows.length
                  ? "Inclui receitas, despesas e parcelas, realizadas e previstas, de todo o período escolhido."
                  : "Este período não tem lançamentos. O arquivo terá os cabeçalhos e, no Excel, um resumo zerado."}
              </p>
              {format === "bi" && (
                <p>
                  No Power BI Desktop, abra Obter dados → Texto/CSV. Use a
                  localidade Inglês (Estados Unidos) para converter os valores
                  em reais, ou use as colunas em centavos divididas por 100.
                </p>
              )}
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="form-buttons">
            <button
              type="button"
              className="secondary-button"
              disabled={working}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </button>
            <button className="primary-button" disabled={disabled || working}>
              <Download size={16} />{" "}
              {working ? "Gerando extrato…" : "Baixar arquivo"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
