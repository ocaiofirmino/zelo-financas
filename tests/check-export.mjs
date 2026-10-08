import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildFinanceExport, selectExportRows } from "../lib/finance-export.ts";

const timestamp = new Date("2026-10-07T15:00:00.000Z");
const base = {
  category: "Outros",
  payment: "pix",
  installment: 1,
  installments: 1,
  groupId: null,
};
const transaction = (id, amount, date, type, status, extra = {}) =>
  Object.freeze({
    ...base,
    id,
    amount,
    date,
    type,
    status,
    description: `Teste ${id}`,
    ...extra,
  });
const fixtures = Object.freeze([
  transaction("tx-h", 33333, "2026-12-03", "expense", "pending", {
    payment: "card",
    installment: 3,
    installments: 3,
    groupId: "grupo-notebook",
  }),
  transaction("tx-d", 12345, "2026-10-04", "income", "pending"),
  transaction("tx-c", 33334, "2026-10-03", "expense", "paid", {
    payment: "card",
    installment: 1,
    installments: 3,
    groupId: "grupo-notebook",
    description: 'Notebook; "Edição"\nportátil á',
  }),
  transaction("tx-b", 100001, "2026-10-02", "income", "paid", {
    category: "Salário",
    description: "Receita fictícia · São Paulo",
  }),
  transaction("tx-f", 33334, "2026-11-03", "expense", "pending", {
    payment: "card",
    installment: 2,
    installments: 3,
    groupId: "grupo-notebook",
  }),
  transaction("tx-e", 6789, "2026-10-05", "expense", "pending"),
  transaction("tx-a", 1, "2026-10-02", "expense", "paid"),
]);
const before = JSON.stringify(fixtures);
const monthRows = selectExportRows(fixtures, "2026-10", "month");
assert.deepEqual(
  monthRows.map((row) => row.id),
  ["tx-a", "tx-b", "tx-c", "tx-d", "tx-e"],
);
assert.equal(selectExportRows(fixtures, "2026-10", "all").length, 7);
assert.notEqual(monthRows, fixtures);
assert.equal(JSON.stringify(fixtures), before);

function parseCsv(bytes, delimiter) {
  assert.deepEqual(
    [...bytes.subarray(0, 3)],
    [239, 187, 191],
    "CSV has a UTF-8 BOM",
  );
  const csv = new TextDecoder().decode(bytes).replace(/^\uFEFF/, "");
  const records = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if (char === "\r" && csv[i + 1] === "\n" && !quoted) {
      row.push(cell);
      records.push(row);
      row = [];
      cell = "";
      i++;
    } else cell += char;
  }
  assert.equal(quoted, false, "CSV quotes are balanced");
  assert.equal(cell, "");
  assert.equal(row.length, 0);
  const [headers, ...values] = records;
  values.forEach((value) => assert.equal(value.length, headers.length));
  return {
    headers,
    values,
    objects: values.map((value) =>
      Object.fromEntries(headers.map((header, i) => [header, value[i]])),
    ),
  };
}

const build = (format, overrides = {}) =>
  buildFinanceExport({
    transactions: fixtures,
    month: "2026-10",
    scope: "month",
    format,
    demo: false,
    generatedAt: timestamp,
    ...overrides,
  });
