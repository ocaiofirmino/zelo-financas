"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { ArrowRight, ArrowUpRight, ArrowLeft, Check, Eye, EyeOff, LockKeyhole, Mail, UserRound, Pause, Play, Phone, PiggyBank, ChartNoAxesCombined, CreditCard, Wallet, ChevronRight } from "lucide-react";
import { MotionNav, useMotionView, useStageMotion } from "./motion";
import "./welcome.css";

type Screen = "home" | "login" | "signup";
const routes: Record<Screen, string> = { home: "/", login: "/login", signup: "/cadastro" };
const previews = [
  { label: "Meu mês", image: "mes", icon: Wallet, description: "Entenda o que entrou, o que saiu e o que está previsto sobrar." },
  { label: "Cofrinhos", image: "cofrinhos", icon: PiggyBank, description: "Dê nome aos seus planos e acompanhe cada valor guardado." },
  { label: "Cartão", image: "cartao", icon: CreditCard, description: "Veja as parcelas de agora e os compromissos dos próximos meses." },
  { label: "Extrato", image: "extrato", icon: ChartNoAxesCombined, description: "Confira suas categorias e leve seus extratos para Excel ou CSV." },
];

export default function Welcome({ initialScreen = "home" }: { initialScreen?: Screen }) {
  const [screen, setScreen] = useMotionView<Screen>(initialScreen);
  const [preview, setPreview] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationTouched, setConfirmationTouched] = useState(false);
  const confirmationInput = useRef<HTMLInputElement>(null);
  const [formNotice, setFormNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const formTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = previews[preview];
  const stageMotion = useStageMotion(paused || reducedMotion || !visible);
  useEffect(() => {
    const frame = requestAnimationFrame(() => heading.current?.focus({ preventScroll:true }));
    return () => cancelAnimationFrame(frame);
  }, [screen]);

  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update(); query.addEventListener("change", update);
    const visibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", visibility);
    const pop = () => { setScreen(location.pathname === "/login" ? "login" : location.pathname === "/cadastro" ? "signup" : "home"); setFormNotice(""); setPassword(""); setConfirmation(""); setConfirmationTouched(false); setShowConfirmation(false); };
    window.addEventListener("popstate", pop);
    return () => { query.removeEventListener("change", update); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("popstate", pop); if (formTimer.current) clearTimeout(formTimer.current); };
  }, [setScreen]);

  useEffect(() => {
    if (paused || reducedMotion || !visible) return;
    const timer = setInterval(() => setPreview(value => (value + 1) % previews.length), 6500);
    return () => clearInterval(timer);
  }, [paused, reducedMotion, visible]);

  useEffect(() => {
    confirmationInput.current?.setCustomValidity(
      confirmation && confirmation !== password ? "As senhas precisam ser iguais." : "",
    );
  }, [confirmation, password, screen]);

  function navigate(event: MouseEvent<HTMLAnchorElement>, next: Screen) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (busy) return;
    setScreen(next); setFormNotice(""); setPassword(""); setConfirmation(""); setConfirmationTouched(false); setShowConfirmation(false); setShowPassword(false);
    history.pushState({}, "", routes[next]);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setFormNotice("");
    formTimer.current = setTimeout(() => {
      setBusy(false);
      setFormNotice(screen === "signup"
        ? "O cadastro ainda está em preparação. Nenhuma conta foi criada. Por enquanto, explore a demonstração com dados fictícios."
        : "O login ainda está em preparação. Por enquanto, explore a demonstração com dados fictícios.");
    }, reducedMotion ? 0 : 450);
  }
  const strength = [password.length >= 8, /[A-Z]/.test(password) && /[a-z]/.test(password), /[0-9]/.test(password)].filter(Boolean).length;

  return (
    <main className="welcome" data-paused={paused || reducedMotion || !visible}>
      <section className="welcome-stage" aria-label="Conheça o Zelo">
        <Link href="/" onClick={event => navigate(event, "home")} className="welcome-logo" aria-label="Zelo, página inicial">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/zelo-logo.png" alt="" width={42} height={42} /><span>Zelo<span>.</span></span>
        </Link>
        <div className="stage-copy"><h2>Cuide do mês.<br />Dê espaço aos planos.</h2><p>Seu dinheiro merece esse cuidado.</p></div>
        <div className="stage-art" data-ui ref={stageMotion}>
          <span className="stage-z" aria-hidden="true">z</span>
          <div className="stage-orbit orbit-one" aria-hidden="true" /><div className="stage-orbit orbit-two" aria-hidden="true" />
          <div className="stage-product">
            <div className="stage-product-heading"><span><current.icon size={17} aria-hidden="true" />{current.label}</span><span>Prévia do Zelo</span></div>
            <div className={"stage-images image-" + current.image}>
              {previews.map((item, index) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={item.image} className={preview === index ? "selected" : ""} src={"/welcome/" + item.image + ".png"} alt={preview === index ? "Tela de " + item.label + " do Zelo, com dados fictícios" : ""} aria-hidden={preview !== index} width={760} height={440} />
              ))}
            </div>
            <div className="stage-product-foot"><span>Valores fictícios para você explorar.</span><Check size={15} aria-hidden="true" /></div>
          </div>
          <div className="stage-saving"><span className="saving-icon"><PiggyBank size={24} aria-hidden="true" /></span><div><span>Seu próximo plano</span><strong>Viagem. Um novo começo.</strong></div><ArrowUpRight size={18} aria-hidden="true" /></div>
        </div>
        <div className="stage-bottom">
          <MotionNav value={preview} className="preview-tabs" role="group" label="Explorar recursos do Zelo">{previews.map((item,index) => <button key={item.image} className={preview === index ? "active" : ""} aria-pressed={preview === index} onClick={() => {setPreview(index);setPaused(true);}}><item.icon size={17} aria-hidden="true" /><span>{item.label}</span></button>)}</MotionNav>
          <div className="preview-description"><p key={preview}>{current.description}</p><button className="motion-toggle" aria-label={paused ? "Retomar animações" : "Pausar animações"} aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}</button></div>
        </div>
      </section>

      <section className="welcome-content" aria-label={screen === "home" ? "Comece no Zelo" : screen === "login" ? "Entrar no Zelo" : "Criar uma conta no Zelo"}>
        <header className="welcome-topbar"><Link className="mobile-welcome-brand" href="/" onClick={event => navigate(event,"home")} aria-label="Zelo, página inicial">Zelo<span>.</span></Link><Link href="/" onClick={event => navigate(event,"home")} className={screen === "home" ? "current" : ""}>Conhecer</Link><div><a href="/login" onClick={event => navigate(event,"login")} className={screen === "login" ? "current" : ""}>Entrar</a><a href="/cadastro" onClick={event => navigate(event,"signup")} className="topbar-signup">Criar conta<ArrowUpRight size={14} aria-hidden="true" /></a></div></header>
        <div className={"welcome-screen screen-" + screen} key={screen}>
          {screen === "home" ? (
            <>
              <div className="welcome-heading"><h1 ref={heading} tabIndex={-1}><span>Seu mês.</span><span>Seus planos.</span></h1><p>Organize seus gastos, acompanhe o que sobra e transforme seus planos em cofrinhos.</p></div>
              <div className="welcome-actions"><a className="welcome-primary" href="/cadastro" onClick={event => navigate(event,"signup")}>Criar minha conta<ArrowRight size={18} aria-hidden="true" /></a><a className="welcome-demo" href="/demo">Explorar demonstração<ChevronRight size={17} aria-hidden="true" /></a></div>
              <div className="welcome-features"><div><Wallet size={19} aria-hidden="true" /><p><strong>Mais clareza no dia a dia.</strong><span>Receitas, gastos e parcelas no mesmo lugar.</span></p></div><div><PiggyBank size={19} aria-hidden="true" /><p><strong>Um lugar para cada plano.</strong><span>Crie metas e acompanhe o dinheiro guardado.</span></p></div></div>
              <p className="welcome-existing">Já usa o Zelo? <a href="/login" onClick={event => navigate(event,"login")}>Entre na sua conta.</a></p>
            </>
          ) : (
            <>
              <Link className="welcome-back" href="/" onClick={event => navigate(event,"home")}><ArrowLeft size={15} aria-hidden="true" />Voltar ao início</Link>
              <div className="welcome-heading"><h1 ref={heading} tabIndex={-1}>{screen === "signup" ? "Comece com Zelo." : "Seu espaço está aqui."}</h1><p>{screen === "signup" ? "Dê o primeiro passo para cuidar do seu dinheiro." : "Entre para continuar cuidando do seu mês."}</p></div>
              <form className="welcome-form" onSubmit={submit}>
                {screen === "signup" && <label>Como quer ser chamado?<div className="welcome-input"><UserRound size={18} aria-hidden="true" /><input name="name" autoComplete="nickname" placeholder="Seu nome ou apelido" required maxLength={80} /></div></label>}
                <label>E-mail<div className="welcome-input"><Mail size={18} aria-hidden="true" /><input name="email" type="email" autoComplete="email" inputMode="email" placeholder="voce@exemplo.com" required maxLength={254} /></div></label>
                {screen === "signup" && <label>Telefone<div className="welcome-input"><Phone size={18} aria-hidden="true" /><input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" required minLength={8} maxLength={25} /></div></label>}
                <label>Senha<div className="welcome-input"><LockKeyhole size={18} aria-hidden="true" /><input name="password" type={showPassword ? "text" : "password"} autoComplete={screen === "signup" ? "new-password" : "current-password"} placeholder={screen === "signup" ? "Crie uma senha" : "Digite sua senha"} required minLength={screen === "signup" ? 8 : 1} value={password} onChange={event => setPassword(event.target.value)} aria-describedby={screen === "signup" ? "password-hint" : undefined} /><button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></div></label>
                {screen === "signup" && <div className="password-hint" id="password-hint"><div className="password-strength" aria-hidden="true">{[1,2,3].map(level=><span key={level} className={strength>=level ? "filled" : ""} />)}</div><span>{password ? strength === 3 ? "Boa combinação. Prefira uma senha única." : "Use 8 ou mais caracteres, letras e números." : "Use pelo menos 8 caracteres."}</span></div>}
                {screen === "signup" && <label><span id="confirmation-label">Confirmação de senha</span><div className="welcome-input"><LockKeyhole size={18} aria-hidden="true" /><input ref={confirmationInput} name="passwordConfirmation" aria-labelledby="confirmation-label" type={showConfirmation ? "text" : "password"} autoComplete="new-password" placeholder="Digite sua senha novamente" required value={confirmation} onChange={event => setConfirmation(event.target.value)} onBlur={() => setConfirmationTouched(true)} aria-invalid={confirmationTouched && confirmation.length > 0 && confirmation !== password} aria-describedby={confirmationTouched && confirmation.length > 0 && confirmation !== password ? "confirmation-error" : undefined} /><button type="button" aria-label={showConfirmation ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"} aria-pressed={showConfirmation} onClick={() => setShowConfirmation(!showConfirmation)}>{showConfirmation ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></div>{confirmationTouched && confirmation.length > 0 && confirmation !== password && <span className="confirmation-error" id="confirmation-error">As senhas precisam ser iguais.</span>}</label>}
                {screen === "login" && <p className="welcome-login-note"><LockKeyhole size={13} aria-hidden="true" />Seu controle continua de onde você parou.</p>}
                {formNotice && <div className="welcome-form-notice" role="status"><p>{formNotice}</p><Link href="/demo">Explorar demonstração<ArrowRight size={15} aria-hidden="true" /></Link></div>}
                <button type="submit" className="welcome-primary" disabled={busy}>{busy ? "Conferindo…" : screen === "signup" ? "Criar minha conta" : "Entrar na minha conta"}{busy ? <span className="welcome-loader" aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}</button>
              </form>
              <p className="welcome-existing">{screen === "signup" ? "Já tem uma conta? " : "Ainda não tem conta? "}<a href={screen === "signup" ? "/login" : "/cadastro"} onClick={event => navigate(event,screen === "signup" ? "login" : "signup")}>{screen === "signup" ? "Entrar" : "Criar minha conta"}</a></p>
              <p className="welcome-preview-note">Seu controle pessoal será liberado após a integração do cadastro e login. Até lá, nenhum dado deste formulário é enviado.</p>
            </>
          )}
        </div>

      </section>
        <footer className="welcome-footer"><span>© {new Date().getFullYear()} Zelo</span><a href="https://github.com/ocaiofirmino/zelo-financas" target="_blank" rel="noopener noreferrer">Feito por Caio Firmino<ArrowUpRight size={13} aria-hidden="true" /></a></footer>
    </main>
  );
}
