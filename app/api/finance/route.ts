import {
  PERSONAL_ACCOUNTS_ENABLED,
  personalAccessUnavailable,
} from "@/lib/app-access";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { database } from "@/db/raw";
import type { CreditCard } from "@/lib/cards";
import {
  editableTransactionFields,
  planLegacyLink,
  planTransactionEdit,
  transactionTargets,
  validateBulkLinkIds,
  validateEditFields,
  validateScope,
} from "@/lib/transaction-batch";
import type { Transaction } from "@/lib/finance";
import {
  categories,
  makeTransactions,
  validateTransaction,
} from "@/lib/finance";
export const dynamic = "force-dynamic";
const transactionColumns =
  "id,description,amount,date,type,category,payment,status,installment,installments,groupId,cardId,purchaseDate";
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
  if (!PERSONAL_ACCOUNTS_ENABLED) return personalAccessUnavailable();
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "Entre para acessar seus dados." },
      { status: 401 },
    );
  try {
    const db = database();
    const [tx, cards, prefs] = await db.batch([
      db
        .prepare(
          "SELECT id,description,amount,date,type,category,payment,status,installment,installments,groupId,cardId,purchaseDate FROM transactions WHERE userId = ? ORDER BY date DESC,id DESC",
        )
        .bind(user.userId),
      db
        .prepare(
          "SELECT id,name,creditLimit,closingDay,dueDay,archived FROM credit_cards WHERE userId = ? ORDER BY name,id",
        )
        .bind(user.userId),
      db
        .prepare("SELECT month,goal,budgets FROM preferences WHERE userId = ?")
        .bind(user.userId),
    ]);
    return Response.json(
      {
        transactions: tx.results,
        cards: (cards.results as CreditCard[]).map((card) => ({
          ...card,
          archived: Boolean(card.archived),
        })),
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
  if (!PERSONAL_ACCOUNTS_ENABLED) return personalAccessUnavailable();
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "Entre para salvar." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origem inválida." }, { status: 403 });
  let value;
  try {
    value = validateTransaction(await payload(request));
  } catch (e) {
    return invalid(e);
  }
  try {
    const db = database();
    let card: CreditCard | undefined;
    if (value.payment === "card") {
      if (!value.cardId)
        return invalid(new Error("Escolha um cartão para esta compra."));
      const found = await db
        .prepare(
          "SELECT id,name,creditLimit,closingDay,dueDay,archived FROM credit_cards WHERE id = ? AND userId = ?",
        )
        .bind(value.cardId, user.userId)
        .first<CreditCard>();
      if (!found)
        return Response.json(
          { error: "Cartão não encontrado." },
          { status: 404 },
        );
      card = found;
      if (card.archived)
        return Response.json(
          { error: "Restaure o cartão antes de registrar novas compras." },
          { status: 409 },
        );
    }
    let rows;
    try {
      rows = makeTransactions(value, card);
    } catch (error) {
      return invalid(error);
    }
    await db.batch(
      rows.map((r) =>
        db
          .prepare(
            "INSERT INTO transactions (id,userId,description,amount,date,type,category,payment,status,installment,installments,groupId,cardId,purchaseDate) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
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
            r.cardId ?? null,
            r.purchaseDate ?? null,
          ),
      ),
    );
    return Response.json({ transactions: rows }, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
async function linkLegacy(data: Record<string, unknown>, userId: string) {
  let ids: string[];
  try {
    ids = validateBulkLinkIds(data.ids);
    if (
      typeof data.cardId !== "string" ||
      !data.cardId ||
      data.cardId.length > 100
    )
      throw new Error("Escolha um cartão válido.");
  } catch (error) {
    return invalid(error);
  }
  const db = database();
  const card = await db
    .prepare(
      "SELECT id,name,creditLimit,closingDay,dueDay,archived FROM credit_cards WHERE id = ? AND userId = ?",
    )
    .bind(data.cardId, userId)
    .first<CreditCard>();
  if (!card)
    return Response.json({ error: "Cartão não encontrado." }, { status: 404 });
  if (card.archived)
    return Response.json(
      { error: "Restaure o cartão antes de vincular compras." },
      { status: 409 },
    );
  const marks = ids.map(() => "?").join(",");
  const selected = await db
    .prepare(
      `SELECT ${transactionColumns} FROM transactions WHERE userId = ? AND id IN (${marks})`,
    )
    .bind(userId, ...ids)
    .all<Transaction>();
  if (selected.results.length !== ids.length)
    return Response.json(
      { error: "Um dos lançamentos não foi encontrado." },
      { status: 404 },
    );
  try {
    planLegacyLink(selected.results, ids, card);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Confira os lançamentos selecionados.",
      },
      { status: 409 },
    );
  }
  const result = await db
    .prepare(
      `UPDATE transactions SET cardId = ? WHERE userId = ? AND id IN (${marks}) AND EXISTS (SELECT 1 FROM credit_cards WHERE id = ? AND userId = ? AND archived = 0) AND (SELECT COUNT(*) FROM transactions WHERE userId = ? AND id IN (${marks}) AND cardId IS NULL AND payment = 'card' AND type = 'expense') = ?`,
    )
    .bind(card.id, userId, ...ids, card.id, userId, userId, ...ids, ids.length)
    .run();
  if (result.meta.changes !== ids.length)
    return Response.json(
      {
        error: "Os dados mudaram. Recarregue os lançamentos e tente novamente.",
      },
      { status: 409 },
    );
  const updated = await db
    .prepare(
      `SELECT ${transactionColumns} FROM transactions WHERE userId = ? AND id IN (${marks})`,
    )
    .bind(userId, ...ids)
    .all<Transaction>();
  return Response.json({
    transactions: updated.results,
    count: updated.results.length,
  });
}

export async function PATCH(request: Request) {
  if (!PERSONAL_ACCOUNTS_ENABLED) return personalAccessUnavailable();
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "Entre para salvar." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origem inválida." }, { status: 403 });
  let data: Record<string, unknown>;
  let scope;
  let value;
  let fields;
  try {
    data = await payload(request);
    if (data.action !== undefined && data.action !== "link-card")
      throw new Error("Operação inválida.");
    if (data.action !== "link-card") {
      if (typeof data.id !== "string" || !data.id || data.id.length > 100)
        throw new Error("Lançamento inválido.");
      scope = validateScope(data.scope);
      if (data.statusOnly !== undefined && typeof data.statusOnly !== "boolean")
        throw new Error("Alteração de situação inválida.");
      if (
        data.statusOnly &&
        (scope !== "single" ||
          !["paid", "pending"].includes(String(data.status)))
      )
        throw new Error("Situação inválida.");
      if (!data.statusOnly) {
        value = validateTransaction({ ...data, installments: 1 });
        fields =
          scope === "single"
            ? [...editableTransactionFields]
            : validateEditFields(data.fields);
      }
    }
  } catch (error) {
    return invalid(error);
  }
  try {
    if (data.action === "link-card") return await linkLegacy(data, user.userId);
    const db = database();
    const old = await db
      .prepare(
        `SELECT ${transactionColumns} FROM transactions WHERE userId = ? AND id = ?`,
      )
      .bind(user.userId, data.id)
      .first<Transaction>();
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
    let rows = [old];
    if (scope !== "single") {
      if (!old.groupId || old.installments <= 1)
        return invalid(
          new Error("Este lançamento não possui um grupo de parcelas."),
        );
      rows = (
        await db
          .prepare(
            `SELECT ${transactionColumns} FROM transactions WHERE userId = ? AND groupId = ? ORDER BY installment,id`,
          )
          .bind(user.userId, old.groupId)
          .all<Transaction>()
      ).results;
    }
    const cards = (
      await db
        .prepare(
          "SELECT id,name,creditLimit,closingDay,dueDay,archived FROM credit_cards WHERE userId = ?",
        )
        .bind(user.userId)
        .all<CreditCard>()
    ).results;
    if (value!.cardId && !cards.some((card) => card.id === value!.cardId))
      return Response.json(
        { error: "Cartão não encontrado." },
        { status: 404 },
      );
    let updated;
    try {
      updated = planTransactionEdit(
        rows,
        old.id,
        value!,
        scope!,
        fields!,
        cards,
      );
    } catch (error) {
      return invalid(error);
    }
    await db.batch(
      updated.map((row) =>
        db
          .prepare(
            "UPDATE transactions SET description = ?, amount = ?, date = ?, type = ?, category = ?, payment = ?, status = ?, cardId = ?, purchaseDate = ? WHERE userId = ? AND id = ?",
          )
          .bind(
            row.description,
            row.amount,
            row.date,
            row.type,
            row.category,
            row.payment,
            row.status,
            row.cardId ?? null,
            row.purchaseDate ?? null,
            user.userId,
            row.id,
          ),
      ),
    );
    return Response.json({
      transaction: updated.find((row) => row.id === old.id),
      transactions: updated,
      count: updated.length,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  if (!PERSONAL_ACCOUNTS_ENABLED) return personalAccessUnavailable();
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "Entre para excluir." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origem inválida." }, { status: 403 });
  let data;
  let scope;
  try {
    data = await payload(request);
    if (typeof data.id !== "string" || !data.id || data.id.length > 100)
      throw new Error("Lançamento inválido.");
    scope = validateScope(data.scope);
  } catch (error) {
    return invalid(error);
  }
  try {
    const db = database();
    const old = await db
      .prepare(
        `SELECT ${transactionColumns} FROM transactions WHERE userId = ? AND id = ?`,
      )
      .bind(user.userId, data.id)
      .first<Transaction>();
    if (!old)
      return Response.json(
        { error: "Lançamento não encontrado." },
        { status: 404 },
      );
    let rows = [old];
    if (scope !== "single") {
      if (!old.groupId || old.installments <= 1)
        return invalid(
          new Error("Este lançamento não possui um grupo de parcelas."),
        );
      rows = (
        await db
          .prepare(
            `SELECT ${transactionColumns} FROM transactions WHERE userId = ? AND groupId = ?`,
          )
          .bind(user.userId, old.groupId)
          .all<Transaction>()
      ).results;
    }
    const targets = transactionTargets(rows, old.id, scope);
    const query =
      scope === "single"
        ? db
            .prepare("DELETE FROM transactions WHERE userId = ? AND id = ?")
            .bind(user.userId, old.id)
        : scope === "all"
          ? db
              .prepare(
                "DELETE FROM transactions WHERE userId = ? AND groupId = ?",
              )
              .bind(user.userId, old.groupId)
          : db
              .prepare(
                "DELETE FROM transactions WHERE userId = ? AND groupId = ? AND installment >= ?",
              )
              .bind(user.userId, old.groupId, old.installment);
    const result = await query.run();
    if (!result.meta.changes)
      return Response.json(
        { error: "Lançamento não encontrado." },
        { status: 404 },
      );
    return Response.json({
      ok: true,
      deletedIds: targets.map((row) => row.id),
      count: result.meta.changes,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  if (!PERSONAL_ACCOUNTS_ENABLED) return personalAccessUnavailable();
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
