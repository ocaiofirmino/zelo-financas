import {
  PERSONAL_ACCOUNTS_ENABLED,
  personalAccessUnavailable,
} from "@/lib/app-access";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { database } from "@/db/raw";
import { validateCard } from "@/lib/cards";

export const dynamic = "force-dynamic";
const columns = "id,name,creditLimit,closingDay,dueDay,archived";
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

export async function GET() {
  if (!PERSONAL_ACCOUNTS_ENABLED) return personalAccessUnavailable();
  const user = await getChatGPTUser();
  if (!user) return json({ error: "Entre para acessar seus cartões." }, 401);
  try {
    const cards = await database()
      .prepare(
        `SELECT ${columns} FROM credit_cards WHERE userId = ? ORDER BY name,id`,
      )
      .bind(user.userId)
      .all();
    return json({ cards: cards.results.map((card) => ({ ...card, archived: Boolean(card.archived) })) });
  } catch (error) {
    console.error("Cards storage error", error);
    return json({ error: "Não foi possível carregar seus cartões." }, 503);
  }
}

async function mutate(request: Request, method: "POST" | "PATCH" | "DELETE") {
  if (!PERSONAL_ACCOUNTS_ENABLED) return personalAccessUnavailable();
  const user = await getChatGPTUser();
  if (!user) return json({ error: "Entre para alterar seus cartões." }, 401);
  const origin = request.headers.get("origin");
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return json({ error: "Origem inválida." }, 403);
  let data: Record<string, unknown>;
  let card;
  let archiveOnly = false;
  try {
    if (!request.headers.get("content-type")?.includes("application/json"))
      throw new Error("Formato inválido.");
    const body = await request.text();
    if (body.length > 4096) return json({ error: "Dados muito grandes." }, 413);
    data = JSON.parse(body);
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error("Dados inválidos.");
    if (
      method !== "POST" &&
      (typeof data.id !== "string" || !data.id || data.id.length > 100)
    )
      throw new Error("Cartão inválido.");
    if (data.archived !== undefined) {
      if (method !== "PATCH" || typeof data.archived !== "boolean" || ["name", "creditLimit", "closingDay", "dueDay"].some((key) => data[key] !== undefined)) throw new Error("Confira a operação de arquivamento do cartão.");
      archiveOnly = true;
    }
    if (method !== "DELETE" && !archiveOnly) card = validateCard(data);
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Confira os dados do cartão.",
      },
      400,
    );
  }
  try {
    const db = database();
    if (method === "POST") {
      const created = { ...card!, id: crypto.randomUUID(), archived: false };
      await db
        .prepare(
          "INSERT INTO credit_cards (id,userId,name,creditLimit,closingDay,dueDay) VALUES (?,?,?,?,?,?)",
        )
        .bind(
          created.id,
          user.userId,
          created.name,
          created.creditLimit,
          created.closingDay,
          created.dueDay,
        )
        .run();
      return json({ card: created }, 201);
    }
    const old = await db
      .prepare(
        `SELECT ${columns} FROM credit_cards WHERE id = ? AND userId = ?`,
      )
      .bind(data.id, user.userId)
      .first();
    if (!old) return json({ error: "Cartão não encontrado." }, 404);
    if (archiveOnly) {
      const result = await db.prepare("UPDATE credit_cards SET archived = ? WHERE id = ? AND userId = ?").bind(data.archived ? 1 : 0, data.id, user.userId).run();
      if (!result.meta.changes) return json({ error: "Cartão não encontrado." }, 404);
      return json({ card: { ...old, archived: data.archived } });
    }
    if (method === "PATCH") {
      const result = await db
        .prepare(
          "UPDATE credit_cards SET name = ?, creditLimit = ?, closingDay = ?, dueDay = ? WHERE id = ? AND userId = ?",
        )
        .bind(
          card!.name,
          card!.creditLimit,
          card!.closingDay,
          card!.dueDay,
          data.id,
          user.userId,
        )
        .run();
      if (!result.meta.changes)
        return json({ error: "Cartão não encontrado." }, 404);
      return json({ card: { ...card!, id: data.id, archived: Boolean(old.archived) } });
    }
    const result = await db
      .prepare(
        "DELETE FROM credit_cards WHERE id = ? AND userId = ? AND NOT EXISTS (SELECT 1 FROM transactions WHERE cardId = ? AND userId = ?)",
      )
      .bind(data.id, user.userId, data.id, user.userId)
      .run();
    if (!result.meta.changes)
      return json(
        {
          error:
            "Este cartão possui compras. Preserve o histórico ou desvincule os lançamentos antes de excluir.",
        },
        409,
      );
    return json({ ok: true });
  } catch (error) {
    console.error("Cards storage error", error);
    return json(
      { error: "Não foi possível salvar seu cartão. Tente novamente." },
      503,
    );
  }
}
export async function POST(request: Request) {
  return mutate(request, "POST");
}
export async function PATCH(request: Request) {
  return mutate(request, "PATCH");
}
export async function DELETE(request: Request) {
  return mutate(request, "DELETE");
}
