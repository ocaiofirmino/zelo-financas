import { totals, type Transaction } from "./finance.ts";
import type { Worksheet } from "exceljs";

export type ExportFormat = "xlsx" | "csv" | "bi";
export type ExportScope = "month" | "all";

type ExportOptions = {
  transactions: Transaction[];
  month: string;
  scope: ExportScope;
  format: ExportFormat;
  demo: boolean;
  generatedAt?: Date;
};

export type FinanceExport = {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
};

const statementHeaders = [
  "ID",
  "Grupo",
  "Data",
  "Competência",
  "Descrição",
  "Tipo",
  "Categoria",
  "Pagamento",
  "Situação",
  "Parcela",
  "Total de parcelas",
  "Valor (BRL)",
  "Valor assinado (BRL)",
  "Moeda",
];

const biHeaders = [
  "id",
  "grupo_id",
  "data",
  "competencia",
  "ano",
  "mes",
  "descricao",
  "tipo",
  "categoria",
  "pagamento",
  "status",
  "situacao",
  "parcela",
  "total_parcelas",
  "valor_brl",
  "valor_assinado_brl",
  "valor_centavos",
  "valor_assinado_centavos",
  "moeda",
];

/** Each stored installment is already one transaction: never multiply its amount. */
export function selectExportRows(
  transactions: Transaction[],
  month: string,
  scope: ExportScope,
): Transaction[] {
  return transactions
    .filter((row) => scope === "all" || row.date.slice(0, 7) === month)
    .sort((a, b) => compare(a.date, b.date) || compare(a.id, b.id));
}

function compare(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function signedCents(row: Transaction) {
  return row.type === "income" ? row.amount : -row.amount;
}

function situation(row: Transaction) {
  if (row.status === "pending") return "Previsto";
  return row.type === "income" ? "Recebido" : "Pago";
}

function decimal(cents: number, separator: "." | ",") {
  // Integer arithmetic preserves the two cent digits in the exported text.
  const absolute = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.floor(absolute / 100)}${separator}${String(absolute % 100).padStart(2, "0")}`;
}

/**
 * Both CSVs may be opened in Excel. Text that could execute as a spreadsheet
 * formula is prefixed with an apostrophe, including the BI CSV. Power Query
 * receives that safe prefix; ordinary text is exported unchanged. Numeric
 * values are written separately and retain their sign without this prefix.
 */
function safeText(value: string) {
  return /^[\t\r\n]/.test(value) || /^[\u0000-\u0020]*[=+\-@]/.test(value)
    ? `'${value}`
    : value;
}

