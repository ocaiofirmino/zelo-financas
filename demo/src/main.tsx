import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import FinanceApp from "../../app/finance-full";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("O elemento inicial do Zelo não foi encontrado.");

createRoot(root).render(
  <StrictMode>
    <FinanceApp demoOnly />
  </StrictMode>,
);
