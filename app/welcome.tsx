"use client";

import Landing from "./landing";

// Endereços antigos usam a página inicial com o novo painel de acesso.
export default function Welcome({ initialScreen = "home" }: { initialScreen?: "home" | "login" | "signup" }) {
  return <Landing initialAuth={initialScreen === "home" ? undefined : initialScreen} />;
}
