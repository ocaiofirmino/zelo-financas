import {
  PERSONAL_ACCOUNTS_ENABLED,
  personalAccessUnavailable,
} from "@/lib/app-access";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { database } from "@/db/raw";
import { emptyProfile, validateProfile } from "@/lib/profile";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers });
export async function GET() {
  if (!PERSONAL_ACCOUNTS_ENABLED) return personalAccessUnavailable();
  const user = await getChatGPTUser();
  if (!user) return json({ error: "Entre para acessar seu perfil." }, 401);
  try {
    const row = await database()
      .prepare(
        "SELECT preferredName,fullName,email,phone,occupation,company,monthlySalary,paydays,avatar FROM profiles WHERE userId = ?",
      )
      .bind(user.userId)
      .first();
    return json({
      profile: row
        ? { ...row, paydays: JSON.parse(row.paydays as string) }
        : {
            ...emptyProfile,
            preferredName: user.fullName?.split(" ")[0] || "",
            fullName: user.fullName || "",
            email: user.email,
          },
      accountEmail: user.email,
    });
  } catch (error) {
    console.error("Profile storage unavailable", error);
    return json(
      { error: "Não foi possível carregar seu perfil. Tente novamente." },
      503,
    );
  }
}
export async function PUT(request: Request) {
  if (!PERSONAL_ACCOUNTS_ENABLED) return personalAccessUnavailable();
  const user = await getChatGPTUser();
  if (!user) return json({ error: "Entre para editar seu perfil." }, 401);
  const origin = request.headers.get("origin");
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return json({ error: "Origem inválida." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json"))
    return json({ error: "Formato inválido." }, 400);
  if (Number(request.headers.get("content-length")) > 250000)
    return json({ error: "Escolha uma foto menor." }, 413);
  let profile;
  try {
    const body = await request.text();
    if (body.length > 250000)
      return json({ error: "Escolha uma foto menor." }, 413);
    profile = validateProfile(JSON.parse(body));
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Confira os dados do perfil.",
      },
      400,
    );
  }
  try {
    const p = profile;
    await database()
      .prepare(
        `INSERT INTO profiles (userId,preferredName,fullName,email,phone,occupation,company,monthlySalary,paydays,avatar,updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(userId) DO UPDATE SET preferredName=excluded.preferredName,fullName=excluded.fullName,email=excluded.email,phone=excluded.phone,occupation=excluded.occupation,company=excluded.company,monthlySalary=excluded.monthlySalary,paydays=excluded.paydays,avatar=excluded.avatar,updatedAt=excluded.updatedAt`,
      )
      .bind(
        user.userId,
        p.preferredName,
        p.fullName,
        p.email,
        p.phone,
        p.occupation,
        p.company,
        p.monthlySalary,
        JSON.stringify(p.paydays),
        p.avatar,
        new Date().toISOString(),
      )
      .run();
    return json({ profile: p, accountEmail: user.email });
  } catch (error) {
    console.error("Profile save unavailable", error);
    return json(
      {
        error:
          "Não foi possível salvar seu perfil. Seus campos foram preservados.",
      },
      503,
    );
  }
}
