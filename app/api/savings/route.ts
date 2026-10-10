import { getChatGPTUser } from "@/app/chatgpt-auth";
import { database } from "@/db/raw";
import { localDate } from "@/lib/finance";
import { validateEntry, validateGoal, type SavingsGoal } from "@/lib/savings";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const goalColumns =
  "id,name,target,deadline,monthly,paydays,weights,createdAt,archived";
const entryColumns = "id,goalId,amount,date,kind,note";
type GoalRecord = Omit<SavingsGoal, "paydays" | "weights" | "archived"> & {
  paydays: string;
  weights: string;
  archived: number;
};

function goalFromRecord(row: GoalRecord): SavingsGoal {
  return {
    ...row,
    paydays: JSON.parse(row.paydays),
    weights: JSON.parse(row.weights),
    archived: Boolean(row.archived),
  };
}

function responseError(error: string, status: number) {
  return Response.json({ error }, { status, headers: noStore });
}

function invalid(error: unknown) {
  return responseError(
    error instanceof Error ? error.message : "Dados inválidos.",
    400,
  );
}

function failure(error: unknown) {
  console.error("Savings storage error", error);
  return responseError(
    "Não foi possível acessar seus cofrinhos. Tente novamente; seu formulário foi preservado.",
    503,
  );
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function payload(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new Error("Formato inválido.");
  const value = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Dados inválidos.");
  return value as Record<string, unknown>;
}

function validateId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 128)
    throw new Error("Identificador inválido.");
}

