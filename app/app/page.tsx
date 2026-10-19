import { PERSONAL_ACCOUNTS_ENABLED } from "@/lib/app-access";
import FinanceApp from "../finance-full";
import { requireChatGPTUser } from "../chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  if (PERSONAL_ACCOUNTS_ENABLED) await requireChatGPTUser("/app");
  const { view } = await searchParams;
  const initialView =
    view === "transactions" ||
    view === "cards" ||
    view === "statement" ||
    view === "savings"
      ? view
      : "overview";
  return (
    <FinanceApp
      previewOnly={!PERSONAL_ACCOUNTS_ENABLED}
      initialView={initialView}
    />
  );
}
