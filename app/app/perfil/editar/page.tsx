import { PERSONAL_ACCOUNTS_ENABLED } from "@/lib/app-access";
import FinanceApp from "../../../finance-full";
import { requireChatGPTUser } from "../../../chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function Page() { if (PERSONAL_ACCOUNTS_ENABLED) await requireChatGPTUser("/app/perfil/editar"); return <FinanceApp previewOnly={!PERSONAL_ACCOUNTS_ENABLED} initialView="profile" initialProfileEditing={true} />; }
