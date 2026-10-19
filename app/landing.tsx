"use client";

/* eslint-disable @next/next/no-img-element -- Capturas locais compartilhadas com a demo Vite. */
import Link from "next/link";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Menu,
  X,
  Plus,
  Minus,
} from "lucide-react";
import "./landing.css";
import LoginDrawer from "./login-drawer";

const resources = [
  {
    name: "Meu mês",
    file: "mes",
    title: "Seu mês, por inteiro.",
    copy: "Receitas, despesas e o que está previsto sobrar. Uma visão clara para decidir o próximo passo.",
    view: "overview",
  },
  {
    name: "Cofrinhos",
    file: "cofrinhos",
    title: "Planos com um lugar.",
    copy: "Dê um nome ao que você quer conquistar. Guarde aos poucos e acompanhe o caminho até a sua meta.",
    view: "savings",
  },
  {
    name: "Cartões",
    file: "cartao",
    title: "Sem sustos na fatura.",
    copy: "Acompanhe suas compras e parcelas. Saiba o que já está comprometido nos próximos meses.",
    view: "cards",
  },
  {
    name: "Extrato",
    file: "extrato",
    title: "Cada detalhe conta.",
    copy: "Veja para onde o dinheiro foi, filtre seus lançamentos e exporte o extrato em Excel ou CSV.",
    view: "statement",
  },
];
const questions = [
  [
    "O que é o Zelo?",
    "É um organizador de finanças pessoais para acompanhar receitas, despesas, cartões e metas de economia em um só lugar. No momento, você pode explorar a versão demonstrativa, somente leitura.",
  ],
  [
    "Posso experimentar antes de criar uma conta?",
    "Sim. A demonstração permite explorar o painel com dados fictícios, sem cadastro. Você pode conhecer os lançamentos, os cartões e os cofrinhos.",
  ],
  [
    "O Zelo movimenta meu dinheiro?",
    "Não. O Zelo é uma ferramenta de organização. Os registros e cofrinhos ajudam a acompanhar seu dinheiro; não são contas bancárias ou investimentos.",
  ],
  [
    "Consigo acompanhar compras parceladas?",
    "Sim. A área de cartões mostra as parcelas e os compromissos dos próximos meses para ajudar no planejamento.",
  ],
  [
    "Posso baixar meus lançamentos?",
    "Sim. Na demonstração, você pode exportar os exemplos fictícios em Excel ou CSV. Seus próprios registros serão liberados após a integração do acesso pessoal.",
  ],
  [
    "O cadastro já está disponível?",
    "Login e cadastro estão em manutenção e ainda não estão disponíveis. A demonstração é somente leitura, com dados fictícios. Criar e alterar registros será exclusivo de contas autenticadas.",
  ],
];
const money = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