const humanExport = await build("csv");
assert.equal(humanExport.filename, "zelo-extrato-2026-10.csv");
assert.equal(humanExport.mimeType, "text/csv;charset=utf-8");
const human = parseCsv(humanExport.bytes, ";");
assert.equal(human.values.length, 5);
assert.deepEqual(
  human.objects.map((row) => row["Situação"]),
  ["Pago", "Recebido", "Pago", "Previsto", "Previsto"],
);
assert.equal(human.objects[2]["Descrição"], 'Notebook; "Edição"\nportátil á');
assert.equal(human.objects[2]["Grupo"], "grupo-notebook");
assert.equal(human.objects[2]["Data"], "03/10/2026");
assert.equal(human.objects[2]["Competência"], "2026-10");
assert.equal(human.objects[2]["Parcela"], "1");
assert.equal(human.objects[2]["Total de parcelas"], "3");
assert.equal(human.objects[2]["Valor (BRL)"], "333,34");
assert.equal(
  human.objects[2]["Valor assinado (BRL)"],
  "-333,34",
  "negative numbers are not prefixed as formulas",
);
assert.equal(human.objects[0]["Valor (BRL)"], "0,01");
assert.equal(human.objects[1]["Valor assinado (BRL)"], "1000,01");
assert.equal(human.objects[1]["Descrição"], "Receita fictícia · São Paulo");
assert.equal(human.objects[2]["Pagamento"], "Cartão");
assert.equal(human.objects[0]["Grupo"], "");
assert.ok(human.objects.every((row) => row["Moeda"] === "BRL"));
assert.ok(human.objects.every((row) => !row["Valor (BRL)"].includes("R$")));

const biExport = await build("bi", { scope: "all", demo: true });
assert.equal(
  biExport.filename,
  "zelo-extrato-historico-demonstracao-power-bi.csv",
);
const bi = parseCsv(biExport.bytes, ",");
assert.ok(bi.headers.every((header) => /^[a-z_]+$/.test(header)));
assert.equal(bi.values.length, 7);
assert.equal(bi.objects[2].data, "2026-10-03");
assert.equal(bi.objects[2].ano, "2026");
assert.equal(bi.objects[2].mes, "10");
assert.equal(bi.objects[2].tipo, "expense");
assert.equal(bi.objects[2].status, "paid");
assert.equal(bi.objects[2].pagamento, "card");
assert.equal(bi.objects[2].valor_brl, "333.34");
assert.equal(bi.objects[2].valor_assinado_brl, "-333.34");
assert.equal(bi.objects[2].valor_centavos, "33334");
assert.equal(bi.objects[2].valor_assinado_centavos, "-33334");
assert.equal(
  bi.objects
    .filter((row) => row.grupo_id === "grupo-notebook")
    .reduce((sum, row) => sum + Number(row.valor_centavos), 0),
  100001,
  "each installment contributes only its own amount",
);
assert.equal(
  bi.objects
    .filter((row) => row.competencia === "2026-10" && row.status === "paid")
    .reduce((sum, row) => sum + Number(row.valor_assinado_centavos), 0),
  66666,
);
assert.equal(
  bi.objects
    .filter((row) => row.competencia === "2026-10")
    .reduce((sum, row) => sum + Number(row.valor_assinado_centavos), 0),
  72222,
);

const unsafeDescriptions = [
  "=1+1",
  " +SUM(A1:A2)",
  "-cmd|test",
  "@SUM(A1:A2)",
  "\t=1+1",
  "\r=1+1",
  "\n=1+1",
];
const unsafeRows = unsafeDescriptions.map((description, i) =>
  transaction(`safe-${i}`, 123, "2026-10-01", "expense", "paid", {
    description,
  }),
);
for (const format of ["csv", "bi"]) {
  const output = await build(format, { transactions: unsafeRows });
  const parsed = parseCsv(output.bytes, format === "csv" ? ";" : ",");
  parsed.objects.forEach((row, i) =>
    assert.equal(
      row[format === "csv" ? "Descrição" : "descricao"],
      `'${unsafeDescriptions[i]}`,
    ),
  );
}

