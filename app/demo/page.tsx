import FinanceApp from "../finance-full";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const initialView =
    view === "transactions" ||
    view === "cards" ||
    view === "statement" ||
    view === "savings" ||
    view === "profile"
      ? view
      : "overview";
  return <FinanceApp previewOnly initialView={initialView} />;
}