export default function Landing({
  initialAuth,
}: {
  initialAuth?: "login" | "signup";
}) {
  const [tab, setTab] = useState(0);
  const [monthly, setMonthly] = useState(300);
  const [plan, setPlan] = useState("Minha próxima viagem");
  const [menu, setMenu] = useState(false);
  const [loginOpen, setLoginOpen] = useState(Boolean(initialAuth));
  const [authMode, setAuthMode] = useState<"login" | "signup">(
    initialAuth ?? "login",
  );
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const items = root.current?.querySelectorAll("[data-reveal]");
    if (!items || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    items.forEach((item) => {
      item.classList.add("will-reveal");
      observer.observe(item);
    });
    return () => observer.disconnect();
  }, []);
  const resource = resources[tab];
  return (
    <main className="z-landing" ref={root} id="inicio">
      <header className="z-nav">
        <Link className="z-brand" href="/" aria-label="Zelo, início">
          <img src="/zelo-logo.png" width="40" height="40" alt="" />
          <span>Zelo.</span>
        </Link>
        <nav aria-label="Navegação principal" className={menu ? "is-open" : ""}>
          <a href="#conheca" onClick={() => setMenu(false)}>
            Conheça o Zelo
          </a>
          <a href="#planos" onClick={() => setMenu(false)}>
            Seus planos
          </a>
          <a href="#duvidas" onClick={() => setMenu(false)}>
            Dúvidas
          </a>
          <button
            className="z-mobile-login"
            aria-haspopup="dialog"
            onClick={() => {
              setMenu(false);
              setAuthMode("login");
              setLoginOpen(true);
            }}
          >
            Entrar na minha conta <ArrowUpRight size={16} />
          </button>
        </nav>
        <div className="z-nav-actions">
          <a
            href="/login"
            aria-haspopup="dialog"
            onClick={(event) => {
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              event.preventDefault();
              setMenu(false);
              setAuthMode("login");
              setLoginOpen(true);
            }}
          >
            Entrar <ArrowUpRight size={16} />
          </a>
          <a className="z-button" href="/demo">
            Ver demonstração <ArrowUpRight size={17} />
          </a>
        </div>
        <button
          className="z-menu"
          onClick={() => setMenu(!menu)}
          aria-label={menu ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menu}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>

      <section className="z-hero">
        <div className="z-hero-copy">
          <h1>
            <span className="z-mask">
              <span>Cuide do mês.</span>
            </span>
            <span className="z-mask">
              <span>Viva seus planos.</span>
            </span>
          </h1>
          <div className="z-hero-bottom">
            <p>
              Organize suas finanças, acompanhe o que sobra e dê espaço para os
              seus planos. Tudo em um só lugar.
            </p>
            <div>
              <a className="z-button" href="/demo">
                Explorar o Zelo <ArrowUpRight size={20} />
              </a>
              <span>Uma demonstração. Sem cadastro.</span>
            </div>
            <a className="z-scroll" href="#conheca" aria-label="Conheça o Zelo">
              <span>Conheça por dentro</span>
              <ChevronDown size={22} />
            </a>
          </div>
        </div>
        <div className="z-hero-product" data-reveal data-ui>
          <div className="z-product-bar">
            <span className="z-product-dot" />{" "}
            <span>Um pouco de clareza muda o mês.</span>
            <span>Prévia com dados fictícios</span>
          </div>
          <img
            src="/welcome/overview-local.png"
            alt="Painel real do Zelo com saldo, categorias e próximos pagamentos demonstrativos"
            width="2880"
            height="2000"
            fetchPriority="high"
          />
          <a className="z-product-link" href="/demo">
            Abra o painel e explore <ArrowUpRight size={20} />
          </a>
        </div>
      </section>

      <section className="z-showcase z-section" id="conheca">
        <div className="z-section-title">
          <h2 data-reveal>Tudo no seu lugar.</h2>
          <p data-reveal>
            Do café de hoje ao plano de amanhã.
            <br />
            Tudo conectado, em um só lugar.
          </p>
        </div>
        <div className="z-feature-layout">
          <div className="z-feature-copy" data-reveal>
            <div
              className="z-resource-tabs"
              role="tablist"
              aria-label="Recursos do Zelo"
            >
              {resources.map((item, i) => (
                <button
                  id={"resource-tab-" + i}
                  key={item.file}
                  role="tab"
                  aria-selected={tab === i}
                  aria-controls={"resource-panel-" + i}
                  tabIndex={tab === i ? 0 : -1}
                  onClick={() => setTab(i)}
                  onKeyDown={(e) => {
                    if (
                      ["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)
                    ) {
                      e.preventDefault();
                      const next =
                        e.key === "Home"
                          ? 0
                          : e.key === "End"
                            ? 3
                            : (tab + (e.key === "ArrowRight" ? 1 : 3)) % 4;
                      setTab(next);
                      document.getElementById("resource-tab-" + next)?.focus();
                    }
                  }}
                >
                  {item.name}
                </button>
              ))}
            </div>
            <h3>{resource.title}</h3>
            <p>{resource.copy}</p>
            <a href={"/demo?view=" + resource.view} className="z-text-link">
              Explorar {resource.name.toLowerCase()} <ArrowRight size={19} />
            </a>
            <span className="z-demo-caption">
              Interface real. Valores demonstrativos.
            </span>
          </div>
          <div
            className={"z-feature-media z-media-" + resource.file}
            data-reveal
          >
            {resources.map((item, i) => (
              <div
                key={item.file}
                id={"resource-panel-" + i}
                role="tabpanel"
                aria-labelledby={"resource-tab-" + i}
                hidden={tab !== i}
                tabIndex={0}
              >
                <img
                  src={"/welcome/" + item.file + ".png"}
                  width="760"
                  height="440"
                  alt={
                    "Tela real de " + item.name + " com dados demonstrativos"
                  }
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="z-plans z-section" id="planos">
        <div className="z-plan-intro">
          <h2 data-reveal>
            Dê espaço
            <br />
            aos planos.
          </h2>
          <p data-reveal>
            Aquilo que você quer viver merece um lugar no seu orçamento.
            Descubra o que um pouco, todo mês, pode se tornar.
          </p>
          <a className="z-text-link" data-reveal href="/demo?view=savings">
            Conhecer os cofrinhos <ArrowUpRight size={19} />
          </a>
          <div className="z-saving-chart" data-reveal>
            <div>
              <span>Um pouco a cada mês.</span>
              <strong>{money(monthly * 12)} em um ano</strong>
            </div>
            <svg
              viewBox="0 0 420 180"
              role="img"
              aria-label={
                "Evolução de 12 depósitos de " +
                money(monthly) +
                ", sem rendimentos"
              }
            >
              {Array.from({ length: 12 }, (_, i) => (
                <rect
                  key={i}
                  x={i * 35 + 3}
                  y={158 - (i + 1) * 11}
                  width="23"
                  height={(i + 1) * 11}
                  rx="5"
                  style={{ animationDelay: i * 65 + "ms" }}
                />
              ))}
              <text x="3" y="179">
                1 mês
              </text>
              <text x="180" y="179">
                6 meses
              </text>
              <text x="355" y="179">
                12 meses
              </text>
            </svg>
          </div>
        </div>
        <div className="z-calculator" data-reveal data-ui>
          <label htmlFor="plan-name">Para que você quer guardar?</label>
          <input
            id="plan-name"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            maxLength={45}
          />
          <div className="z-calculator-value">
            <span>Guardando por mês</span>
            <div>
              <button
                onClick={() => setMonthly(Math.max(50, monthly - 50))}
                aria-label="Diminuir 50 reais"
                disabled={monthly === 50}
              >
                <Minus size={18} />
              </button>
              <output htmlFor="monthly-saving">{money(monthly)}</output>
              <button
                onClick={() => setMonthly(Math.min(2000, monthly + 50))}
                aria-label="Aumentar 50 reais"
                disabled={monthly === 2000}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
          <label className="z-range-label" htmlFor="monthly-saving">
            Ajuste o valor mensal
          </label>
          <input
            type="range"
            id="monthly-saving"
            min="50"
            max="2000"
            step="50"
            value={monthly}
            onChange={(e) => setMonthly(Number(e.target.value))}
          />
          <div className="z-range-ends">
            <span>R$ 50</span>
            <span>R$ 2.000</span>
          </div>
          <div className="z-plan-result" aria-live="polite">
            <span>Em 12 meses, para {plan.trim() || "o seu plano"}</span>
            <strong>{money(monthly * 12)}</strong>
          </div>
          <p>Simulação de valores guardados, sem rendimentos.</p>
        </div>
      </section>

      <section className="z-rhythm z-section">
        <div className="z-rhythm-heading">
          <h2 data-reveal>O cuidado vira hábito.</h2>
          <p data-reveal>
            Três pequenos movimentos.
            <br />
            Mais clareza todos os dias.
          </p>
        </div>
        <div className="z-rhythm-content">
          <a href="/demo?view=savings" className="z-rhythm-preview" data-reveal>
            <img
              src="/welcome/cofrinhos.png"
              width="383"
              height="397"
              loading="lazy"
              alt="Cofrinho Viagem no Zelo: valor guardado, progresso e contribuição mensal demonstrativos"
            />
            <span>
              Um plano que você pode acompanhar <ArrowUpRight size={18} />
            </span>
          </a>
          <div className="z-rhythm-list">
            {[
              [
                "Registre o dia.",
                "Anote o que entrou e o que saiu. Até os pequenos valores encontram seu lugar.",
              ],
              [
                "Entenda o mês.",
                "Veja suas categorias, confira as parcelas e acompanhe o que ainda está por vir.",
              ],
              [
                "Dê espaço ao futuro.",
                "Separe um valor para seus cofrinhos. Cada registro é mais um passo para os seus planos.",
              ],
            ].map(([title, copy]) => (
              <article key={title} data-reveal>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="z-faq z-section" id="duvidas">
        <div className="z-faq-intro">
          <h2 data-reveal>Antes de começar.</h2>
          <p data-reveal>Conheça o que o Zelo faz e explore no seu ritmo.</p>
          <a href="/demo" className="z-text-link" data-reveal>
            Abrir demonstração <ArrowUpRight size={19} />
          </a>
        </div>
        <div>
          {questions.map(([question, answer]) => (
            <details key={question} data-reveal>
              <summary>
                {question}
                <Plus size={21} aria-hidden="true" />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
      <LoginDrawer
        open={loginOpen}
        mode={authMode}
        onModeChange={setAuthMode}
        onClose={() => {
          setLoginOpen(false);
          if (["/login", "/cadastro"].includes(location.pathname))
            history.replaceState(null, "", "/");
        }}
      />
      <footer className="z-footer">
        <div className="z-footer-top">
          <h2 data-reveal>
            Seu próximo passo.
            <br />
            Com Zelo.
          </h2>
          <div data-reveal>
            <a className="z-button" href="/demo">
              Experimentar agora <ArrowUpRight size={20} />
            </a>
            <p>Explore com dados fictícios, sem cadastro.</p>
          </div>
        </div>
        <a
          className="z-footer-wordmark"
          href="#inicio"
          aria-label="Zelo, voltar ao topo"
        >
          Zelo.
        </a>
        <div className="z-footer-bottom">
          <span>© {new Date().getFullYear()} Zelo · Finanças pessoais</span>
          <span>Feito por Caio Firmino</span>
          <a href="#inicio">Voltar ao topo ↑</a>
        </div>
      </footer>
    </main>
  );
}
