import { getChatGPTUser } from "@/app/chatgpt-auth";
import { database } from "@/db/raw";
import {
  categories,
  makeTransactions,
  validateTransaction,
} from "@/lib/finance";
export const dynamic = "force-dynamic";
function failure(error: unknown) {
  console.error("Finance storage error", error);
  return Response.json(
    {
      error:
        "Não foi possível acessar seus dados. Tente novamente; seu formulário foi preservado.",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
function invalid(error: unknown) {
  return Response.json(
    { error: error instanceof Error ? error.message : "Dados inválidos." },
    { status: 400 },
  );
}
function monthValid(v: unknown): v is string {
  return typeof v === "string" && /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(v);
}
async function payload(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new Error("Formato inválido.");
  const value = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Dados inválidos.");
  return value as Record<string, unknown>;
}
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "Entre para acessar seus dados." },
      { status: 401 },
    );
  try {
    const db = database();
    const [tx, prefs] = await db.batch([
      db
        .prepare(
          "SELECT id,description,amount,date,type,category,payment,status,installment,installments,groupId FROM transactions WHERE userId = ? ORDER BY date DESC,id DESC",
        )
        .bind(user.userId),
      db
        .prepare("SELECT month,goal,budgets FROM preferences WHERE userId = ?")
        .bind(user.userId),
    ]);
    return Response.json(
      {
        transactions: tx.results,
        settings: Object.fromEntries(
          prefs.results.map((value) => {
            const r = value as { month: string; goal: number; budgets: string };
            return [r.month, { goal: r.goal, budgets: JSON.parse(r.budgets) }];
          }),
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "Entre para salvar." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origem inválida." }, { status: 403 });
  let rows;
  try {
    rows = makeTransactions(validateTransaction(await payload(request)));
  } catch (e) {
    return invalid(e);
  }
  try {
    const db = database();
    await db.batch(
      rows.map((r) =>
        db
          .prepare(
            "INSERT INTO transactions (id,userId,description,amount,date,type,category,payment,status,installment,installments,groupId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            r.id,
            user.userId,
            r.description,
            r.amount,
            r.date,
            r.type,
            r.category,
            r.payment,
            r.status,
            r.installment,
            r.installments,
            r.groupId,
          ),
      ),
    );
    return Response.json({ transactions: rows }, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "Entre para salvar." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origem inválida." }, { status: 403 });
  let data: Record<string, unknown>;
  try {
    data = await payload(request);
    if (typeof data.id !== "string") throw new Error("Lançamento inválido.");
    if (data.statusOnly !== undefined && typeof data.statusOnly !== "boolean")
      throw new Error("Alteração de situação inválida.");
    if (data.statusOnly && !["paid", "pending"].includes(String(data.status)))
      throw new Error("Situação inválida.");
    if (!data.statusOnly) validateTransaction({ ...data, installments: 1 });
  } catch (e) {
    return invalid(e);
  }
  try {
    const db = database();
    const old = await db
      .prepare("SELECT * FROM transactions WHERE userId = ? AND id = ?")
      .bind(user.userId, data.id)
      .first();
    if (!old)
      return Response.json(
        { error: "Lançamento não encontrado." },
        { status: 404 },
      );
    if (data.statusOnly) {
      await db
        .prepare(
          "UPDATE transactions SET status = ? WHERE userId = ? AND id = ?",
        )
        .bind(data.status, user.userId, data.id)
        .run();
      return Response.json({ transaction: { ...old, status: data.status } });
    }
    const row = validateTransaction({ ...data, installments: 1 });
    if (
      Number(old.installments) > 1 &&
      (row.type !== "expense" || row.payment !== "card")
    )
      return invalid(
        new Error("Parcelas devem continuar como despesas no cartão."),
      );
    await db
      .prepare(
        "UPDATE transactions SET description = ?, amount = ?, date = ?, type = ?, category = ?, payment = ?, status = ? WHERE userId = ? AND id = ?",
      )
      .bind(
        row.description,
        row.amount,
        row.date,
        row.type,
        row.category,
        row.payment,
        row.status,
        user.userId,
        data.id,
      )
      .run();
    return Response.json({
      transaction: {
        ...old,
        ...row,
        installments: old.installments,
        installment: old.installment,
      },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "Entre para excluir." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origem inválida." }, { status: 403 });
  let data;
  try {
    data = await payload(request);
    if (typeof data.id !== "string") throw new Error("Lançamento inválido.");
  } catch (e) {
    return invalid(e);
  }
  try {
    const result = await database()
      .prepare("DELETE FROM transactions WHERE userId = ? AND id = ?")
      .bind(user.userId, data.id)
      .run();
    if (!result.meta.changes)
      return Response.json(
        { error: "Lançamento não encontrado." },
        { status: 404 },
      );
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "Entre para salvar." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origem inválida." }, { status: 403 });
  let data;
  try {
    data = await payload(request);
    if (
      !monthValid(data.month) ||
      typeof data.goal !== "number" ||
      !Number.isSafeInteger(data.goal) ||
      data.goal < 0 ||
      data.goal > 1000000000 ||
      typeof data.budgets !== "object" ||
      Array.isArray(data.budgets) ||
      !data.budgets
    )
      throw new Error("Confira a meta e os limites.");
    for (const [cat, value] of Object.entries(data.budgets))
      if (
        !categories.includes(cat as (typeof categories)[number]) ||
        !Number.isSafeInteger(value) ||
        Number(value) < 0 ||
        Number(value) > 1000000000
      )
        throw new Error("Confira os limites por categoria.");
  } catch (e) {
    return invalid(e);
  }
  try {
    await database()
      .prepare(
        "INSERT INTO preferences (userId,month,goal,budgets) VALUES (?,?,?,?) ON CONFLICT (userId,month) DO UPDATE SET goal = excluded.goal,budgets = excluded.budgets",
      )
      .bind(user.userId, data.month, data.goal, JSON.stringify(data.budgets))
      .run();
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
