"use client";
import Link from "next/link";
import ExportStatement from "./export-statement";
import SiteFooter from "./site-footer";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Menu,
  X,
  LayoutDashboard,
  ReceiptText,
  ChartNoAxesCombined,
  CreditCard,
  Plus,
  SlidersHorizontal,
  Search,
  Pencil,
  Trash2,
  Check,
  RotateCcw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  categories,
  categoryColors,
  defaultSettings,
  demoSettings,
  getDemo,
  localDate,
  localMonth,
  makeTransactions,
  money,
  monthTitle,
  parseAmount,
  shiftMonth,
  totals,
  validateTransaction,
  type Transaction,
  type Settings,
} from "@/lib/finance";
type View = "overview" | "transactions" | "cards" | "statement";
type Draft = {
  description: string;
  amount: string;
  date: string;
  type: "income" | "expense";
  category: string;
  payment: "pix" | "card";
  status: "paid" | "pending";
  installments: number;
};
const nav = [
  { view: "overview" as View, label: "Meu mês", icon: LayoutDashboard },
  { view: "transactions" as View, label: "Lançamentos", icon: ReceiptText },
  { view: "cards" as View, label: "Cartão", icon: CreditCard },
  {
    view: "statement" as View,
    label: "Demonstrativo",
    icon: ChartNoAxesCombined,
  },
];
const titles = {
  overview: "Meu mês.",
  transactions: "Lançamentos.",
  cards: "Cartão e parcelas.",
  statement: "Demonstrativo do mês.",
};
function demoData() {
  const month = localMonth();
  const current = getDemo(month);
  const future = current
    .filter((r) => r.payment === "card" && r.installments > 1)
    .flatMap((r) =>
      Array.from({ length: r.installments - r.installment }, (_, i) => ({
        ...r,
        id: r.id + "-future-" + i,
        installment: r.installment + i + 1,
        date: shiftMonth(month, i + 1) + r.date.slice(7),
        status: "pending" as const,
      })),
    );
  return [...current, ...getDemo(shiftMonth(month, -1)), ...future];
}
function blankDraft(month: string): Draft {
  return {
    description: "",
    amount: "",
    date: month === localMonth() ? localDate() : month + "-01",
    type: "expense",
    category: "Alimentação",
    payment: "pix",
    status: "paid",
    installments: 1,
  };
}
type ApiResult = {
  error?: string;
  transactions: Transaction[];
  settings: Record<string, Settings>;
  transaction: Transaction;
};
async function api(method: string, data?: unknown) {
  const response = await fetch("/api/finance", {
    method,
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    cache: "no-store",
  });
  const result = (await response.json()) as ApiResult;
  if (!response.ok)
    throw new Error(
      result.error || "Não foi possível concluir. Tente novamente.",
    );
  return result;
}
export default function FinanceApp() {
  const [view, setView] = useState<View>("overview"),
    [month, setMonth] = useState(localMonth()),
    [demo, setDemo] = useState(true),
    [exampleRows, setExampleRows] = useState<Transaction[]>(demoData),
    [exampleSettings, setExampleSettings] = useState<Record<string, Settings>>(
      {},
    ),
    [savedRows, setSavedRows] = useState<Transaction[]>([]),
    [savedSettings, setSavedSettings] = useState<Record<string, Settings>>({}),
    [loaded, setLoaded] = useState(false),
    [loadError, setLoadError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [leavingId, setLeavingId] = useState<string | null>(null);
  const [query, setQuery] = useState(""),
    [typeFilter, setTypeFilter] = useState("all"),
    [statusFilter, setStatusFilter] = useState("all"),
    [categoryFilter, setCategoryFilter] = useState("all");
  const [entryOpen, setEntryOpen] = useState(false),
    [exportOpen, setExportOpen] = useState(false),
    [editing, setEditing] = useState<Transaction | null>(null),
    [draft, setDraft] = useState<Draft>(() => blankDraft(localMonth())),
    [formError, setFormError] = useState(""),
    [deleteEntry, setDeleteEntry] = useState<Transaction | null>(null),
    [planOpen, setPlanOpen] = useState(false),
    [goalDraft, setGoalDraft] = useState(""),
    [budgetDraft, setBudgetDraft] = useState<Record<string, string>>({});
  const dialogReturnFocus = useRef<HTMLElement | null>(null);
  function rememberDialogFocus() {
    dialogReturnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }
  function restoreDialogFocus(event: Event) {
    event.preventDefault();
    if (dialogReturnFocus.current?.isConnected)
      dialogReturnFocus.current.focus();
    else document.querySelector<HTMLButtonElement>(".floating-button")?.focus();
  }
  const allRows = demo ? exampleRows : savedRows,
    rows = allRows.filter((r) => r.date.slice(0, 7) === month),
    summary = totals(rows),
    settings = demo
      ? exampleSettings[month] || demoSettings
      : savedSettings[month] || defaultSettings,
    previousRows = allRows.filter(
      (r) => r.date.slice(0, 7) === shiftMonth(month, -1),
    ),
    previous = totals(previousRows),
    progress = settings.goal
      ? Math.min(100, Math.max(0, (summary.result / settings.goal) * 100))
      : 0;
  const load = useCallback(async () => {
    setLoadError("");
    setLoaded(false);
    try {
      const data = await api("GET");
      setSavedRows(data.transactions);
      setSavedSettings(data.settings);
      setLoaded(true);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Seus dados estão indisponíveis.",
      );
    }
  }, []);
  useEffect(() => {
    const pref = localStorage.getItem("folga-data-mode");
    if (pref) setDemo(pref === "demo");
    void load();
  }, [load]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (
          busy ||
          entryOpen ||
          exportOpen ||
          planOpen ||
          deleteEntry ||
          (!demo && !loaded)
        )
          return;
        setEditing(null);
        rememberDialogFocus();
        setDraft(blankDraft(month));
        setFormError("");
        setEntryOpen(true);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [busy, entryOpen, exportOpen, planOpen, deleteEntry, demo, loaded, month]);
  function chooseMode(next: boolean) {
    setDemo(next);
    localStorage.setItem("folga-data-mode", next ? "demo" : "real");
    setNotice(
      next
        ? "Modo demonstração. Alterações de teste são temporárias."
        : "Seu controle pessoal. Os dados serão salvos na sua conta.",
    );
  }
  function setData(next: Transaction[]) {
    if (demo) setExampleRows(next);
    else setSavedRows(next);
  }
  function openEntry(row?: Transaction) {
    if (busy || (!demo && !loaded)) return;
    rememberDialogFocus();
    setEditing(row || null);
    setDraft(
      row
        ? {
            ...row,
            amount: (row.amount / 100).toFixed(2).replace(".", ","),
            installments: 1,
          }
        : blankDraft(month),
    );
    setFormError("");
    setEntryOpen(true);
  }
  function openPlan() {
    if (busy || (!demo && !loaded)) return;
    rememberDialogFocus();
    setGoalDraft((settings.goal / 100).toFixed(2).replace(".", ","));
    setBudgetDraft(
      Object.fromEntries(
        categories.map((cat) => [
          cat,
          ((settings.budgets[cat] || 0) / 100).toFixed(2).replace(".", ","),
        ]),
      ),
    );
    setFormError("");
    setPlanOpen(true);
  }
  async function saveEntry(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setFormError("");
    setBusy(true);
    try {
      const value = validateTransaction({
        ...draft,
        amount: parseAmount(draft.amount),
      });
      if (!demo && !loaded)
        throw new Error("Carregue seus dados antes de salvar.");
      if (editing) {
        const updated = demo
          ? { ...editing, ...value, installments: editing.installments }
          : (await api("PATCH", { ...value, id: editing.id })).transaction;
        setData(allRows.map((r) => (r.id === editing.id ? updated : r)));
        setNotice(
          demo ? "Lançamento de teste atualizado." : "Lançamento atualizado.",
        );
      } else {
        const added = demo
          ? makeTransactions(value)
          : (await api("POST", value)).transactions;
        setData([...allRows, ...added]);
        setNotice(
          demo
            ? "Lançamento de teste adicionado."
            : value.installments > 1
              ? "Compra salva com todas as parcelas."
              : "Lançamento salvo.",
        );
      }
      setMonth(value.date.slice(0, 7));
      setEntryOpen(false);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Confira os dados.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function toggleStatus(row: Transaction, animate = false) {
    if (busy || (!demo && !loaded)) return;
    setBusy(true);
    try {
      const status: Transaction["status"] =
        row.status === "paid" ? "pending" : "paid";
      const updated = demo
        ? { ...row, status }
        : (await api("PATCH", { id: row.id, statusOnly: true, status }))
            .transaction;
      if (
        animate &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        setLeavingId(row.id);
        await new Promise((resolve) => setTimeout(resolve, 240));
      }
      setData(allRows.map((r) => (r.id === row.id ? updated : r)));
      setLeavingId(null);
      setNotice(
        demo ? "Situação de teste atualizada." : "Situação atualizada.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Não foi possível atualizar.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function removeEntry() {
    if (!deleteEntry || busy || (!demo && !loaded)) return;
    setBusy(true);
    setFormError("");
    try {
      if (!demo) await api("DELETE", { id: deleteEntry.id });
      setData(allRows.filter((r) => r.id !== deleteEntry.id));
      setDeleteEntry(null);
      setNotice(
        demo ? "Lançamento de teste excluído." : "Lançamento excluído.",
      );
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Não foi possível excluir.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function savePlan(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError("");
    try {
      const goal = parseAmount(goalDraft || "0"),
        budgets = Object.fromEntries(
          categories.map((cat) => [cat, parseAmount(budgetDraft[cat] || "0")]),
        );
      if (
        [goal, ...Object.values(budgets)].some(
          (v) => !Number.isSafeInteger(v) || v < 0 || v > 1000000000,
        )
      )
        throw new Error("Use valores positivos com até duas casas decimais.");
      if (!demo) {
        if (!loaded) throw new Error("Carregue seus dados antes de salvar.");
        await api("PUT", { month, goal, budgets });
        setSavedSettings({ ...savedSettings, [month]: { goal, budgets } });
      } else
        setExampleSettings({ ...exampleSettings, [month]: { goal, budgets } });
      setPlanOpen(false);
      setNotice(
        demo
          ? "Meta e limites de teste atualizados."
          : "Meta e limites deste mês salvos.",
      );
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Confira os valores.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (tool: unknown, opts: unknown) => unknown;
        };
      }
    ).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "navigate_finance_view",
            title: "Abrir uma tela de finanças",
            description:
              "Abre o dashboard, lançamentos, cartão ou demonstrativo; não altera registros.",
            inputSchema: {
              type: "object",
              properties: {
                view: {
                  type: "string",
                  enum: ["overview", "transactions", "cards", "statement"],
                },
              },
              required: ["view"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true },
            execute(input: unknown) {
              const v = (input as { view?: View })?.view;
              if (!nav.some((n) => n.view === v))
                throw new Error("Tela inválida.");
              setView(v!);
              return new Promise((resolve) =>
                requestAnimationFrame(() => resolve({ view: v })),
              );
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);
  const filtered = rows
    .filter(
      (r) =>
        (typeFilter === "all" || r.type === typeFilter) &&
        (statusFilter === "all" || r.status === statusFilter) &&
        (categoryFilter === "all" || r.category === categoryFilter) &&
        (!query ||
          (r.description + " " + r.category)
            .toLocaleLowerCase("pt-BR")
            .includes(query.toLocaleLowerCase("pt-BR"))),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const categoryTotals = categories.map((name, i) => ({
    name,
    color: categoryColors[i],
    paid: rows
      .filter(
        (r) =>
          r.type === "expense" && r.status === "paid" && r.category === name,
      )
      .reduce((v, r) => v + r.amount, 0),
    pending: rows
      .filter(
        (r) =>
          r.type === "expense" && r.status === "pending" && r.category === name,
      )
      .reduce((v, r) => v + r.amount, 0),
    limit: settings.budgets[name] || 0,
  }));
  const actions = (r: Transaction) => (
    <div className="row-actions">
      <button
        disabled={busy || (!demo && !loaded)}
        aria-label={
          (r.status === "paid"
            ? "Marcar como previsto: "
            : "Marcar como realizado: ") + r.description
        }
        title={
          r.status === "paid" ? "Marcar como previsto" : "Marcar como realizado"
        }
        onClick={() => void toggleStatus(r)}
      >
        {r.status === "paid" ? <RotateCcw size={16} /> : <Check size={17} />}
      </button>
      <button
        disabled={busy || (!demo && !loaded)}
        aria-label={"Editar " + r.description}
        onClick={() => openEntry(r)}
      >
        <Pencil size={16} />
      </button>
      <button
        disabled={busy || (!demo && !loaded)}
        aria-label={"Excluir " + r.description}
        onClick={() => {
          rememberDialogFocus();
          setFormError("");
          setDeleteEntry(r);
        }}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
  function table(list: Transaction[]) {
    return (
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Situação</th>
              <th className="numeric">Valor</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td className="date-cell">
                  {r.date.slice(8)}/{r.date.slice(5, 7)}
                </td>
                <td>
                  <strong>{r.description}</strong>
                  <small>
                    {r.payment === "card" ? "Cartão" : "Pix / débito"}
                    {r.installments > 1
                      ? " · " + r.installment + "/" + r.installments
                      : ""}
                  </small>
                </td>
                <td>{r.category}</td>
                <td>
                  <span className={"status " + r.status}>
                    {r.status === "paid"
                      ? r.type === "income"
                        ? "Recebido"
                        : "Pago"
                      : "Previsto"}
                  </span>
                </td>
                <td
                  className={
                    "numeric " + (r.type === "income" ? "positive" : "")
                  }
                >
                  {r.type === "income" ? "+" : "−"} {money(r.amount)}
                </td>
                <td>{actions(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && (
          <div className="empty-state">
            <ReceiptText size={28} />
            <h3>
              {rows.length
                ? "Nenhum resultado para esses filtros."
                : "Um mês pronto para começar."}
            </h3>
            <p>
              {rows.length
                ? "Ajuste os filtros para encontrar um lançamento."
                : "Adicione sua primeira receita ou despesa."}
            </p>
          </div>
        )}
      </div>
    );
  }
  const futureMonths = Array.from({ length: 6 }, (_, i) =>
    shiftMonth(month, i + 1),
  ).filter((value) => value <= "2100-12");
  return (
    <div className="app-shell">
      <IslandHeader
        view={view}
        month={month}
        onViewChange={setView}
        onMonthChange={setMonth}
      />
      <main>
        <div className="workspace">
          <div className="utility-bar">
            <div className="mode-controls">
              <span className="mode-pill">
                {demo ? "Demonstração" : loaded ? "Meu controle" : "Carregando"}
              </span>
              <button className="text-button" onClick={() => chooseMode(!demo)}>
                {demo ? "Usar meus dados" : "Ver demonstração"}
              </button>
            </div>
            <div className="toolbar-actions">
              <ExportStatement
                transactions={allRows}
                month={month}
                demo={demo}
                disabled={busy || (!demo && !loaded)}
                open={exportOpen}
                onOpenChange={setExportOpen}
                onNotice={setNotice}
              />
              <button
                className="secondary-button"
                onClick={openPlan}
                disabled={busy || (!demo && !loaded)}
              >
                <SlidersHorizontal size={16} /> Meta e limites
              </button>
            </div>
          </div>
          {loadError && (
            <div className="error-banner" role="alert">
              <span>{loadError}</span>
              <button className="text-button" onClick={() => void load()}>
                Tentar novamente
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          {view !== "overview" && (
            <div className="page-head">
              <div>
                <span className="eyebrow">{monthTitle(month)}</span>
                <h1>{titles[view]}</h1>
              </div>
            </div>
          )}
          {view === "overview" && (
            <>
              <h1 className="sr-only">Meu mês — {monthTitle(month)}</h1>
              <div
                className="overview-grid"
                key={month + (demo ? "demo" : "real")}
              >
                <section
                  className="balance-panel"
                  aria-labelledby="balance-heading"
                >
                  <div className="balance-top">
                    <h2 id="balance-heading">Resultado do mês</h2>
                    <span className="mini-label">RECEBIDO − PAGO</span>
                  </div>
                  <div className="balance-content">
                    <div className="balance-copy">
                      <div
                        className={
                          "balance-value " +
                          (summary.result < 0 ? "negative" : "")
                        }
                      >
                        <AnimatedNumber value={summary.result} />
                      </div>
                      <div className="flow-stats">
                        <span className="positive">
                          <ArrowDownLeft size={18} />
                          <AnimatedNumber value={summary.income} /> recebido
                        </span>
                        <span className="negative">
                          <ArrowUpRight size={18} />
                          <AnimatedNumber value={summary.expense} /> pago
                        </span>
                      </div>
                    </div>
                    <BalanceSparkline rows={rows} />
                  </div>
                  <div className="projection">
                    <span>Previsto ao fechar</span>
                    <strong
                      className={
                        summary.projected < 0 ? "negative" : "positive"
                      }
                    >
                      <AnimatedNumber value={summary.projected} />
                    </strong>
                    <span className="projection-legend">
                      <i /> previsão
                    </span>
                  </div>
                  <p className="context-note">
                    Entradas e saídas do mês, sem saldo bancário inicial.
                  </p>
                </section>
                <section className="goal-panel" aria-labelledby="goal-heading">
                  <div className="section-head">
                    <h2 id="goal-heading">Meta de sobra</h2>
                    <button
                      className="goal-edit"
                      aria-label="Editar meta do mês"
                      disabled={busy || (!demo && !loaded)}
                      onClick={openPlan}
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                  <GoalRing progress={progress} />
                  {settings.goal > 0 ? (
                    <>
                      <p className="goal-caption">
                        de <strong>{money(settings.goal)}</strong> em sobra
                      </p>
                      <span className="goal-footnote">
                        {progress >= 100
                          ? "Meta do mês alcançada"
                          : "Um passo de cada vez"}
                      </span>
                    </>
                  ) : (
                    <button
                      className="text-button"
                      onClick={openPlan}
                      disabled={busy || (!demo && !loaded)}
                    >
                      Definir minha meta
                    </button>
                  )}
                </section>
                <section
                  className="category-panel"
                  aria-labelledby="category-heading"
                >
                  <div className="section-head">
                    <h2 id="category-heading">Para onde foi</h2>
                    <span className="mini-label">DESPESAS PAGAS</span>
                  </div>
                  <div className="category-map">
                    {categoryTotals
                      .filter((c) => c.paid > 0)
                      .sort((a, b) => b.paid - a.paid)
                      .map((c, index, paidCategories) => {
                        const tile = (item: typeof c, large: boolean) => (
                          <button
                            className={
                              "category-tile " + (large ? "category-main" : "")
                            }
                            key={item.name}
                            style={
                              {
                                "--tile-color": item.color,
                                flex: item.paid,
                              } as CSSProperties
                            }
                            aria-label={
                              item.name +
                              ": " +
                              money(item.paid) +
                              ", " +
                              Math.round((item.paid / summary.expense) * 100) +
                              "% das despesas. Ver lançamentos."
                            }
                            onClick={() => {
                              setView("transactions");
                              setCategoryFilter(item.name);
                              setTypeFilter("expense");
                              setStatusFilter("paid");
                              setQuery("");
                            }}
                          >
                            <strong>{item.name}</strong>
                            <span>{money(item.paid)}</span>
                            <small>
                              {Math.round((item.paid / summary.expense) * 100)}%
                              das despesas
                            </small>
                          </button>
                        );
                        if (index === 0) return tile(c, true);
                        if (index === 1)
                          return (
                            <div
                              className="category-secondary"
                              key="secondary"
                              style={{
                                flex: paidCategories
                                  .slice(1)
                                  .reduce((s, cat) => s + cat.paid, 0),
                              }}
                            >
                              {paidCategories
                                .slice(1)
                                .map((item) => tile(item, false))}
                            </div>
                          );
                        return null;
                      })}
                    {!summary.expense && (
                      <div className="empty-state">
                        <ReceiptText size={28} />
                        <h3>Ainda sem despesas pagas</h3>
                        <p>Seus gastos aparecerão aqui por categoria.</p>
                      </div>
                    )}
                  </div>
                  <p className="context-note">
                    Toque em uma categoria para ver os gastos.
                  </p>
                </section>
                <section className="due-panel" aria-labelledby="due-heading">
                  <div className="section-head">
                    <h2 id="due-heading">Próximos vencimentos</h2>
                    <strong className="due-total">
                      {money(summary.pendingExpense)}
                    </strong>
                  </div>
                  <div className="due-list">
                    {rows
                      .filter(
                        (r) => r.type === "expense" && r.status === "pending",
                      )
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .slice(0, 4)
                      .map((r) => (
                        <div
                          className={
                            "due-item " + (leavingId === r.id ? "leaving" : "")
                          }
                          key={r.id}
                        >
                          <span className="due-date">
                            {r.date.slice(8)}/{r.date.slice(5, 7)}
                          </span>
                          <div className="due-copy">
                            <span className="due-name">{r.description}</span>
                            <small>
                              {r.installments > 1
                                ? "Parcela " +
                                  r.installment +
                                  "/" +
                                  r.installments
                                : r.category}
                            </small>
                          </div>
                          <strong className="due-amount">
                            {money(r.amount)}
                          </strong>
                          <button
                            className="due-pay"
                            title="Marcar como pago"
                            aria-label={
                              "Marcar " + r.description + " como pago"
                            }
                            disabled={busy || (!demo && !loaded)}
                            onClick={() => void toggleStatus(r, true)}
                          >
                            <Check size={17} />
                          </button>
                        </div>
                      ))}
                    {!summary.pendingExpense && (
                      <div className="empty-state">
                        <Check size={28} />
                        <h3>Tudo em dia neste mês</h3>
                        <p>Nenhuma despesa prevista a pagar.</p>
                      </div>
                    )}
                  </div>
                  <div className="due-track" aria-hidden="true">
                    <div
                      style={{
                        width:
                          (summary.expense + summary.pendingExpense
                            ? (summary.expense /
                                (summary.expense + summary.pendingExpense)) *
                              100
                            : 0) + "%",
                      }}
                    />
                  </div>
                  <div className="due-footer">
                    <span>
                      {summary.pendingExpense
                        ? "Marque como pago ao quitar uma conta."
                        : "Suas próximas contas aparecerão aqui."}
                    </span>
                    <button
                      className="text-button"
                      onClick={() => {
                        setView("transactions");
                        setStatusFilter("pending");
                        setTypeFilter("expense");
                        setCategoryFilter("all");
                        setQuery("");
                      }}
                    >
                      Ver todas
                    </button>
                  </div>
                </section>
              </div>
              <section className="recent-panel">
                <div className="section-head">
                  <h2>Últimos lançamentos</h2>
                  <button
                    className="text-button"
                    onClick={() => {
                      setView("transactions");
                      setQuery("");
                      setCategoryFilter("all");
                      setStatusFilter("all");
                      setTypeFilter("all");
                    }}
                  >
                    Ver todos
                  </button>
                </div>
                {table(
                  [...rows]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 3),
                )}
              </section>
            </>
          )}
          {view === "transactions" && (
            <section className="list-panel">
              <div className="filters">
                <label className="search-field">
                  <Search size={17} />
                  <span className="sr-only">Buscar lançamentos</span>
                  <input
                    placeholder="Buscar descrição ou categoria"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <label>
                  <span className="sr-only">Tipo</span>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="all">Todos os tipos</option>
                    <option value="expense">Despesas</option>
                    <option value="income">Receitas</option>
                  </select>
                </label>
                <label>
                  <span className="sr-only">Situação</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">Todas as situações</option>
                    <option value="paid">Realizados</option>
                    <option value="pending">Previstos</option>
                  </select>
                </label>
                <label>
                  <span className="sr-only">Categoria</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="all">Todas as categorias</option>
                    {[...categories, "Salário", "Extra"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="filter-summary">
                <span>
                  {filtered.length} lançamento{filtered.length !== 1 ? "s" : ""}
                </span>
                <span>
                  Recebido: <strong>{money(totals(filtered).income)}</strong>
                </span>
                <span>
                  Pago: <strong>{money(totals(filtered).expense)}</strong>
                </span>
                <span>
                  Previsto a pagar:{" "}
                  <strong>{money(totals(filtered).pendingExpense)}</strong>
                </span>
              </div>
              {table(filtered)}
            </section>
          )}
          {view === "cards" && (
            <>
              <div className="card-summary">
                <div>
                  <CreditCard size={24} />
                  <span>Despesas no cartão neste mês</span>
                  <strong>
                    {money(
                      rows
                        .filter(
                          (r) => r.payment === "card" && r.type === "expense",
                        )
                        .reduce((v, r) => v + r.amount, 0),
                    )}
                  </strong>
                </div>
                <div>
                  <span>Do cartão, ainda a pagar no mês</span>
                  <strong>
                    {money(
                      rows
                        .filter(
                          (r) =>
                            r.payment === "card" &&
                            r.type === "expense" &&
                            r.status === "pending",
                        )
                        .reduce((v, r) => v + r.amount, 0),
                    )}
                  </strong>
                </div>
                <div>
                  <span>Compromissos futuros já lançados</span>
                  <strong>
                    {money(
                      allRows
                        .filter(
                          (r) =>
                            r.payment === "card" &&
                            r.type === "expense" &&
                            r.status === "pending" &&
                            r.date.slice(0, 7) > month,
                        )
                        .reduce((v, r) => v + r.amount, 0),
                    )}
                  </strong>
                </div>
              </div>
              <section className="future-panel">
                <div className="section-head">
                  <h2>
                    {futureMonths.length === 6
                      ? "Os próximos seis meses"
                      : "Próximos meses disponíveis"}
                  </h2>
                  <span className="mini-label">PARCELAS PREVISTAS</span>
                </div>
                <div className="future-months">
                  {futureMonths.map((m) => {
                    const value = allRows
                      .filter(
                        (r) =>
                          r.payment === "card" &&
                          r.type === "expense" &&
                          r.status === "pending" &&
                          r.date.slice(0, 7) === m,
                      )
                      .reduce((v, r) => v + r.amount, 0);
                    return (
                      <button key={m} onClick={() => setMonth(m)}>
                        <span>{monthTitle(m)}</span>
                        <strong>{money(value)}</strong>
                      </button>
                    );
                  })}
                </div>
                {!futureMonths.length && (
                  <p className="context-note">
                    O período de cadastro termina em dezembro de 2100.
                  </p>
                )}
                <p className="context-note">
                  Valores dos lançamentos cadastrados. O sistema não está
                  conectado à fatura do banco.
                </p>
              </section>
              <section className="recent-panel">
                <div className="section-head">
                  <h2>Cartão em {monthTitle(month)}</h2>
                  <span className="mini-label">PARCELAS E COMPRAS À VISTA</span>
                </div>
                {table(
                  rows
                    .filter((r) => r.payment === "card" && r.type === "expense")
                    .sort((a, b) => a.date.localeCompare(b.date)),
                )}
              </section>
            </>
          )}
          {view === "statement" && (
            <>
              <div className="statement-equation">
                <div>
                  <span>Receitas recebidas</span>
                  <strong>{money(summary.income)}</strong>
                </div>
                <span className="equation-sign">−</span>
                <div>
                  <span>Despesas pagas</span>
                  <strong>{money(summary.expense)}</strong>
                </div>
                <span className="equation-sign">=</span>
                <div>
                  <span>Resultado realizado</span>
                  <strong
                    className={summary.result < 0 ? "negative" : "positive"}
                  >
                    {money(summary.result)}
                  </strong>
                </div>
              </div>
              <section className="statement-panel">
                <div className="section-head">
                  <h2>Despesas por categoria</h2>
                  <button
                    className="text-button"
                    onClick={openPlan}
                    disabled={busy || (!demo && !loaded)}
                  >
                    Ajustar limites
                  </button>
                </div>
                <div className="table-scroll">
                  <table className="data-table statement-table">
                    <thead>
                      <tr>
                        <th>Categoria</th>
                        <th className="numeric">Limite</th>
                        <th className="numeric">Pago</th>
                        <th className="numeric">A pagar</th>
                        <th className="numeric">Disponível no limite</th>
                        <th className="numeric">% pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryTotals.map((c) => (
                        <tr key={c.name}>
                          <td>
                            <button
                              className="text-button category-link"
                              onClick={() => {
                                setView("transactions");
                                setCategoryFilter(c.name);
                                setTypeFilter("expense");
                                setStatusFilter("all");
                                setQuery("");
                              }}
                            >
                              <i style={{ background: c.color }} />
                              {c.name}
                            </button>
                          </td>
                          <td className="numeric">
                            {c.limit ? money(c.limit) : "Não definido"}
                          </td>
                          <td className="numeric">{money(c.paid)}</td>
                          <td className="numeric">{money(c.pending)}</td>
                          <td
                            className={
                              "numeric " +
                              (c.limit && c.limit - c.paid - c.pending < 0
                                ? "negative"
                                : "")
                            }
                          >
                            {c.limit
                              ? money(c.limit - c.paid - c.pending)
                              : "—"}
                          </td>
                          <td className="numeric">
                            {summary.expense
                              ? ((c.paid / summary.expense) * 100)
                                  .toFixed(1)
                                  .replace(".", ",")
                              : "0"}
                            %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th>Total</th>
                        <td className="numeric">
                          {Object.values(settings.budgets).some((v) => v > 0)
                            ? money(
                                Object.values(settings.budgets).reduce(
                                  (a, v) => a + v,
                                  0,
                                ),
                              )
                            : "—"}
                        </td>
                        <td className="numeric">{money(summary.expense)}</td>
                        <td className="numeric">
                          {money(summary.pendingExpense)}
                        </td>
                        <td className="numeric">—</td>
                        <td className="numeric">
                          {summary.expense ? "100" : "0"}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="context-note">
                  Disponível no limite = limite − pago − a pagar. Categorias sem
                  limite não entram nesse cálculo.
                </p>
              </section>
              <section className="statement-panel">
                <div className="section-head">
                  <h2>Receitas por origem</h2>
                </div>
                {["Salário", "Extra", "Outros"].map((c) => {
                  const paid = rows
                      .filter(
                        (r) =>
                          r.type === "income" &&
                          r.status === "paid" &&
                          r.category === c,
                      )
                      .reduce((v, r) => v + r.amount, 0),
                    pending = rows
                      .filter(
                        (r) =>
                          r.type === "income" &&
                          r.status === "pending" &&
                          r.category === c,
                      )
                      .reduce((v, r) => v + r.amount, 0);
                  return (
                    <div className="income-row" key={c}>
                      <span>{c}</span>
                      <span>
                        Recebido <strong>{money(paid)}</strong>
                      </span>
                      <span>
                        Previsto <strong>{money(pending)}</strong>
                      </span>
                    </div>
                  );
                })}
              </section>
              <div className="closing-row">
                <div>
                  <span>Resultado previsto ao fechar o mês</span>
                  <strong className={summary.projected < 0 ? "negative" : ""}>
                    {money(summary.projected)}
                  </strong>
                  <small>Inclui receitas e despesas previstas.</small>
                </div>
                <div>
                  <span>Resultado realizado no mês anterior</span>
                  <strong>
                    {previousRows.length
                      ? money(previous.result)
                      : "Sem comparação"}
                  </strong>
                </div>
              </div>
              <p className="export-note">
                Baixe este período em Excel ou CSV pelo botão Baixar extrato.
                Para montar seus dashboards, escolha o formato Power BI.
              </p>
            </>
          )}
          <SiteFooter demo={demo} monthLabel={monthTitle(month)} />
        </div>
      </main>
      <div className="floating-entry">
        <button
          className="floating-button"
          disabled={busy || (!demo && !loaded)}
          onClick={() => openEntry()}
          aria-keyshortcuts="Control+k Meta+k"
        >
          <Plus size={20} />
          <span>Novo lançamento</span>
          <kbd className="shortcut">Ctrl K</kbd>
        </button>
      </div>
      <Dialog
        open={entryOpen}
        onOpenChange={(open) => {
          if (!busy) setEntryOpen(open);
        }}
      >
        <DialogContent
          className="finance-dialog finance-drawer"
          onCloseAutoFocus={restoreDialogFocus}
        >
          <span className="drawer-kicker">SEU CONTROLE, EM DIA</span>
          <DialogTitle className="drawer-heading">
            {editing ? "Editar lançamento" : "Novo lançamento"}
          </DialogTitle>
          <DialogDescription>
            {demo
              ? "Teste livremente. Este lançamento ficará apenas na demonstração."
              : editing && editing.installments > 1
                ? "Esta edição altera apenas a parcela selecionada."
                : "Registre o que entrou ou saiu, com a data correspondente."}
          </DialogDescription>
          <form onSubmit={saveEntry} className="finance-form">
            <div className="field-pair">
              <label>
                Tipo
                <select
                  value={draft.type}
                  disabled={!!editing && editing.installments > 1}
                  onChange={(e) => {
                    const type = e.target.value as Draft["type"];
                    setDraft({
                      ...draft,
                      type,
                      category: type === "income" ? "Salário" : "Alimentação",
                      payment: "pix",
                      installments: 1,
                    });
                  }}
                >
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                </select>
              </label>
              <label>
                Situação
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      status: e.target.value as Draft["status"],
                    })
                  }
                >
                  <option value="paid">
                    {draft.type === "income" ? "Já recebido" : "Já pago"}
                  </option>
                  <option value="pending">Previsto</option>
                </select>
              </label>
            </div>
            <label>
              Descrição
              <input
                autoFocus
                required
                maxLength={100}
                placeholder={
                  draft.type === "income"
                    ? "Ex.: Salário"
                    : "Ex.: Mercado da semana"
                }
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </label>
            <div className="field-pair">
              <label>
                {draft.installments > 1 && !editing
                  ? "Valor total da compra (R$)"
                  : "Valor (R$)"}
                <input
                  inputMode="decimal"
                  required
                  placeholder="0,00"
                  value={draft.amount}
                  onChange={(e) =>
                    setDraft({ ...draft, amount: e.target.value })
                  }
                />
              </label>
              <label>
                {draft.payment === "card" ? "Vencimento / data" : "Data"}
                <input
                  type="date"
                  required
                  min="2000-01-01"
                  max="2100-12-31"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
              </label>
            </div>
            <div className="field-pair">
              <label>
                Categoria
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value })
                  }
                >
                  {(draft.type === "income"
                    ? ["Salário", "Extra", "Outros"]
                    : categories
                  ).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Pagamento
                <select
                  value={draft.payment}
                  disabled={
                    draft.type === "income" ||
                    (!!editing && editing.installments > 1)
                  }
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      payment: e.target.value as Draft["payment"],
                      installments: 1,
                    })
                  }
                >
                  <option value="pix">Pix / débito</option>
                  <option value="card">Cartão</option>
                </select>
              </label>
            </div>
            {draft.type === "expense" &&
              draft.payment === "card" &&
              !editing && (
                <label>
                  Quantidade de parcelas
                  <select
                    value={draft.installments}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        installments: Number(e.target.value),
                      })
                    }
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1 === 1 ? "À vista" : i + 1 + " parcelas"}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            {draft.installments > 1 && !editing && (
              <p className="form-note">
                A data é o vencimento da primeira parcela. As demais serão
                previstas nos meses seguintes. A situação escolhida vale para a
                primeira.
              </p>
            )}
            {editing && editing.installments > 1 && (
              <p className="form-note">
                Parcela {editing.installment} de {editing.installments}. As
                outras parcelas mantêm seus valores.
              </p>
            )}
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="form-buttons">
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => setEntryOpen(false)}
              >
                Cancelar
              </button>
              <button className="primary-button" disabled={busy}>
                {busy ? "Salvando…" : "Salvar lançamento"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={planOpen}
        onOpenChange={(open) => {
          if (!busy) setPlanOpen(open);
        }}
      >
        <DialogContent
          className="finance-dialog"
          onCloseAutoFocus={restoreDialogFocus}
        >
          <DialogTitle>Meta e limites de {monthTitle(month)}</DialogTitle>
          <DialogDescription>
            Escolha quanto quer que sobre e um teto para cada categoria neste
            mês.
          </DialogDescription>
          <form className="finance-form" onSubmit={savePlan}>
            <label>
              Meta de sobra no mês (R$)
              <input
                autoFocus
                inputMode="decimal"
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
              />
            </label>
            <h3>Limites de gastos</h3>
            <p className="form-note">Deixe zero para não definir um limite.</p>
            <div className="budget-fields">
              {categories.map((c) => (
                <label key={c}>
                  {c} (R$)
                  <input
                    inputMode="decimal"
                    value={budgetDraft[c] || ""}
                    onChange={(e) =>
                      setBudgetDraft({ ...budgetDraft, [c]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="form-buttons">
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => setPlanOpen(false)}
              >
                Cancelar
              </button>
              <button className="primary-button" disabled={busy}>
                {busy ? "Salvando…" : "Salvar meta e limites"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleteEntry}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleteEntry(null);
        }}
      >
        <DialogContent
          className="finance-dialog"
          onCloseAutoFocus={restoreDialogFocus}
        >
          <DialogTitle>Excluir este lançamento?</DialogTitle>
          <DialogDescription>
            {deleteEntry?.description} · {money(deleteEntry?.amount || 0)}. A
            exclusão altera os totais do mês.
            {deleteEntry && deleteEntry.installments > 1
              ? " Somente esta parcela será excluída."
              : ""}
          </DialogDescription>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="form-buttons">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setDeleteEntry(null)}
            >
              Cancelar
            </button>
            <button
              className="danger-button"
              disabled={busy}
              onClick={() => void removeEntry()}
            >
              {busy ? "Excluindo…" : "Excluir lançamento"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function AnimatedNumber({
  value,
  percentage = false,
}: {
  value: number;
  percentage?: boolean;
}) {
  const [display, setDisplay] = useState(0);
  const previous = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = requestAnimationFrame(() => {
        previous.current = value;
        setDisplay(value);
      });
      return () => cancelAnimationFrame(frame);
    }
    const from = previous.current;
    let frame = 0;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = Math.min(1, (now - start) / 750);
      const current = Math.round(
        from + (value - from) * (1 - Math.pow(1 - elapsed, 3)),
      );
      previous.current = current;
      setDisplay(current);
      if (elapsed < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  const format = (number: number) =>
    percentage ? Math.round(number) + "%" : money(number);
  return (
    <>
      <span aria-hidden="true">{format(display)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}

function GoalRing({ progress }: { progress: number }) {
  return (
    <div
      className="goal-ring"
      role="progressbar"
      aria-label="Sobra do mês em relação à meta"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ "--ring-progress": progress } as CSSProperties}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle
          className="ring-track"
          cx="60"
          cy="60"
          r="52"
          fill="none"
          strokeWidth="9"
        />
        <circle
          className="ring-progress"
          cx="60"
          cy="60"
          r="52"
          fill="none"
          strokeWidth="9"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={100 - progress}
          strokeLinecap="round"
        />
      </svg>
      <div className="ring-value">
        <AnimatedNumber value={progress} percentage />
      </div>
    </div>
  );
}

function BalanceSparkline({ rows }: { rows: Transaction[] }) {
  const groups = Array.from({ length: 5 }, (_, week) =>
    totals(
      rows.filter(
        (r) =>
          Math.min(4, Math.floor((Number(r.date.slice(8)) - 1) / 7)) === week,
      ),
    ),
  );
  let running = 0;
  const realized = [0, ...groups.map((group) => (running += group.result))];
  let projected = realized[realized.length - 1];
  const expected = [
    projected,
    ...groups.map(
      (group) => (projected += group.pendingIncome - group.pendingExpense),
    ),
  ];
  const values = [...realized, ...expected];
  const min = Math.min(...values),
    range = Math.max(1, Math.max(...values) - min);
  const y = (value: number) => 115 - ((value - min) / range) * 90;
  const actualPath = realized
    .map(
      (value, index) =>
        (index ? "L" : "M") + (12 + index * 38) + "," + y(value),
    )
    .join(" ");
  const forecastPath = expected
    .map(
      (value, index) =>
        (index ? "L" : "M") + (202 + index * 16) + "," + y(value),
    )
    .join(" ");
  return (
    <div className="balance-sparkline">
      <svg
        viewBox="0 0 300 140"
        role="img"
        aria-label="Evolução do resultado realizado por semana e impacto das receitas e despesas previstas."
      >
        <defs>
          <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity=".18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={actualPath + " L202,140 L12,140 Z"}
          fill="url(#balance-fill)"
        />
        <path
          className="sparkline-actual"
          d={actualPath}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          className="sparkline-forecast"
          d={forecastPath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="202"
          cy={y(realized[realized.length - 1])}
          r="4"
          fill="currentColor"
        />
      </svg>
      <div className="sparkline-labels">
        <span>Realizado</span>
        <span>Previsão</span>
      </div>
    </div>
  );
}

function IslandHeader({
  view,
  month,
  onViewChange,
  onMonthChange,
}: {
  view: View;
  month: string;
  onViewChange: (view: View) => void;
  onMonthChange: (month: string) => void;
}) {
  const [compact, setCompact] = useState(false);
  const [mobileMenu, setMobileMenu] = useState({ view, open: false });
  if (mobileMenu.view !== view) setMobileMenu({ view, open: false });
  const mobileMenuOpen = mobileMenu.view === view && mobileMenu.open;
  const setMobileMenuOpen = useCallback(
    (open: boolean) => setMobileMenu({ view, open }),
    [view],
  );
  const [pill, setPill] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    ready: false,
  });
  const navElement = useRef<HTMLElement>(null);
  const mobileNavElement = useRef<HTMLElement>(null);
  const selectedLabel =
    nav.find((item) => item.view === view)?.label || "Meu mês";
  const readableMonth = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(month + "-01T12:00:00Z"))
    .replace(".", "")
    .replace(" de ", " ");

  useEffect(() => {
    const update = () =>
      setCompact((current) => window.scrollY > (current ? 24 : 64));
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 900px)");
    const closeOnDesktop = () => {
      if (!mobile.matches) setMobileMenuOpen(false);
    };
    mobile.addEventListener("change", closeOnDesktop);
    return () => mobile.removeEventListener("change", closeOnDesktop);
  }, [setMobileMenuOpen]);

  useEffect(() => {
    const element = navElement.current;
    const active = element?.querySelector<HTMLButtonElement>(
      `[data-view="${view}"]`,
    );
    if (!element || !active) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      setPill({
        x: active.offsetLeft,
        y: active.offsetTop,
        width: active.offsetWidth,
        height: active.offsetHeight,
        ready: true,
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(active);
    const frame = requestAnimationFrame(measure);
    void document.fonts.ready.then(measure);
    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [view, compact]);

  return (
    <header
      className={"app-header dynamic-island " + (compact ? "is-scrolled" : "")}
    >
      <Link
        className="brand"
        href="/"
        aria-label="Zelo, início"
        onClick={() => onViewChange("overview")}
      >
        <span className="brand-mark" aria-hidden="true">
          {/* A marca já foi otimizada localmente; este Worker não usa um otimizador de imagens. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="brand-logo"
            src="/zelo-logo.png"
            alt=""
            width={40}
            height={40}
            decoding="async"
          />
        </span>
        <span className="brand-name">
          Zelo<span className="brand-period">.</span>
        </span>
      </Link>
      <nav
        className="tab-nav"
        aria-label="Telas de finanças"
        ref={navElement}
        data-ready={pill.ready}
      >
        <span
          className="island-indicator"
          aria-hidden="true"
          style={{
            width: pill.width,
            height: pill.height,
            transform: `translate(${pill.x}px, ${pill.y}px)`,
            opacity: pill.ready ? 1 : 0,
          }}
        />
        {nav.map((item) => (
          <button
            key={item.view}
            data-view={item.view}
            aria-current={view === item.view ? "page" : undefined}
            className={"nav-item " + (view === item.view ? "active" : "")}
            onClick={() => onViewChange(item.view)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="month-picker">
        <button
          aria-label="Mês anterior"
          disabled={month <= "2000-01"}
          onClick={() => onMonthChange(shiftMonth(month, -1))}
        >
          <ChevronLeft size={18} />
        </button>
        <label className="month-field">
          <span className="sr-only">Mês de referência</span>
          <span className="month-label" aria-hidden="true">
            {readableMonth}
            <CalendarDays size={15} />
          </span>
          <input
            type="month"
            value={month}
            min="2000-01"
            max="2100-12"
            onClick={(event) => {
              try {
                event.currentTarget.showPicker?.();
              } catch {
                // O campo nativo continua editável pelo teclado.
              }
            }}
            onChange={(event) => {
              if (/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(event.target.value))
                onMonthChange(event.target.value);
            }}
          />
        </label>
        <button
          aria-label="Próximo mês"
          disabled={month >= "2100-12"}
          onClick={() => onMonthChange(shiftMonth(month, 1))}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <Popover open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <PopoverTrigger asChild>
          <button
            className="mobile-menu-trigger"
            aria-label={
              (mobileMenuOpen ? "Fechar menu" : "Abrir menu") +
              ", tela atual: " +
              selectedLabel
            }
          >
            <span className="mobile-current-view" title={selectedLabel}>
              {selectedLabel}
            </span>
            <span className="mobile-menu-icon" aria-hidden="true">
              {mobileMenuOpen ? <X size={21} /> : <Menu size={22} />}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="mobile-navigation"
          align="end"
          sideOffset={18}
          collisionPadding={12}
          aria-label="Menu de navegação"
          onOpenAutoFocus={(event) => {
            const selected =
              mobileNavElement.current?.querySelector<HTMLButtonElement>(
                '[aria-current="page"]',
              );
            if (selected) {
              event.preventDefault();
              selected.focus();
            }
          }}
        >
          <span className="mobile-menu-heading">NAVEGAÇÃO</span>
          <nav aria-label="Telas de finanças no celular" ref={mobileNavElement}>
            {nav.map((item) => (
              <button
                key={item.view}
                className={
                  "mobile-menu-item " + (view === item.view ? "active" : "")
                }
                aria-current={view === item.view ? "page" : undefined}
                onClick={() => {
                  onViewChange(item.view);
                  setMobileMenuOpen(false);
                }}
              >
                <item.icon size={20} strokeWidth={1.7} aria-hidden="true" />
                <span>{item.label}</span>
                {view === item.view && <Check size={17} aria-hidden="true" />}
              </button>
            ))}
          </nav>
        </PopoverContent>
      </Popover>
    </header>
  );
}