async function findGoal(userId: string, id: string) {
  return database()
    .prepare(
      `SELECT ${goalColumns} FROM savings_goals WHERE userId = ? AND id = ?`,
    )
    .bind(userId, id)
    .first<GoalRecord>();
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return responseError("Entre para acessar seus cofrinhos.", 401);
  try {
    const db = database();
    const [goals, entries] = await db.batch([
      db
        .prepare(
          `SELECT ${goalColumns} FROM savings_goals WHERE userId = ? ORDER BY createdAt,id`,
        )
        .bind(user.userId),
      db
        .prepare(
          `SELECT ${entryColumns} FROM savings_entries WHERE userId = ? ORDER BY date DESC,id DESC`,
        )
        .bind(user.userId),
    ]);
    return Response.json(
      {
        goals: goals.results.map((row) => goalFromRecord(row as GoalRecord)),
        entries: entries.results,
      },
      { headers: noStore },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return responseError("Entre para salvar seus cofrinhos.", 401);
  if (!sameOrigin(request)) return responseError("Origem inválida.", 403);
  let data: Record<string, unknown>;
  let goalDraft: ReturnType<typeof validateGoal> | undefined;
  let entryDraft: ReturnType<typeof validateEntry> | undefined;
  let initialAmount = 0;
  const today = localDate();
  try {
    data = await payload(request);
    if (data.action === "goal") {
      goalDraft = validateGoal(data, today);
      if (data.initialAmount !== undefined) {
        if (
          typeof data.initialAmount !== "number" ||
          !Number.isSafeInteger(data.initialAmount) ||
          data.initialAmount < 0 ||
          data.initialAmount > 1000000000
        )
          throw new Error("Confira o valor já guardado.");
        initialAmount = data.initialAmount;
      }
    } else if (data.action === "entry") {
      entryDraft = validateEntry(data, today);
      validateId(entryDraft.goalId);
    } else {
      throw new Error("Operação inválida.");
    }
  } catch (error) {
    return invalid(error);
  }
  try {
    const db = database();
    if (goalDraft) {
      const goal: SavingsGoal = {
        ...goalDraft,
        id: crypto.randomUUID(),
        createdAt: today,
        archived: false,
      };
      const initialEntry =
        initialAmount > 0
          ? {
              id: crypto.randomUUID(),
              goalId: goal.id,
              amount: initialAmount,
              date: today,
              kind: "initial" as const,
              note: "Valor já guardado ao criar o cofrinho",
            }
          : null;
      const statements = [
        db
          .prepare(
            "INSERT INTO savings_goals (id,userId,name,target,deadline,monthly,paydays,weights,createdAt,archived) VALUES (?,?,?,?,?,?,?,?,?,0)",
          )
          .bind(
            goal.id,
            user.userId,
            goal.name,
            goal.target,
            goal.deadline,
            goal.monthly,
            JSON.stringify(goal.paydays),
            JSON.stringify(goal.weights),
            goal.createdAt,
          ),
      ];
      if (initialEntry)
        statements.push(
          db
            .prepare(
              "INSERT INTO savings_entries (id,goalId,userId,amount,date,kind,note) VALUES (?,?,?,?,?,?,?)",
            )
            .bind(
              initialEntry.id,
              initialEntry.goalId,
              user.userId,
              initialEntry.amount,
              initialEntry.date,
              initialEntry.kind,
              initialEntry.note,
            ),
        );
      // D1 batch é transacional: o saldo inicial acompanha a criação da meta.
      await db.batch(statements);
      return Response.json(
        { goal, entries: initialEntry ? [initialEntry] : [] },
        { status: 201, headers: noStore },
      );
    }
    if (!entryDraft) return responseError("Operação inválida.", 400);
    const goal = await findGoal(user.userId, entryDraft.goalId);
    if (!goal) return responseError("Cofrinho não encontrado.", 404);
    if (goal.archived)
      return responseError("Reative este cofrinho antes de movimentá-lo.", 409);
    const entry = { ...entryDraft, id: crypto.randomUUID() };
    // A verificação fica no INSERT para duas retiradas concorrentes não gastarem o mesmo saldo.
    const result = await db
      .prepare(
        `INSERT INTO savings_entries (id,goalId,userId,amount,date,kind,note)
       SELECT ?,g.id,g.userId,?,?,?,? FROM savings_goals g
       WHERE g.id = ? AND g.userId = ? AND g.archived = 0
       AND (? = 'deposit' OR (SELECT COALESCE(SUM(CASE WHEN kind = 'withdrawal' THEN -amount ELSE amount END),0)
         FROM savings_entries WHERE goalId = g.id AND userId = g.userId) >= ?)`,
      )
      .bind(
        entry.id,
        entry.amount,
        entry.date,
        entry.kind,
        entry.note,
        entry.goalId,
        user.userId,
        entry.kind,
        entry.amount,
      )
      .run();
    if (!result.meta.changes)
      return responseError(
        "O saldo disponível mudou ou o cofrinho foi arquivado. Atualize e confira o valor da retirada.",
        409,
      );
    return Response.json({ entry }, { status: 201, headers: noStore });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return responseError("Entre para editar seus cofrinhos.", 401);
  if (!sameOrigin(request)) return responseError("Origem inválida.", 403);
  let data: Record<string, unknown>;
  let draft: ReturnType<typeof validateGoal> | undefined;
  try {
    data = await payload(request);
    validateId(data.id);
    if (data.archived !== undefined) {
      if (
        typeof data.archived !== "boolean" ||
        Object.keys(data).some((key) => !["id", "archived"].includes(key))
      )
        throw new Error("Alteração de arquivamento inválida.");
    } else {
      draft = validateGoal(data, localDate());
    }
  } catch (error) {
    return invalid(error);
  }
  try {
    const db = database();
    const result = draft
      ? await db
          .prepare(
            "UPDATE savings_goals SET name = ?, target = ?, deadline = ?, monthly = ?, paydays = ?, weights = ? WHERE userId = ? AND id = ?",
          )
          .bind(
            draft.name,
            draft.target,
            draft.deadline,
            draft.monthly,
            JSON.stringify(draft.paydays),
            JSON.stringify(draft.weights),
            user.userId,
            data.id,
          )
          .run()
      : await db
          .prepare(
            "UPDATE savings_goals SET archived = ? WHERE userId = ? AND id = ?",
          )
          .bind(data.archived ? 1 : 0, user.userId, data.id)
          .run();
    if (!result.meta.changes)
      return responseError("Cofrinho não encontrado.", 404);
    const updated = await findGoal(user.userId, data.id as string);
    if (!updated) return responseError("Cofrinho não encontrado.", 404);
    return Response.json(
      { goal: goalFromRecord(updated) },
      { headers: noStore },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return responseError("Entre para excluir.", 401);
  if (!sameOrigin(request)) return responseError("Origem inválida.", 403);
  let data: Record<string, unknown>;
  try {
    data = await payload(request);
    validateId(data.id);
    if (data.action !== "goal" && data.action !== "entry")
      throw new Error("Operação inválida.");
  } catch (error) {
    return invalid(error);
  }
  try {
    const db = database();
    if (data.action === "goal") {
      const result = await db
        .prepare(
          `DELETE FROM savings_goals WHERE userId = ? AND id = ? AND NOT EXISTS
         (SELECT 1 FROM savings_entries WHERE userId = savings_goals.userId AND goalId = savings_goals.id)`,
        )
        .bind(user.userId, data.id)
        .run();
      if (!result.meta.changes) {
        const goal = await findGoal(user.userId, data.id as string);
        return goal
          ? responseError(
              "Este cofrinho tem histórico. Arquive-o para preservar os registros.",
              409,
            )
          : responseError("Cofrinho não encontrado.", 404);
      }
      return Response.json({ ok: true }, { headers: noStore });
    }
    // Desfazer um aporte também exige saldo suficiente; o histórico fica coerente.
    const result = await db
      .prepare(
        `DELETE FROM savings_entries WHERE userId = ? AND id = ? AND
       (kind = 'withdrawal' OR (SELECT COALESCE(SUM(CASE WHEN e.kind = 'withdrawal' THEN -e.amount ELSE e.amount END),0)
         FROM savings_entries e WHERE e.userId = savings_entries.userId AND e.goalId = savings_entries.goalId) >= amount)`,
      )
      .bind(user.userId, data.id)
      .run();
    if (!result.meta.changes) {
      const entry = await db
        .prepare("SELECT id FROM savings_entries WHERE userId = ? AND id = ?")
        .bind(user.userId, data.id)
        .first();
      return entry
        ? responseError(
            "Este aporte já foi usado em uma retirada. Desfaça a retirada antes de excluir o aporte.",
            409,
          )
        : responseError("Movimento não encontrado.", 404);
    }
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}
