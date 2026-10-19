import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import FinanceApp from "../../app/finance-full";
import Welcome from "../../app/welcome";
import "./styles.css";
const root = document.getElementById("root");
if (!root) throw new Error("O elemento inicial do Zelo não foi encontrado.");
const path = window.location.pathname;
const view = new URLSearchParams(window.location.search).get("view");
const views = [
  "overview",
  "transactions",
  "cards",
  "statement",
  "savings",
  "profile",
] as const;
const initialView = path.includes("/perfil")
  ? "profile"
  : (views.find((item) => item === view) ?? "overview");
createRoot(root).render(
  <StrictMode>
    {path.startsWith("/app") || path === "/demo" ? (
      <FinanceApp
        previewOnly
        initialView={initialView}
        initialProfileEditing={path.endsWith("/editar")}
      />
    ) : (
      <Welcome
        initialScreen={
          path === "/cadastro" ? "signup" : path === "/login" ? "login" : "home"
        }
      />
    )}
  </StrictMode>,
);
