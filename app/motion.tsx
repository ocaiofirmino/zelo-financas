"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";

let activeTransition: ViewTransition | null = null;
let navigation = 0;
export function transitionUI(update: () => void, resetScroll = false) {
  const id = ++navigation;
  activeTransition?.skipTransition();
  if (typeof document === "undefined" || !document.startViewTransition || document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    activeTransition = null;
    update();
    if (resetScroll && typeof window !== "undefined") window.scrollTo({ top:0, behavior:"instant" });
    return;
  }
  try {
    const transition = document.startViewTransition(() => {
      if (id !== navigation) return;
      flushSync(update);
      if (resetScroll) window.scrollTo({ top:0, behavior:"instant" });
    });
    activeTransition = transition;
    void transition.ready.catch(() => {});
    void transition.finished.then(() => { if (activeTransition === transition) activeTransition = null; }, () => { if (activeTransition === transition) activeTransition = null; });
  } catch { update(); }
}
export function useMotionView<T extends string>(initial: T) {
  const [view, setView] = useState(initial);
  const current = useRef(initial);
  const navigate = useCallback((next: T) => {
    if (current.current === next) return;
    current.current = next;
    transitionUI(() => setView(next), true);
  }, []);
  return [view, navigate] as const;
}

export function MotionNav({ value, children, className = "", label, role }: { value: string | number; children: ReactNode; className?: string; label: string; role?: "group" }) {
  const root = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<{ x:number; y:number; width:number; height:number; active:boolean } | null>(null);
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const selected = node.querySelector<HTMLElement>('[aria-current="page"], [aria-pressed="true"]');
      if (!selected || !node.getClientRects().length) { setPosition(previous => previous?.active ? { ...previous, active:false } : previous); return; }
      const next = { x:selected.offsetLeft, y:selected.offsetTop, width:selected.offsetWidth, height:selected.offsetHeight, active:true };
      setPosition(previous => previous && previous.x === next.x && previous.y === next.y && previous.width === next.width && previous.height === next.height && previous.active ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    for (const child of node.children) if (child.tagName === "BUTTON") observer.observe(child);
    const frame = requestAnimationFrame(() => { measure(); setReady(true); });
    void document.fonts.ready.then(measure);
    return () => { alive=false; cancelAnimationFrame(frame); observer.disconnect(); };
  }, [value]);
  return <nav ref={root} className={"motion-nav " + className} data-nav-ready={ready} aria-label={label} role={role}>
    <span className="motion-nav-highlight" aria-hidden="true" style={{ width:position?.width || 0, height:position?.height || 0, transform:`translate3d(${position?.x || 0}px,${position?.y || 0}px,0)`, opacity:position?.active ? 1 : 0 }} />
    {children}
  </nav>;
}

type MotionKind = "panel" | "card" | "row" | "heading" | "progress" | "chart" | "forecast" | "photo" | "feedback";
const targets: [MotionKind,string][] = [
  ["heading", ".dashboard-intro > div, .page-head > div, .profile-page-heading > div"],
  ["panel", ".balance-panel,.savings-overview,.category-panel,.due-panel,.recent-panel,.list-panel,.future-panel,.statement-panel,.savings-summary,.savings-schedule,.profile-section,.profile-hero,.profile-photo-card,.statement-equation"],
  ["card", ".savings-card,.card-summary > div,.future-months > button"],
  ["row", ".data-table tbody > tr,.spending-row,.due-item,.income-row,.savings-schedule-row,.savings-history-row,.profile-calendar-days > div"],
  ["progress", ".spending-track > span,.savings-progress > span,.due-track > div"],
  ["chart", ".sparkline-actual"],
  ["forecast", ".sparkline-forecast"],
  ["photo", ".profile-avatar img"],
  ["feedback", ".notice,.savings-notice"],
];