function csvCell(
  value: string | number,
  delimiter: string,
  protectText = true,
) {
  const text =
    typeof value === "number"
      ? String(value)
      : protectText
        ? safeText(value)
        : value;
  return text.includes(delimiter) || /["\r\n]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

function csvLine(
  values: (string | number)[],
  delimiter: string,
  numberColumns: number[] = [],
) {
  return values
    .map((value, index) =>
      csvCell(value, delimiter, !numberColumns.includes(index)),
    )
    .join(delimiter);
}

function humanCells(row: Transaction): (string | number)[] {
  return [
    row.id,
    row.groupId ?? "",
    row.date.split("-").reverse().join("/"),
    row.date.slice(0, 7),
    row.description,
    row.type === "income" ? "Receita" : "Despesa",
    row.category,
    row.payment === "card" ? "Cartão" : "Pix",
    situation(row),
    row.installment,
    row.installments,
    decimal(row.amount, ","),
    decimal(signedCents(row), ","),
    "BRL",
  ];
}

function biCells(row: Transaction): (string | number)[] {
  return [
    row.id,
    row.groupId ?? "",
    row.date,
    row.date.slice(0, 7),
    Number(row.date.slice(0, 4)),
    Number(row.date.slice(5, 7)),
    row.description,
    row.type,
    row.category,
    row.payment,
    row.status,
    situation(row),
    row.installment,
    row.installments,
    decimal(row.amount, "."),
    decimal(signedCents(row), "."),
    row.amount,
    signedCents(row),
    "BRL",
  ];
}

function makeCsv(rows: Transaction[], bi: boolean) {
  const delimiter = bi ? "," : ";";
  const headers = bi ? biHeaders : statementHeaders;
  const lines = [
    csvLine(headers, delimiter),
    ...rows.map((row) =>
      csvLine(
        bi ? biCells(row) : humanCells(row),
        delimiter,
        bi ? [4, 5, 12, 13, 14, 15, 16, 17] : [9, 10, 11, 12],
      ),
    ),
  ];
  return new TextEncoder().encode(`\uFEFF${lines.join("\r\n")}\r\n`);
}

function styleHeader(sheet: Worksheet, rowNumber: number) {
  const header = sheet.getRow(rowNumber);
  header.height = 26;
  header.font = { bold: true, color: { argb: "FFF1F7F6" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF03624C" },
  };
  header.alignment = { vertical: "middle", wrapText: true };
}

async function makeWorkbook(
  rows: Transaction[],
  options: ExportOptions,
  generatedAt: Date,
) {
  // Load the workbook library only when the user chooses Excel.
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Zelo";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.title = "Zelo · Extrato financeiro";
  workbook.subject = options.demo
    ? "Dados de demonstração"
    : "Finanças pessoais";

  const summary = workbook.addWorksheet("Resumo");
  summary.columns = [
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 24 },
    { width: 24 },
    { width: 16 },
  ];
  summary.mergeCells("A1:H1");
  summary.getCell("A1").value = "Zelo · Extrato financeiro";
  summary.getCell("A1").font = {
    bold: true,
    size: 18,
    color: { argb: "FF03624C" },
  };
  summary.getRow(1).height = 32;
  summary.getCell("A2").value = "Modo";
  summary.mergeCells("B2:H2");
  summary.getCell("B2").value = options.demo
    ? "Demonstração · dados fictícios"
    : "Meu controle";
  summary.getCell("A3").value = "Período";
  summary.mergeCells("B3:H3");
  summary.getCell("B3").value =
    options.scope === "month"
      ? options.month
      : rows.length
        ? `Histórico completo · ${rows[0].date} a ${rows.at(-1)!.date}`
        : "Histórico completo · sem lançamentos";
  summary.getCell("A4").value = "Gerado em (UTC)";
  summary.getCell("B4").value = generatedAt;
  summary.getCell("B4").numFmt = "dd/mm/yyyy hh:mm:ss";
  summary.mergeCells("A5:H5");
  summary.getCell("A5").value =
    "Valores em BRL. Entradas e saídas do período, sem saldo bancário inicial.";
  summary.getCell("A5").alignment = { wrapText: true };
  summary.getRow(5).height = 30;
  summary.getRow(7).values = [
    "Competência",
    "Recebido (BRL)",
    "Pago (BRL)",
    "A receber (BRL)",
    "A pagar (BRL)",
    "Resultado realizado (BRL)",
    "Resultado previsto (BRL)",
    "Quantidade",
  ];
  styleHeader(summary, 7);
  summary.getRow(7).height = 42;

  const months =
    options.scope === "month"
      ? [options.month]
      : [...new Set(rows.map((row) => row.date.slice(0, 7)))];
  months.forEach((month) => {
    const monthRows = rows.filter((row) => row.date.slice(0, 7) === month);
    const values = totals(monthRows);
    const row = summary.addRow([
      month,
      values.income / 100,
      values.expense / 100,
      values.pendingIncome / 100,
      values.pendingExpense / 100,
      null,
      null,
      monthRows.length,
    ]);
    row.getCell(6).value = {
      formula: `B${row.number}-C${row.number}`,
      result: values.result / 100,
    };
    row.getCell(7).value = {
      formula: `B${row.number}+D${row.number}-C${row.number}-E${row.number}`,
      result: values.projected / 100,
    };
    for (let col = 2; col <= 7; col++)
      row.getCell(col).numFmt = "#,##0.00;[Red]-#,##0.00";
  });
  summary.views = [{ state: "frozen", ySplit: 7 }];
  summary.autoFilter = {
    from: { row: 7, column: 1 },
    to: { row: Math.max(7, summary.rowCount), column: 8 },
  };

  const statement = workbook.addWorksheet("Lançamentos");
  statement.columns = statementHeaders.map((header, index) => ({
    header,
    width: [38, 38, 15, 16, 42, 14, 20, 15, 16, 12, 20, 19, 24, 10][index],
  }));
  rows.forEach((transaction) => {
    const values: (string | number | Date)[] = humanCells(transaction);
    values[2] = new Date(`${transaction.date}T00:00:00.000Z`);
    values[11] = transaction.amount / 100;
    values[12] = signedCents(transaction) / 100;
    const row = statement.addRow(values);
    row.getCell(3).numFmt = "dd/mm/yyyy";
    row.getCell(12).numFmt = "#,##0.00;[Red]-#,##0.00";
    row.getCell(13).numFmt = "#,##0.00;[Red]-#,##0.00";
  });
  styleHeader(statement, 1);
  statement.views = [{ state: "frozen", ySplit: 1 }];
  statement.autoFilter = {
    from: { row: 1, column: 1 },
    to: {
      row: Math.max(1, statement.rowCount),
      column: statementHeaders.length,
    },
  };
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export async function buildFinanceExport(
  options: ExportOptions,
): Promise<FinanceExport> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(options.month))
    throw new Error("Escolha um mês válido para exportar.");
  if (!["month", "all"].includes(options.scope))
    throw new Error("Escolha um período válido para exportar.");
  if (!["xlsx", "csv", "bi"].includes(options.format))
    throw new Error("Escolha um formato válido para exportar.");
  const generatedAt = options.generatedAt ?? new Date();
  if (!Number.isFinite(generatedAt.getTime()))
    throw new Error("A data de geração é inválida.");
  const rows = selectExportRows(
    options.transactions,
    options.month,
    options.scope,
  );
  for (const row of rows) {
    if (!Number.isSafeInteger(row.amount) || row.amount < 0)
      throw new Error("Um lançamento tem valor inválido para exportação.");
    const date = new Date(`${row.date}T00:00:00.000Z`);
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== row.date
    )
      throw new Error("Um lançamento tem data inválida para exportação.");
  }
  const period = options.scope === "month" ? options.month : "historico";
  const base = `zelo-extrato-${period}${options.demo ? "-demonstracao" : ""}${options.format === "bi" ? "-power-bi" : ""}`;
  if (options.format === "xlsx") {
    return {
      bytes: await makeWorkbook(rows, options, generatedAt),
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `${base}.xlsx`,
    };
  }
  return {
    bytes: makeCsv(rows, options.format === "bi"),
    mimeType: "text/csv;charset=utf-8",
    filename: `${base}.csv`,
  };
}
