"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  History,
  Pencil,
  PiggyBank,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { localDate, localMonth, money, parseAmount } from "@/lib/finance";
import {
  contributionPlan,
  getDemoSavings,
  goalBalance,
  goalProgress,
  monthSaved,
  suggestMonthly,
  validateEntry,
  validateGoal,
  type SavingsData,
  type SavingsEntry,
  type SavingsGoal,
} from "@/lib/savings";

const emptyData: SavingsData = { goals: [], entries: [] };
const currencyInput = (amount: number) =>
  (amount / 100).toFixed(2).replace(".", ",");
const dateLabel = (date: string) =>
  date.slice(8) + "/" + date.slice(5, 7) + "/" + date.slice(0, 4);
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Não foi possível concluir. Tente novamente.";

type SavingsResponse = Partial<SavingsData> & {
  error?: string;
  goal?: SavingsGoal;
  entry?: SavingsEntry;
  ok?: boolean;
};

async function savingsApi(
  method: string,
  body?: unknown,
): Promise<SavingsResponse> {
  const response = await fetch("/api/savings", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const result = (await response.json()) as SavingsResponse;
  if (!response.ok)
    throw new Error(result.error || "Seus cofrinhos estão indisponíveis.");
  return result;
}

/** Um estado compartilhado pelo dashboard e pela página, isolando os exemplos dos dados pessoais. */
export function useSavings(demo: boolean) {
  const [examples, setExamples] = useState<SavingsData>(() =>
    getDemoSavings(localMonth()),
  );
  const [personal, setPersonal] = useState<SavingsData>(emptyData);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const request = useRef(0);
  const invalidateRequests = useCallback(() => {
    request.current++;
  }, []);
  const reload = useCallback(async () => {
    const id = ++request.current;
    setLoaded(false);
    setError("");
    try {
      const data = await savingsApi("GET");
      if (id !== request.current) return;
      if (!Array.isArray(data.goals) || !Array.isArray(data.entries))
        throw new Error("Não foi possível carregar todos os seus cofrinhos.");
      setPersonal({ goals: data.goals, entries: data.entries });
      setLoaded(true);
    } catch (caught) {
      if (id === request.current) setError(errorMessage(caught));
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled && !demo) void reload();
    });
    return () => {
      cancelled = true;
      invalidateRequests();
    };
  }, [demo, reload, invalidateRequests]);

  async function mutate(method: string, body: Record<string, unknown>) {
    if (lock.current) throw new Error("Aguarde o registro em andamento.");
    if (!demo && (!loaded || error))
      throw new Error("Carregue seus cofrinhos antes de alterar os dados.");
    lock.current = true;
    setBusy(true);
    try {
      if (!demo) {
        const result = await savingsApi(method, body);
        // O registro foi confirmado: uma falha ao atualizar a lista não deve permitir reenviá-lo.
        setPersonal((current) => {
          if (method === "POST" && result.goal)
            return {
              goals: [...current.goals, result.goal],
              entries: [...current.entries, ...(result.entries || [])],
            };
          if (method === "POST" && result.entry)
            return { ...current, entries: [...current.entries, result.entry] };
          if (method === "PATCH" && result.goal)
            return {
              ...current,
              goals: current.goals.map((goal) =>
                goal.id === result.goal!.id ? result.goal! : goal,
              ),
            };
          if (method === "DELETE" && body.action === "entry")
            return {
              ...current,
              entries: current.entries.filter((entry) => entry.id !== body.id),
            };
          if (method === "DELETE" && body.action === "goal")
            return {
              ...current,
              goals: current.goals.filter((goal) => goal.id !== body.id),
            };
          return current;
        });
        try {
          const fresh = await savingsApi("GET");
          if (!Array.isArray(fresh.goals) || !Array.isArray(fresh.entries))
            throw new Error("Não foi possível atualizar a lista.");
          setPersonal({ goals: fresh.goals, entries: fresh.entries });
          setLoaded(true);
        } catch {
          setLoaded(false);
          setError(
            "Seu registro foi salvo. Atualize a lista para continuar usando os cofrinhos.",
          );
        }
        return;
      }
      const today = localDate();
      const next: SavingsData = {
        goals: [...examples.goals],
        entries: [...examples.entries],
      };
      if (method === "POST" && body.action === "goal") {
        const value = validateGoal(body, today);
        const goal = {
          ...value,
          id: crypto.randomUUID(),
          createdAt: today,
          archived: false,
        } as SavingsGoal;
        next.goals.push(goal);
        const initial = Number(body.initialAmount || 0);
        if (initial) {
          if (
            !Number.isSafeInteger(initial) ||
            initial <= 0 ||
            initial > 1_000_000_000
          )
            throw new Error("Confira o valor já guardado.");
          next.entries.push({
            goalId: goal.id,
            amount: initial,
            date: today,
            kind: "initial",
            note: "Valor já guardado",
            id: crypto.randomUUID(),
          });
        }
      } else if (method === "POST" && body.action === "entry") {
        const value = validateEntry(body, today);
        const goal = next.goals.find((item) => item.id === value.goalId);
        if (!goal || goal.archived)
          throw new Error("Escolha um cofrinho ativo.");
        if (
          value.kind === "withdrawal" &&
          value.amount > goalBalance(goal, next.entries)
        )
          throw new Error("A retirada não pode ultrapassar o valor guardado.");
        next.entries.push({
          ...value,
          id: crypto.randomUUID(),
          createdAt: today,
        } as SavingsEntry);
      } else if (method === "PATCH") {
        const index = next.goals.findIndex((item) => item.id === body.id);
        if (index < 0) throw new Error("Cofrinho não encontrado.");
        const goal = next.goals[index];
        next.goals[index] =
          typeof body.archived === "boolean"
            ? { ...goal, archived: body.archived }
            : { ...goal, ...validateGoal({ ...goal, ...body }, today) };
      } else if (method === "DELETE" && body.action === "entry") {
        const entry = next.entries.find((item) => item.id === body.id);
        if (!entry) throw new Error("Registro não encontrado.");
        const remaining = next.entries.filter((item) => item.id !== body.id);
        const goal = next.goals.find((item) => item.id === entry.goalId)!;
        if (goalBalance(goal, remaining) < 0)
          throw new Error(
            "Essa exclusão deixaria o cofrinho negativo. Confira as retiradas primeiro.",
          );
        next.entries = remaining;
      } else if (method === "DELETE" && body.action === "goal") {
        if (next.entries.some((item) => item.goalId === body.id))
          throw new Error("Arquive o cofrinho para manter seu histórico.");
        next.goals = next.goals.filter((item) => item.id !== body.id);
      }
      setExamples(() => next);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    data: demo ? examples : personal,
    loaded: demo || loaded,
    error: demo ? "" : error,
    busy,
    reload,
    mutate,
    demo,
  };
}