/** Reveals only visible content, with no hidden CSS state or scroll handlers. */
export function useMotionDirector(viewKey: string) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = root.current;
    if (!node || !Element.prototype.animate) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let seen = new WeakSet<Element>();
    let kinds = new WeakMap<Element,MotionKind>();
    const running = new Set<Animation>();
    let intersections: IntersectionObserver | null = null;
    let mutations: MutationObserver | null = null;
    let scanFrame = 0;
    const stop = () => { intersections?.disconnect(); mutations?.disconnect(); cancelAnimationFrame(scanFrame); for (const animation of running) animation.cancel(); running.clear(); };
    const play = (element: Element) => {
      if (preference.matches || !element.isConnected || !element.getClientRects().length) return;
      const kind = kinds.get(element) || "panel";
      if (kind === "row" && document.activeElement?.matches("input,textarea")) return;
      const siblings = element.parentElement ? Array.from(element.parentElement.children) : [];
      const stagger = ["row","card"].includes(kind) ? Math.min(5, Math.max(0,siblings.indexOf(element))) * 45 : 0;
      let frames: Keyframe[] = [{ opacity:.3, transform:"translate3d(0,20px,0)" },{ opacity:1, transform:"translate3d(0,0,0)" }];
      let duration = 620;
      let delay = stagger;
      if (kind === "heading") { frames=[{opacity:.3,transform:"translate3d(0,12px,0)"},{opacity:1,transform:"translate3d(0,0,0)"}]; duration=560; }
      if (kind === "row") { frames=[{opacity:.2,transform:"translate3d(-10px,0,0)"},{opacity:1,transform:"translate3d(0,0,0)"}]; duration=440; }
      if (kind === "card") { frames=[{opacity:.3,transform:"translate3d(0,22px,0) scale(.98)"},{opacity:1,transform:"translate3d(0,0,0) scale(1)"}]; duration=650; }
      if (kind === "progress") { frames=[{transform:"scaleX(0)"},{transform:"scaleX(1)"}]; duration=1050; delay=160; }
      if (kind === "chart") { frames=[{strokeDashoffset:"1",opacity:.3},{strokeDashoffset:"0",opacity:1}]; duration=1300; delay=160; }
      if (kind === "forecast") { frames=[{clipPath:"inset(0 100% 0 0)",opacity:0},{clipPath:"inset(0 0% 0 0)",opacity:1}]; duration=700; delay=700; }
      if (kind === "photo") { frames=[{opacity:.3,transform:"scale(.94)"},{opacity:1,transform:"scale(1)"}]; duration=450; }
      if (kind === "feedback") { frames=[{opacity:0,transform:"translate3d(0,-8px,0) scale(.99)"},{opacity:1,transform:"translate3d(0,0,0) scale(1)"}]; duration=340; }
      for (const animation of element.getAnimations()) if ("animationName" in animation && ["panel-enter","notice-enter"].includes(String(animation.animationName))) animation.cancel();
      const animation = element.animate(frames,{duration,delay,easing:"cubic-bezier(.22,1,.36,1)",fill:"both"});
      animation.id = "zelo-" + kind;
      running.add(animation);
      void animation.finished.then(() => { running.delete(animation); animation.cancel(); }, () => running.delete(animation));
    };
    const scan = () => {
      scanFrame=0;
      for (const [kind,selector] of targets) for (const element of node.querySelectorAll(selector)) {
        if (seen.has(element)) continue;
        seen.add(element); kinds.set(element,kind);
        for (const animation of element.getAnimations()) if ("animationName" in animation && String(animation.animationName) === "panel-enter") animation.cancel();
        if (intersections) intersections.observe(element); else play(element);
      }
    };
    const start = () => {
      stop();
      if (preference.matches) return;
      seen=new WeakSet(); kinds=new WeakMap();
      intersections=new IntersectionObserver(entries => { for (const entry of entries) if(entry.isIntersecting){intersections?.unobserve(entry.target);play(entry.target);} }, {threshold:.04,rootMargin:"0px 0px -16px 0px"});
      scan();
      mutations=new MutationObserver(records => {
        if (records.some(record => Array.from(record.addedNodes).some(child => child instanceof Element)) && !scanFrame) scanFrame=requestAnimationFrame(scan);
        for (const record of records) if(record.type === "attributes" && record.target instanceof HTMLImageElement && record.target.closest(".profile-avatar")){kinds.set(record.target,"photo");play(record.target);}
      });
      mutations.observe(node,{childList:true,subtree:true,attributes:true,attributeFilter:["src"]});
    };
    start(); preference.addEventListener("change",start);
    return () => { stop(); preference.removeEventListener("change",start); };
  }, [viewKey]);
  return root;
}

export function useStageMotion(disabled:boolean) {
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const node=root.current;
    if (!node || disabled || !matchMedia("(hover:hover) and (pointer:fine)").matches) return;
    const product=node.querySelector<HTMLElement>(".stage-product");
    if(!product)return;
    let frame=0;
    const move=(event:PointerEvent)=>{
      cancelAnimationFrame(frame);
      const {clientX,clientY}=event;
      frame=requestAnimationFrame(()=>{
        const rect=node.getBoundingClientRect();
        const x=Math.max(-1,Math.min(1,(clientX-rect.left)/rect.width*2-1));
        const y=Math.max(-1,Math.min(1,(clientY-rect.top)/rect.height*2-1));
        product.style.setProperty("--stage-tilt",(x*4).toFixed(2)+"deg");
        product.style.setProperty("--stage-x",(x*4).toFixed(2)+"px");
        product.style.setProperty("--stage-y",(y*4).toFixed(2)+"px");
      });
    };
    const reset=()=>{cancelAnimationFrame(frame);for(const property of ["--stage-tilt","--stage-x","--stage-y"])product.style.removeProperty(property);};
    node.addEventListener("pointermove",move,{passive:true});node.addEventListener("pointerleave",reset);
    return()=>{reset();node.removeEventListener("pointermove",move);node.removeEventListener("pointerleave",reset);};
  },[disabled]);
  return root;
}
