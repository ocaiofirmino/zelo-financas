"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, Eye, EyeOff, LockKeyhole, Mail, Phone, UserRound, X } from "lucide-react";
import "./login-drawer.css";

type Mode = "login" | "signup";
export default function LoginDrawer({ open, mode, onModeChange, onClose }: { open: boolean; mode: Mode; onModeChange: (mode: Mode) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const email = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const confirmation = useRef<HTMLInputElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [closing, setClosing] = useState(false);
  const [visible, setVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [notice, setNotice] = useState(false);
  const [touched, setTouched] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", phone: "", password: "", confirmation: "" });
  const signup = mode === "signup";
  const mismatch = touched && draft.confirmation.length > 0 && draft.confirmation !== draft.password;
  function update(field: keyof typeof draft, value: string) { setDraft(previous => ({ ...previous, [field]: value })); }

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!element.open) element.showModal();
    email.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (element.open) element.close();
    };
  }, [open]);

  useEffect(() => {
    confirmation.current?.setCustomValidity(draft.confirmation && draft.confirmation !== draft.password ? "As senhas precisam ser iguais." : "");
  }, [draft.confirmation, draft.password, mode]);

  function changeMode(next: Mode) {
    if (closing) return;
    setNotice(false); setVisible(false); setConfirmationVisible(false); setTouched(false);
    onModeChange(next);
    dialog.current?.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  }

  function close() {
    if (closing) return;
    setClosing(true);
    const duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280;
    closeTimer.current = setTimeout(() => {
      dialog.current?.close();
      setClosing(false); setVisible(false); setConfirmationVisible(false); setNotice(false); setTouched(false);
      setDraft(previous => ({ ...previous, password: "", confirmation: "" }));
      onClose();
    }, duration);
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setNotice(true); }

  return <dialog ref={dialog} className="z-login-drawer" data-mode={mode} data-closing={closing} aria-labelledby="z-login-title" aria-describedby="z-login-description" onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  }}>
    <div className="z-login-inner">
      <header className="z-login-header"><span className="z-login-brand">Zelo.</span><button type="button" className="z-login-close" onClick={close} aria-label={signup ? "Fechar cadastro" : "Fechar login"}><X size={22} /></button></header>
      <div className="z-login-body" key={mode}>
        <div className="z-auth-switch" role="group" aria-label="Acessar o Zelo"><button type="button" aria-pressed={!signup} onClick={() => { if (signup) changeMode("login"); }}>Entrar</button><button type="button" aria-pressed={signup} onClick={() => { if (!signup) changeMode("signup"); }}>Criar conta</button></div>
        <h2 ref={heading} tabIndex={-1} id="z-login-title">{signup ? <>Comece<br />com Zelo.</> : <>Bom ter você<br />por aqui.</>}</h2>
        <p id="z-login-description">{signup ? "Um primeiro passo para cuidar do seu dinheiro e dos seus planos." : "Entre para continuar cuidando do seu mês."}</p>
        <form className="z-login-form" onSubmit={submit}>
          {signup && <><label htmlFor="z-signup-name">Como quer ser chamado?</label><div className="z-login-field"><UserRound size={19} aria-hidden="true" /><input id="z-signup-name" name="name" autoComplete="nickname" placeholder="Seu nome ou apelido" required maxLength={80} value={draft.name} onChange={event => update("name", event.target.value)} /></div></>}
          <label htmlFor="z-login-email">E-mail</label>
          <div className="z-login-field"><Mail size={19} aria-hidden="true" /><input ref={email} id="z-login-email" name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" required maxLength={254} value={draft.email} onChange={event => update("email", event.target.value)} /></div>
          {signup && <><label htmlFor="z-signup-phone">Telefone</label><div className="z-login-field"><Phone size={19} aria-hidden="true" /><input id="z-signup-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" required minLength={8} maxLength={25} value={draft.phone} onChange={event => update("phone", event.target.value)} /></div></>}
          <label htmlFor="z-login-password">Senha</label>
          <div className="z-login-field"><LockKeyhole size={19} aria-hidden="true" /><input id="z-login-password" name="password" type={visible ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} placeholder={signup ? "Crie uma senha" : "Sua senha"} required minLength={signup ? 8 : 1} aria-describedby={signup ? "z-password-hint" : undefined} value={draft.password} onChange={event => update("password", event.target.value)} /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Ocultar senha" : "Mostrar senha"} aria-pressed={visible}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
          {signup && <><p className="z-password-hint" id="z-password-hint">Use pelo menos 8 caracteres. Prefira uma senha única.</p><label htmlFor="z-signup-confirmation">Confirme sua senha</label><div className="z-login-field"><LockKeyhole size={19} aria-hidden="true" /><input ref={confirmation} id="z-signup-confirmation" name="passwordConfirmation" type={confirmationVisible ? "text" : "password"} autoComplete="new-password" placeholder="Digite a senha novamente" required value={draft.confirmation} onChange={event => update("confirmation", event.target.value)} onBlur={() => setTouched(true)} aria-invalid={mismatch} aria-describedby={mismatch ? "z-confirmation-error" : undefined} /><button type="button" onClick={() => setConfirmationVisible(!confirmationVisible)} aria-label={confirmationVisible ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"} aria-pressed={confirmationVisible}>{confirmationVisible ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>{mismatch && <p className="z-confirmation-error" id="z-confirmation-error" role="status">As senhas precisam ser iguais.</p>}</>}
          <button className="z-login-submit" type="submit">{signup ? "Criar minha conta" : "Entrar na minha conta"} <ArrowRight size={19} /></button>
          {notice && <div className="z-login-notice" role="status"><p>{signup ? "O cadastro ainda está em preparação. Nenhuma conta foi criada e nenhum dado é enviado." : "O login ainda está em preparação. Neste exemplo, nenhum dado é enviado."}</p><a href="/demo">Explorar a demonstração <ArrowUpRight size={16} /></a></div>}
        </form>
        <div className="z-login-signup"><p>{signup ? "Já tem uma conta?" : "Ainda não tem uma conta?"}</p><a href={signup ? "/login" : "/cadastro"} onClick={event => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); changeMode(signup ? "login" : "signup"); }}>{signup ? "Entrar na minha conta" : "Criar minha conta"} <ArrowUpRight size={18} /></a></div>
      </div>
      <footer className="z-login-footer"><LockKeyhole size={16} aria-hidden="true" /><p>Prévia do novo acesso. A autenticação será integrada depois.</p></footer>
    </div>
  </dialog>;
}