type SavingsController = ReturnType<typeof useSavings>;

function Progress({
  goal,
  entries,
}: {
  goal: SavingsGoal;
  entries: SavingsEntry[];
}) {
  const percent = goalProgress(goal, entries);
  return (
    <div
      className="savings-progress"
      role="progressbar"
      aria-label={"Progresso de " + goal.name}
      aria-valuenow={Math.min(100, Math.round(percent))}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${money(goalBalance(goal, entries))} de ${money(goal.target)}`}
    >
      <span
        style={
          {
            "--savings-progress": Math.min(100, Math.max(0, percent)) + "%",
          } as CSSProperties
        }
      />
    </div>
  );
}

export function SavingsOverview({
  controller,
  month,
  onOpen,
}: {
  controller: SavingsController;
  month: string;
  onOpen: () => void;
}) {
  const { data, loaded, error } = controller;
  const goals = data.goals.filter((goal) => !goal.archived);
  const saved = goals.reduce(
    (sum, goal) => sum + goalBalance(goal, data.entries),
    0,
  );
  return (
    <section
      className="savings-overview"
      aria-labelledby="savings-overview-heading"
    >
      <div className="section-head">
        <h2 id="savings-overview-heading">
          <PiggyBank size={19} /> Meus cofrinhos
        </h2>
        <button
          className="text-button"
          onClick={onOpen}
          aria-label="Abrir meus cofrinhos"
        >
          <ChevronRight size={19} />
        </button>
      </div>
      {!loaded || error ? (
        <div className="savings-overview-empty">
          <PiggyBank size={32} />
          <p>{error || "Carregando seus cofrinhos…"}</p>
          <button className="text-button" onClick={onOpen}>
            Ver cofrinhos
          </button>
        </div>
      ) : !goals.length ? (
        <div className="savings-overview-empty">
          <PiggyBank size={36} />
          <h3>Um lugar para seus planos.</h3>
          <p>Escolha quanto juntar e acompanhe cada aporte.</p>
          <button className="primary-button" onClick={onOpen}>
            <Plus size={17} /> Criar meu cofrinho
          </button>
        </div>
      ) : (
        <>
          <span className="savings-caption">Guardado nas suas metas</span>
          <strong className="savings-overview-value">{money(saved)}</strong>
          <div className="savings-overview-list">
            {goals.slice(0, 2).map((goal) => (
              <button key={goal.id} onClick={onOpen}>
                <span>
                  {goal.name}
                  <small>
                    {money(goalBalance(goal, data.entries))} de{" "}
                    {money(goal.target)}
                  </small>
                </span>
                <strong>{Math.round(goalProgress(goal, data.entries))}%</strong>
                <Progress goal={goal} entries={data.entries} />
              </button>
            ))}
          </div>
          <div className="savings-overview-footer">
            <span>
              {money(
                goals.reduce(
                  (sum, goal) => sum + monthSaved(goal, data.entries, month),
                  0,
                ),
              )}{" "}
              guardados neste mês
            </span>
            <button className="text-button" onClick={onOpen}>
              Ver {goals.length > 2 ? "todos" : "metas"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

type GoalDraft = {
  name: string;
  target: string;
  deadline: string;
  monthly: string;
  initial: string;
  paydays: number[];
  weighted: boolean;
  weights: Record<number, string>;
};
const blankGoal = (): GoalDraft => ({
  name: "",
  target: "",
  deadline: "",
  monthly: "",
  initial: "",
  paydays: [5, 15],
  weighted: false,
  weights: { 5: "50", 15: "50" },
});

export function SavingsPage({
  controller,
  month,
}: {
  controller: SavingsController;
  month: string;
}) {
  const { data, loaded, error, busy, demo } = controller;
  const [archived, setArchived] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<{ goal: SavingsGoal | null } | null>(null);
  const [draft, setDraft] = useState<GoalDraft>(blankGoal);
  const [day, setDay] = useState("");
  const [entryForm, setEntryForm] = useState<{
    goal: SavingsGoal;
    kind: "deposit" | "withdrawal";
  } | null>(null);
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(localDate());
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<{
    action: "goal" | "entry";
    id: string;
    label: string;
  } | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const ready = loaded && !error && !busy;
  const today = localDate();
  const goals = data.goals.filter(
    (goal) => Boolean(goal.archived) === archived,
  );
  const active = data.goals.filter((goal) => !goal.archived);
  const detail = data.goals.find((goal) => goal.id === selected);
  const suggestions = active
    .flatMap((goal) =>
      contributionPlan(goal, data.entries, month, today).suggestions.map(
        (item) => ({ ...item, goal }),
      ),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const target = parseAmount(draft.target || "0");
  const initial = form?.goal
    ? goalBalance(form.goal, data.entries)
    : parseAmount(draft.initial || "0");
  let recommended =
    draft.deadline &&
    Number.isSafeInteger(target) &&
    Number.isSafeInteger(initial)
      ? suggestMonthly(target, draft.deadline, draft.paydays, today, initial)
      : null;
  if (form?.goal && recommended !== null && draft.paydays.length) {
    const edited = {
      ...form.goal,
      target,
      deadline: draft.deadline,
      paydays: draft.paydays,
      weights: draft.paydays.map(() => 1),
    };
    recommended = contributionPlan(
      edited,
      data.entries,
      localMonth(),
      today,
    ).minMonthly;
  }
  const scheduled = active.reduce(
    (sum, goal) =>
      sum + contributionPlan(goal, data.entries, month, today).monthlyTarget,
    0,
  );
  const monthlySaved = active.reduce(
    (sum, goal) => sum + monthSaved(goal, data.entries, month),
    0,
  );

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  function rememberFocus() {
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }
  function restoreFocus(event: Event) {
    event.preventDefault();
    if (returnFocus.current?.isConnected) returnFocus.current.focus();
    else document.querySelector<HTMLButtonElement>(".savings-new")?.focus();
  }
  function openGoal(goal: SavingsGoal | null = null) {
    if (!ready) return;
    rememberFocus();
    setDraft(
      goal
        ? {
            name: goal.name,
            target: currencyInput(goal.target),
            deadline: goal.deadline,
            monthly: currencyInput(goal.monthly),
            initial: "",
            paydays: [...goal.paydays],
            weighted: goal.weights.some((weight) => weight !== goal.weights[0]),
            weights: Object.fromEntries(
              goal.paydays.map((day, index) => [
                day,
                String(
                  Math.round(
                    (goal.weights[index] /
                      goal.weights.reduce((sum, weight) => sum + weight, 0)) *
                      100,
                  ),
                ),
              ]),
            ),
          }
        : blankGoal(),
    );
    setDay("");
    setFormError("");
    setForm({ goal });
  }
  function openEntry(
    goal: SavingsGoal,
    kind: "deposit" | "withdrawal" = "deposit",
    suggested?: number,
  ) {
    if (!ready || goal.archived) return;
    rememberFocus();
    setAmount(suggested ? currencyInput(suggested) : "");
    setEntryDate(today);
    setNote("");
    setFormError("");
    setEntryForm({ goal, kind });
  }
  async function saveGoal(event: FormEvent) {
    event.preventDefault();
    if (!ready || !form) return;
    setFormError("");
    try {
      const weights = draft.paydays.map((day) =>
        draft.weighted ? Number(draft.weights[day] || 0) : 1,
      );
      if (
        draft.weighted &&
        (weights.some((weight) => !Number.isInteger(weight) || weight <= 0) ||
          weights.reduce((sum, weight) => sum + weight, 0) !== 100)
      )
        throw new Error(
          "Distribua 100% entre os dias, com um percentual maior que zero em cada dia.",
        );
      const monthly = draft.monthly.trim()
        ? parseAmount(draft.monthly)
        : recommended === 0
          ? form.goal?.monthly || 1
          : recommended;
      if (monthly === null)
        throw new Error(
          "Escolha um prazo com pelo menos um dia de aporte disponível ou ajuste seus dias.",
        );
      const value = {
        name: draft.name,
        target: parseAmount(draft.target),
        deadline: draft.deadline,
        monthly,
        paydays: draft.paydays,
        weights,
      };
      validateGoal(value, today);
      const initialAmount = !form.goal ? parseAmount(draft.initial || "0") : 0;
      if (!Number.isSafeInteger(initialAmount) || initialAmount < 0)
        throw new Error("Confira o valor já guardado.");
      await controller.mutate(
        form.goal ? "PATCH" : "POST",
        form.goal
          ? { ...value, id: form.goal.id }
          : { ...value, action: "goal", initialAmount },
      );
      setForm(null);
      setNotice(
        form.goal ? "Cofrinho atualizado." : "Seu novo cofrinho está pronto.",
      );
    } catch (caught) {
      setFormError(errorMessage(caught));
    }
  }
  async function saveEntry(event: FormEvent) {
    event.preventDefault();
    if (!ready || !entryForm) return;
    setFormError("");
    try {
      await controller.mutate("POST", {
        action: "entry",
        goalId: entryForm.goal.id,
        kind: entryForm.kind,
        amount: parseAmount(amount),
        date: entryDate,
        note,
      });
      setEntryForm(null);
      setNotice(
        entryForm.kind === "deposit"
          ? "Valor guardado registrado. Mais um passo para sua meta."
          : "Retirada registrada.",
      );
    } catch (caught) {
      setFormError(errorMessage(caught));
    }
  }
  async function archive(goal: SavingsGoal) {
    try {
      await controller.mutate("PATCH", {
        id: goal.id,
        archived: !goal.archived,
      });
      setNotice(
        goal.archived
          ? "Cofrinho restaurado."
          : "Cofrinho arquivado. Seu histórico foi mantido.",
      );
      setSelected(null);
    } catch (caught) {
      setNotice(errorMessage(caught));
    }
  }
  async function remove() {
    if (!deleting || !ready) return;
    try {
      await controller.mutate("DELETE", {
        action: deleting.action,
        id: deleting.id,
      });
      setDeleting(null);
      setNotice("Registro excluído.");
    } catch (caught) {
      setFormError(errorMessage(caught));
    }
  }
  function requestDelete(action: "goal" | "entry", id: string, label: string) {
    rememberFocus();
    setFormError("");
    setDeleting({ action, id, label });
  }

  return (
    <div className="savings-page">
      <div className="savings-intro">
        <div>
          <p>Viagem, festa ou um novo começo. Cada plano tem seu lugar.</p>
          <span>
            Os aportes registram valores que você separou; não fazem
            transferências bancárias.
          </span>
        </div>
        <button
          className="primary-button savings-new"
          disabled={!ready}
          onClick={() => openGoal()}
        >
          <Plus size={18} /> Novo cofrinho
        </button>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void controller.reload()}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {!loaded ? (
        <div className="savings-loading" role="status">
          Carregando seus cofrinhos…
        </div>
      ) : (
        <>
          <div className="savings-summary">
            <div>
              <span>Guardado nas metas ativas</span>
              <strong>
                {money(
                  active.reduce(
                    (sum, goal) => sum + goalBalance(goal, data.entries),
                    0,
                  ),
                )}
              </strong>
            </div>
            <div>
              <span>Guardado neste mês</span>
              <strong>
                {money(monthlySaved)}
                <small> de {money(scheduled)} planejados</small>
              </strong>
            </div>
            <div className="savings-summary-count">
              <span>Planos em andamento</span>
              <strong>
                {active.length}
                <PiggyBank size={27} />
              </strong>
            </div>
          </div>
          <div className="savings-layout">
            <div className="savings-main">
              <div className="savings-list-heading">
                <h2>Seus planos</h2>
                <button
                  className={
                    "secondary-button savings-archive-filter " +
                    (archived ? "selected" : "")
                  }
                  onClick={() => {
                    setArchived(!archived);
                    setSelected(null);
                  }}
                >
                  <Archive size={15} /> {archived ? "Ver ativos" : "Arquivados"}
                </button>
              </div>
              {!goals.length ? (
                <div className="savings-empty">
                  <PiggyBank size={48} />
                  <h3>
                    {archived
                      ? "Nenhum cofrinho arquivado."
                      : "O primeiro passo cabe aqui."}
                  </h3>
                  <p>
                    {archived
                      ? "Quando arquivar uma meta, o histórico continuará disponível."
                      : "Crie uma meta, escolha seus dias de aporte e acompanhe o dinheiro guardado."}
                  </p>
                  {!archived && (
                    <button
                      className="primary-button"
                      disabled={!ready}
                      onClick={() => openGoal()}
                    >
                      <Plus size={17} /> Criar cofrinho
                    </button>
                  )}
                </div>
              ) : (
                <div className="savings-grid">
                  {goals.map((goal) => {
                    const balance = goalBalance(goal, data.entries);
                    const plan = contributionPlan(
                      goal,
                      data.entries,
                      month,
                      today,
                    );
                    const percent = goalProgress(goal, data.entries);
                    return (
                      <article
                        className={
                          "savings-card " +
                          (selected === goal.id ? "selected" : "")
                        }
                        key={goal.id}
                      >
                        <div className="savings-card-head">
                          <span className="savings-icon">
                            <PiggyBank size={24} />
                          </span>
                          <span
                            className={
                              "savings-card-tag " +
                              (percent >= 100 ? "complete" : "")
                            }
                          >
                            {goal.archived ? (
                              "Arquivado"
                            ) : percent >= 100 ? (
                              <>
                                <Check size={14} /> Meta alcançada
                              </>
                            ) : (
                              "Em andamento"
                            )}
                          </span>
                        </div>
                        <button
                          className="savings-card-title"
                          onClick={() =>
                            setSelected(selected === goal.id ? null : goal.id)
                          }
                          aria-expanded={selected === goal.id}
                        >
                          <h3>{goal.name}</h3>
                          <ChevronRight size={18} />
                        </button>
                        <div className="savings-card-value">
                          <strong>{money(balance)}</strong>
                          <span>de {money(goal.target)}</span>
                        </div>
                        <div className="savings-progress-caption">
                          <span>{Math.round(percent)}% da meta</span>
                          <span>
                            Faltam {money(Math.max(0, goal.target - balance))}
                          </span>
                        </div>
                        <Progress goal={goal} entries={data.entries} />
                        <div className="savings-card-plan">
                          <span>
                            <CalendarDays size={15} /> Até{" "}
                            {dateLabel(goal.deadline)}
                          </span>
                          <span>
                            {balance >= goal.target
                              ? "Meta alcançada"
                              : money(goal.monthly) + " / mês"}
                          </span>
                        </div>
                        <div className="savings-card-month">
                          <span>
                            Neste mês: <strong>{money(plan.saved)}</strong>
                          </span>
                          <span>de {money(plan.monthlyTarget)}</span>
                        </div>
                        <div className="savings-card-actions">
                          {!goal.archived && (
                            <button
                              className="primary-button"
                              disabled={!ready}
                              onClick={() => openEntry(goal)}
                            >
                              <Plus size={16} /> Guardar
                            </button>
                          )}
                          <button
                            className="secondary-button"
                            onClick={() =>
                              setSelected(selected === goal.id ? null : goal.id)
                            }
                          >
                            <History size={16} /> Detalhes
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              {detail && (
                <section
                  className="savings-detail"
                  aria-labelledby="savings-detail-heading"
                >
                  <div className="section-head">
                    <div>
                      <span className="eyebrow">HISTÓRICO DO COFRINHO</span>
                      <h2 id="savings-detail-heading">{detail.name}</h2>
                    </div>
                    <button
                      className="savings-icon-button"
                      aria-label="Fechar detalhes"
                      onClick={() => setSelected(null)}
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="savings-detail-actions">
                    <button
                      className="secondary-button"
                      disabled={!ready || detail.archived}
                      onClick={() => openGoal(detail)}
                    >
                      <Pencil size={15} /> Editar meta
                    </button>
                    <button
                      className="secondary-button"
                      disabled={
                        !ready ||
                        detail.archived ||
                        goalBalance(detail, data.entries) === 0
                      }
                      onClick={() => openEntry(detail, "withdrawal")}
                    >
                      <ArrowUpRight size={16} /> Registrar retirada
                    </button>
                    <button
                      className="text-button"
                      disabled={!ready}
                      onClick={() => void archive(detail)}
                    >
                      {detail.archived ? (
                        <RotateCcw size={16} />
                      ) : (
                        <Archive size={16} />
                      )}
                      {detail.archived ? "Restaurar" : "Arquivar"}
                    </button>
                    {!data.entries.some(
                      (entry) => entry.goalId === detail.id,
                    ) && (
                      <button
                        className="text-button negative"
                        disabled={!ready}
                        onClick={() =>
                          requestDelete("goal", detail.id, detail.name)
                        }
                      >
                        <Trash2 size={15} /> Excluir vazio
                      </button>
                    )}
                  </div>
                  <div className="savings-history">
                    {data.entries
                      .filter((entry) => entry.goalId === detail.id)
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((entry) => (
                        <div className="savings-history-row" key={entry.id}>
                          <span
                            className={"savings-movement-icon " + entry.kind}
                          >
                            {entry.kind !== "withdrawal" ? (
                              <ArrowDownLeft size={17} />
                            ) : (
                              <ArrowUpRight size={17} />
                            )}
                          </span>
                          <div>
                            <strong>
                              {entry.kind === "initial"
                                ? "Saldo inicial"
                                : entry.kind === "deposit"
                                  ? "Valor guardado"
                                  : "Retirada"}
                            </strong>
                            <small>
                              {dateLabel(entry.date)}
                              {entry.note ? " · " + entry.note : ""}
                            </small>
                          </div>
                          <strong
                            className={
                              entry.kind !== "withdrawal"
                                ? "positive"
                                : "negative"
                            }
                          >
                            {entry.kind !== "withdrawal" ? "+" : "−"}{" "}
                            {money(entry.amount)}
                          </strong>
                          <button
                            className="savings-icon-button"
                            disabled={!ready || detail.archived}
                            aria-label={
                              "Excluir registro de " +
                              money(entry.amount) +
                              " em " +
                              dateLabel(entry.date)
                            }
                            onClick={() =>
                              requestDelete(
                                "entry",
                                entry.id,
                                (entry.kind === "initial"
                                  ? "Saldo inicial"
                                  : entry.kind === "deposit"
                                    ? "Aporte"
                                    : "Retirada") +
                                  " de " +
                                  money(entry.amount),
                              )
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    {!data.entries.some(
                      (entry) => entry.goalId === detail.id,
                    ) && (
                      <p className="form-note">
                        O histórico aparece quando você registrar o primeiro
                        aporte.
                      </p>
                    )}
                  </div>
                </section>
              )}
            </div>
            <aside
              className="savings-schedule"
              aria-labelledby="savings-schedule-heading"
            >
              <span className="eyebrow">UM POUCO DE CADA VEZ</span>
              <h2 id="savings-schedule-heading">Próximos aportes</h2>
              <p>Seu plano para os dias que ainda faltam neste mês.</p>
              <div className="savings-schedule-list">
                {suggestions.map((item) => (
                  <div
                    className="savings-schedule-row"
                    key={item.goal.id + item.date}
                  >
                    <span className="savings-date">
                      <strong>{item.date.slice(8)}</strong>
                      <small>
                        {item.date.slice(5, 7)}/{item.date.slice(0, 4)}
                      </small>
                    </span>
                    <div>
                      <strong>{item.goal.name}</strong>
                      <span>{money(item.amount)}</span>
                    </div>
                    <button
                      className="savings-icon-button"
                      disabled={!ready}
                      title="Registrar valor guardado hoje"
                      aria-label={
                        "Guardar " +
                        money(item.amount) +
                        " em " +
                        item.goal.name
                      }
                      onClick={() =>
                        openEntry(item.goal, "deposit", item.amount)
                      }
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                ))}
                {!suggestions.length && (
                  <div className="savings-schedule-empty">
                    <Check size={26} />
                    <span>
                      {active.length
                        ? "Nenhum aporte futuro neste mês."
                        : "Seus dias de aporte aparecerão aqui."}
                    </span>
                  </div>
                )}
              </div>
              {active.map((goal) => {
                const plan = contributionPlan(goal, data.entries, month, today);
                return plan.missingDate && plan.remaining > 0 ? (
                  <div className="savings-schedule-warning" key={goal.id}>
                    {goal.name}: faltam {money(plan.remaining)}, e não há dia de
                    aporte disponível antes do prazo. Ajuste os dias ou registre
                    um aporte realizado.
                  </div>
                ) : null;
              })}
              <div className="savings-schedule-total">
                <span>Sugerido neste mês</span>
                <strong>
                  {money(
                    suggestions.reduce((sum, item) => sum + item.amount, 0),
                  )}
                </strong>
              </div>
              <p className="savings-schedule-note">
                Sugestões baseadas nas suas metas. Confira se os valores cabem
                no seu orçamento. Guardar dinheiro aqui não adiciona uma despesa
                ao extrato.
              </p>
            </aside>
          </div>
        </>
      )}

      <Dialog
        open={!!form}
        onOpenChange={(open) => {
          if (!open && !busy) setForm(null);
        }}
      >
        <DialogContent
          className="finance-dialog finance-drawer savings-drawer"
          onCloseAutoFocus={restoreFocus}
        >
          <span className="drawer-kicker">DÊ UM LUGAR AO SEU PLANO</span>
          <DialogTitle>
            {form?.goal ? "Editar cofrinho" : "Novo cofrinho"}
          </DialogTitle>
          <DialogDescription>
            {demo
              ? "Teste com valores fictícios. Os exemplos são temporários."
              : "Defina sua meta e organize os aportes nos seus dias de recebimento."}
          </DialogDescription>
          <form className="finance-form savings-form" onSubmit={saveGoal}>
            <label>
              Nome do cofrinho
              <input
                autoFocus
                maxLength={80}
                required
                placeholder="Ex.: viagem, festa, celular novo"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <div className="field-pair">
              <label>
                Quanto quero juntar (R$)
                <input
                  inputMode="decimal"
                  required
                  placeholder="6000,00"
                  value={draft.target}
                  onChange={(e) =>
                    setDraft({ ...draft, target: e.target.value })
                  }
                />
              </label>
              <label>
                Até quando
                <input
                  type="date"
                  required
                  min={today}
                  value={draft.deadline}
                  onChange={(e) =>
                    setDraft({ ...draft, deadline: e.target.value })
                  }
                />
              </label>
            </div>
            {!form?.goal && (
              <label>
                Já tenho guardado (R$)
                <input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={draft.initial}
                  onChange={(e) =>
                    setDraft({ ...draft, initial: e.target.value })
                  }
                />
                <span className="form-note">
                  Opcional. O saldo inicial não conta como aporte deste mês.
                </span>
              </label>
            )}
            <fieldset className="savings-paydays">
              <legend>Em quais dias posso guardar?</legend>
              <p className="form-note">
                Dias do mês em que você recebe ou prefere fazer seus aportes.
              </p>
              <div className="savings-day-chips">
                {draft.paydays.map((day) => (
                  <button
                    type="button"
                    key={day}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        paydays: draft.paydays.filter((value) => value !== day),
                      })
                    }
                    aria-label={"Remover dia " + day}
                  >
                    Dia {day}
                    <X size={13} />
                  </button>
                ))}
              </div>
              <div className="savings-add-day">
                <label>
                  <span className="sr-only">Adicionar dia de aporte</span>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    inputMode="numeric"
                    placeholder="Dia 1 a 31"
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                  />
                </label>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    const value = Number(day);
                    if (
                      Number.isInteger(value) &&
                      value >= 1 &&
                      value <= 31 &&
                      !draft.paydays.includes(value)
                    ) {
                      setDraft({
                        ...draft,
                        paydays: [...draft.paydays, value].sort(
                          (a, b) => a - b,
                        ),
                        weights: { ...draft.weights, [value]: "" },
                      });
                      setDay("");
                    }
                  }}
                >
                  <Plus size={16} /> Adicionar
                </button>
              </div>
              <p className="form-note">
                Em meses mais curtos, o dia 31 vira o último dia do mês.
              </p>
            </fieldset>
            {recommended !== 0 && (
              <label>
                Quanto quero guardar por mês (R$)
                <input
                  inputMode="decimal"
                  placeholder={
                    recommended === null
                      ? "Defina o valor mensal"
                      : currencyInput(recommended)
                  }
                  value={draft.monthly}
                  onChange={(e) =>
                    setDraft({ ...draft, monthly: e.target.value })
                  }
                />
              </label>
            )}
            {recommended !== null && (
              <div className="savings-recommendation">
                <PiggyBank size={20} />
                <div>
                  <strong>
                    {recommended === 0
                      ? "Sua meta já está alcançada."
                      : money(recommended) + " / mês para esse prazo"}
                  </strong>
                  <span>
                    Considera o que você já guardou e os dias que ainda estão
                    disponíveis.
                  </span>
                </div>
                {recommended > 0 && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        monthly: currencyInput(recommended),
                      })
                    }
                  >
                    Usar
                  </button>
                )}
              </div>
            )}
            <fieldset className="savings-distribution">
              <legend>Como dividir entre os dias?</legend>
              <div className="savings-choice">
                <button
                  type="button"
                  className={!draft.weighted ? "active" : ""}
                  onClick={() => setDraft({ ...draft, weighted: false })}
                >
                  Valores iguais
                </button>
                <button
                  type="button"
                  className={draft.weighted ? "active" : ""}
                  onClick={() => setDraft({ ...draft, weighted: true })}
                >
                  Personalizar
                </button>
              </div>
              {draft.weighted && (
                <div className="savings-weight-fields">
                  {draft.paydays.map((day) => (
                    <label key={day}>
                      Dia {day} (%)
                      <input
                        inputMode="numeric"
                        type="number"
                        min="1"
                        max="100"
                        required
                        value={draft.weights[day] || ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            weights: {
                              ...draft.weights,
                              [day]: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
              <p className="form-note">
                O que faltar no mês será dividido entre os próximos dias. O
                progresso só muda com aportes registrados.
              </p>
            </fieldset>
            {draft.monthly.trim() &&
              recommended !== null &&
              parseAmount(draft.monthly) < recommended && (
                <p className="savings-schedule-warning">
                  O valor mensal está abaixo da sugestão para este prazo. Você
                  pode aumentar os aportes ou estender a data.
                </p>
              )}
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="form-buttons">
              <button
                className="secondary-button"
                type="button"
                disabled={busy}
                onClick={() => setForm(null)}
              >
                Cancelar
              </button>
              <button className="primary-button" disabled={busy}>
                {busy
                  ? "Salvando…"
                  : form?.goal
                    ? "Salvar alterações"
                    : "Criar cofrinho"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!entryForm}
        onOpenChange={(open) => {
          if (!open && !busy) setEntryForm(null);
        }}
      >
        <DialogContent
          className="finance-dialog"
          onCloseAutoFocus={restoreFocus}
        >
          <DialogTitle>
            {entryForm?.kind === "deposit"
              ? "Guardar dinheiro"
              : "Registrar retirada"}
          </DialogTitle>
          <DialogDescription>
            {entryForm?.goal.name} ·{" "}
            {money(entryForm ? goalBalance(entryForm.goal, data.entries) : 0)}{" "}
            guardados. Registre um movimento que você já realizou.
          </DialogDescription>
          <form className="finance-form" onSubmit={saveEntry}>
            <label>
              Valor (R$)
              <input
                autoFocus
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Data
              <input
                type="date"
                required
                max={today}
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </label>
            <label>
              Observação (opcional)
              <input
                maxLength={200}
                placeholder="Ex.: parte do salário"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <p className="form-note">
              Este registro acompanha seu cofrinho. Não movimenta sua conta
              bancária nem altera receitas e despesas.
            </p>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="form-buttons">
              <button
                className="secondary-button"
                type="button"
                disabled={busy}
                onClick={() => setEntryForm(null)}
              >
                Cancelar
              </button>
              <button className="primary-button" disabled={busy}>
                {busy ? "Salvando…" : "Confirmar registro"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <DialogContent
          className="finance-dialog"
          onCloseAutoFocus={restoreFocus}
        >
          <DialogTitle>
            Excluir este{" "}
            {deleting?.action === "goal" ? "cofrinho vazio" : "registro"}?
          </DialogTitle>
          <DialogDescription>
            {deleting?.label}.{" "}
            {deleting?.action === "entry"
              ? "O saldo e o progresso serão recalculados."
              : "Nenhum histórico de aporte será removido."}
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
              onClick={() => setDeleting(null)}
            >
              Cancelar
            </button>
            <button
              className="danger-button"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? "Excluindo…" : "Excluir"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
