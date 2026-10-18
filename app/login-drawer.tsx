"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ShieldCheck, Wrench, X } from "lucide-react";
import "./login-drawer.css";

type Mode = "login" | "signup";
export default function LoginDrawer({ open, mode, onModeChange, onClose }: { open: boolean; mode: Mode; onModeChange: (mode: Mode) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [closing, setClosing] = useState(false);
  const signup = mode === "signup";

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!element.open) element.showModal();
    heading.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (element.open) element.close();
    };
  }, [open]);

  function changeMode(next: Mode) {
    if (closing) return;
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
      setClosing(false);
      onClose();
    }, duration);
  }

  return <dialog ref={dialog} className="z-login-drawer" data-mode={mode} data-closing={closing} aria-labelledby="z-login-title" aria-describedby="z-login-description" onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  }}>
    <div className="z-login-inner">
      <header className="z-login-header"><span className="z-login-brand">Zelo.</span><button type="button" className="z-login-close" onClick={close} aria-label="Fechar aviso de manutenção"><X size={22} /></button></header>
      <div className="z-login-body" key={mode}>
        <div className="z-auth-switch" role="group" aria-label="Disponibilidade do acesso"><button type="button" aria-pressed={!signup} onClick={() => { if (signup) changeMode("login"); }}>Login</button><button type="button" aria-pressed={signup} onClick={() => { if (!signup) changeMode("signup"); }}>Cadastro</button></div>
        <Wrench className="z-maintenance-icon" size={40} aria-hidden="true" />
        <h2 ref={heading} tabIndex={-1} id="z-login-title">{signup ? "Cadastro em" : "Login em"}<br />manutenção.</h2>
        <p id="z-login-description">Estamos preparando seu espaço pessoal. Login e cadastro ainda não estão disponíveis.</p>
        <div className="z-maintenance-note"><ShieldCheck size={21} aria-hidden="true" /><p>Seus próprios lançamentos, cofrinhos e dados de perfil ficarão disponíveis após a integração do acesso à sua conta.</p></div>
        <a href="/demo" className="z-login-submit">Explorar demonstração <ArrowRight size={19} /></a>
        <button type="button" className="z-maintenance-back" onClick={close}>Continuar na página</button>
      </div>
      <footer className="z-login-footer"><ShieldCheck size={16} aria-hidden="true" /><p>A demonstração usa exemplos fictícios e não permite cadastrar ou alterar dados pessoais.</p></footer>
    </div>
  </dialog>;
}