const xlsxExport = await build("xlsx", { scope: "all", demo: true });
assert.equal(xlsxExport.filename, "zelo-extrato-historico-demonstracao.xlsx");
assert.equal(
  xlsxExport.mimeType,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
);
assert.deepEqual(
  [...xlsxExport.bytes.subarray(0, 2)],
  [80, 75],
  "XLSX is an actual zipped workbook",
);
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(xlsxExport.bytes);
assert.deepEqual(
  workbook.worksheets.map((sheet) => sheet.name),
  ["Resumo", "Lançamentos"],
);
const summary = workbook.getWorksheet("Resumo");
const statement = workbook.getWorksheet("Lançamentos");
assert.equal(summary.getCell("B2").value, "Demonstração · dados fictícios");
assert.match(summary.getCell("B3").value, /Histórico completo/);
assert.match(summary.getCell("A5").value, /sem saldo bancário inicial/);
assert.equal(
  summary.getCell("B4").value.toISOString(),
  timestamp.toISOString(),
);
assert.equal(summary.getCell("A8").value, "2026-10");
assert.equal(summary.getCell("B8").value, 1000.01);
assert.equal(summary.getCell("C8").value, 333.35);
assert.equal(summary.getCell("D8").value, 123.45);
assert.equal(summary.getCell("E8").value, 67.89);
assert.deepEqual(summary.getCell("F8").value, {
  formula: "B8-C8",
  result: 666.66,
});
assert.deepEqual(summary.getCell("G8").value, {
  formula: "B8+D8-C8-E8",
  result: 722.22,
});
assert.equal(summary.getCell("H8").value, 5);
assert.equal(summary.getCell("A9").value, "2026-11");
assert.equal(summary.getCell("E9").value, 333.34);
assert.equal(summary.getCell("G9").value.result, -333.34);
assert.equal(summary.getCell("A10").value, "2026-12");
assert.equal(statement.rowCount, 8);
assert.deepEqual(statement.getRow(1).values.slice(1), human.headers);
assert.equal(
  statement.getCell("C4").value.toISOString(),
  "2026-10-03T00:00:00.000Z",
);
assert.equal(statement.getCell("C4").numFmt, "dd/mm/yyyy");
assert.equal(typeof statement.getCell("L4").value, "number");
assert.equal(statement.getCell("L4").value, 333.34);
assert.equal(statement.getCell("M4").value, -333.34);
assert.equal(statement.getCell("E4").value, 'Notebook; "Edição"\nportátil á');
assert.equal(statement.getCell("B4").value, "grupo-notebook");
assert.equal(statement.getCell("J4").value, 1);
assert.equal(statement.getCell("K4").value, 3);
assert.equal(statement.views[0].ySplit, 1);
assert.equal(statement.autoFilter, "A1:N8");

for (const format of ["csv", "bi", "xlsx"]) {
  const emptyExport = await build(format, { transactions: [] });
  assert.ok(emptyExport.bytes.length);
  if (format !== "xlsx") {
    const empty = parseCsv(emptyExport.bytes, format === "csv" ? ";" : ",");
    assert.equal(empty.values.length, 0);
    assert.ok(empty.headers.length);
  } else {
    const emptyBook = new ExcelJS.Workbook();
    await emptyBook.xlsx.load(emptyExport.bytes);
    assert.equal(emptyBook.getWorksheet("Lançamentos").rowCount, 1);
    const emptySummary = emptyBook.getWorksheet("Resumo");
    assert.equal(emptySummary.getCell("H8").value, 0);
    assert.equal(emptySummary.getCell("F8").value.formula, "B8-C8");
  }
}
await assert.rejects(() => build("csv", { month: "2026-13" }), /mês válido/);
await assert.rejects(
  () =>
    build("csv", {
      scope: "all",
      transactions: [{ ...fixtures[0], date: "2026-02-30" }],
    }),
  /data inválida/,
);
await assert.rejects(
  () => build("csv", { transactions: [{ ...fixtures[3], amount: 123.45 }] }),
  /valor inválido/,
);
assert.equal(
  JSON.stringify(fixtures),
  before,
  "all export paths preserve the stored transactions",
);
console.log(
  "Export checks passed: CSV/BI cents, signs, statuses, scope, safety, Unicode, installments, XLSX dates/formulas and empty files.",
);
