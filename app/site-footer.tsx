"use client";

import { ArrowUp, ArrowUpRight, CodeXml } from "lucide-react";

type SiteFooterProps = {
  demo: boolean;
  monthLabel: string;
};

export default function SiteFooter({ demo, monthLabel }: SiteFooterProps) {
  function returnToTop() {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    window.scrollTo({
      top: 0,
      behavior: reducedMotion ? "instant" : "smooth",
    });

    document
      .querySelector<HTMLAnchorElement>(".app-header .brand")
      ?.focus({ preventScroll: true });
  }

  return (
    <footer className="site-footer">
      <div className="site-footer-main">
        <div className="site-footer-message">
          <span className="site-footer-brand">
            Zelo<span>.</span>
          </span>
          <h2>
            Seu dinheiro,
            <br />
            <span>com mais clareza.</span>
          </h2>
        </div>

        <div className="site-footer-author">
          <p>Criado por</p>
          <strong>Caio Firmino</strong>
          <div className="site-footer-actions">
            <a
              className="site-footer-project"
              href="https://github.com/ocaiofirmino/zelo-financas"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Conheça o projeto Zelo no GitHub (abre em nova aba)"
            >
              <CodeXml size={18} aria-hidden="true" />
              Conheça o projeto
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <button
              className="site-footer-top"
              type="button"
              onClick={returnToTop}
            >
              Voltar ao topo
              <ArrowUp size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="site-footer-bottom">
        <span>© {new Date().getFullYear()} Zelo</span>
        <span>
          {demo
            ? "Demonstração com valores fictícios"
            : "Seus dados são pessoais"}{" "}
          · {monthLabel}
        </span>
        <span>Organize. Poupe. Respire.</span>
      </div>
    </footer>
  );
}
