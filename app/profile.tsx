"use client";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, CalendarDays, Camera, Check, ChevronRight, CircleUserRound, Mail, Pencil, Phone, Plus, ShieldCheck, Trash2, Wallet, X } from "lucide-react";
import { demoProfile, emptyProfile, nextPaydays, parseProfileSalary, validateProfile, type Profile } from "@/lib/profile";
import { localDate, money } from "@/lib/finance";
import "./profile.css";

async function profileApi(method: "GET" | "PUT", profile?: Profile) {
  const response = await fetch("/api/profile", { method, cache:"no-store", headers:{"Content-Type":"application/json"}, body:profile ? JSON.stringify(profile) : undefined });
  const data = await response.json() as { profile:Profile; accountEmail:string; error?:string };
  if (!response.ok) throw new Error(data.error || "Não foi possível acessar seu perfil.");
  return data as { profile:Profile; accountEmail:string };
}
export function useProfile(demo:boolean) {
  const [example,setExample] = useState<Profile>(()=>({...demoProfile,paydays:[...demoProfile.paydays]}));
  const [personal,setPersonal] = useState<Profile>(emptyProfile);
  const [accountEmail,setAccountEmail] = useState("");
  const [loaded,setLoaded] = useState(false);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const request = useRef(0);
  const lock = useRef(false);
  const reload = useCallback(async()=>{
    const id=++request.current;setLoaded(false);setError("");
    try { const result=await profileApi("GET");if(id!==request.current)return;setPersonal(result.profile);setAccountEmail(result.accountEmail);setLoaded(true); }
    catch(caught) {if(id===request.current)setError(caught instanceof Error ? caught.message : "Não foi possível carregar seu perfil.");}
  },[]);
  const invalidateRequests=useCallback(()=>{request.current++;},[]);
  useEffect(()=>{
    let active=true;
    if(!demo)void Promise.resolve().then(()=>{if(active)void reload();});
    return()=>{active=false;invalidateRequests();};
  },[demo,reload,invalidateRequests]);
  async function save(value:Profile) {
    if(lock.current)throw new Error("Aguarde o perfil terminar de salvar.");
    if(!demo && (!loaded || error))throw new Error("Carregue seu perfil antes de editar.");
    const valid=validateProfile(value);lock.current=true;setBusy(true);
    try {if(demo)setExample(valid);else{const result=await profileApi("PUT",valid);request.current++;setPersonal(result.profile);setAccountEmail(result.accountEmail);} }
    finally{lock.current=false;setBusy(false);}
  }
  return {profile:demo ? example : personal,accountEmail:demo ? "Demonstração" : accountEmail,loaded:demo || loaded,error:demo ? "" : error,busy,demo,reload,save};
}
type Controller=ReturnType<typeof useProfile>;
export function ProfileAvatar({profile,size="small"}:{profile:Profile;size?:"small"|"large"}) {
  const initials=profile.preferredName.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase() || "Z";
  return <span className={"profile-avatar avatar-"+size} aria-hidden="true">{profile.avatar ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={profile.avatar} alt="" width={size==="large"?112:36} height={size==="large"?112:36} />
  ) : initials}</span>;
}
const shown=(value:string)=>value || "Não informado";
const dateLabel=(value:string)=>new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"long",timeZone:"UTC"}).format(new Date(value+"T12:00:00Z"));

export function ProfilePage({controller,initialEditing=false}:{controller:Controller;initialEditing?:boolean}) {
  const router=useRouter();
  const {profile,loaded,error,busy,demo}=controller;
  const [editing,setEditing]=useState(initialEditing);
  const [draft,setDraft]=useState<Profile>(profile);
  const [salary,setSalary]=useState(profile.monthlySalary===null ? "" : (profile.monthlySalary/100).toFixed(2).replace(".",","));
  const [day,setDay]=useState("");
  const [formError,setFormError]=useState("");
  const [notice,setNotice]=useState("");
  const [uploading,setUploading]=useState(false);
  const fileInput=useRef<HTMLInputElement>(null);
  const formHeading=useRef<HTMLHeadingElement>(null);
  const initializedMode=useRef<boolean|null>(null);
  useEffect(()=>{
    if(loaded && initializedMode.current!==demo){initializedMode.current=demo;setDraft({...profile,paydays:[...profile.paydays]});setSalary(profile.monthlySalary===null?"":(profile.monthlySalary/100).toFixed(2).replace(".",","));}
  },[profile,loaded,demo]);
  function openEditor(){
    setDraft({...profile,paydays:[...profile.paydays]});setSalary(profile.monthlySalary===null?"":(profile.monthlySalary/100).toFixed(2).replace(".",","));setFormError("");setNotice("");
    if(!demo){router.push("/app/perfil/editar");return;}
    setEditing(true);requestAnimationFrame(()=>formHeading.current?.focus());
  }
  function cancel(){if(!demo){router.push("/app/perfil");return;}setEditing(false);setFormError("");requestAnimationFrame(()=>formHeading.current?.focus());}
  async function upload(event:ChangeEvent<HTMLInputElement>){
    const input=event.currentTarget;const file=input.files?.[0];if(!file)return;
    setFormError("");
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setFormError("Escolha uma foto JPG, PNG ou WebP.");input.value="";return;}
    if(file.size>5*1024*1024){setFormError("A foto deve ter no máximo 5 MB.");input.value="";return;}
    setUploading(true);
    try{const image=await createImageBitmap(file);const side=Math.min(image.width,image.height);const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;const context=canvas.getContext("2d");if(!context)throw new Error();context.drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,0,0,256,256);image.close();const avatar=canvas.toDataURL("image/webp",.86);setDraft(current=>({...current,avatar}));}
    catch{setFormError("Não foi possível abrir essa foto. Tente outra imagem.");}
    finally{setUploading(false);input.value="";}
  }
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy||uploading)return;setFormError("");
    try{await controller.save({...draft,monthlySalary:salary.trim()?parseProfileSalary(salary):null});setEditing(false);if(!demo)history.replaceState({},"","/app/perfil");setNotice(demo?"Perfil de demonstração atualizado. Essas alterações são temporárias.":"Perfil atualizado com sucesso.");requestAnimationFrame(()=>formHeading.current?.focus());}
    catch(caught){setFormError(caught instanceof Error?caught.message:"Não foi possível salvar. Tente novamente.");}
  }
  function addDay(){const value=Number(day);if(!Number.isInteger(value)||value<1||value>31){setFormError("Informe um dia entre 1 e 31.");return;}if(draft.paydays.includes(value)){setFormError("Esse dia já foi adicionado.");return;}if(draft.paydays.length>=6){setFormError("Você pode adicionar até seis dias de pagamento.");return;}setDraft({...draft,paydays:[...draft.paydays,value].sort((a,b)=>a-b)});setDay("");setFormError("");}
  const dates=nextPaydays(profile.paydays,localDate());
  if(!loaded)return <section className="profile-state" role={error?"alert":"status"}><CircleUserRound size={32} aria-hidden="true" /><h1>Seu perfil</h1><p>{error||"Carregando seu espaço pessoal…"}</p>{error&&<button className="secondary-button" onClick={()=>void controller.reload()}>Tentar novamente</button>}</section>;
  return <div className="profile-page">
    <div className="profile-page-heading"><div><span className="eyebrow">Seu espaço pessoal</span><h1 ref={formHeading} tabIndex={-1}>{editing?"Do seu jeito.":"Meu perfil."}</h1><p>{editing?"Atualize suas informações e os dias em que recebe.":"Suas informações, sua rotina e os próximos planos."}</p></div>{!editing&&<button className="primary-button" onClick={openEditor}><Pencil size={16} aria-hidden="true" />Editar meus dados</button>}</div>
    {notice&&<p className="notice" role="status"><Check size={18} aria-hidden="true" /><span>{notice}</span></p>}
    {editing ? <form className="profile-edit-form" onSubmit={save}>
      <div className="profile-editor-layout"><div className="profile-fields">
        <section className="profile-section"><div className="profile-section-heading"><CircleUserRound size={21} aria-hidden="true" /><div><h2>Informações pessoais</h2><p>Como você se apresenta no Zelo.</p></div></div>
          <fieldset disabled={busy||uploading}><div className="profile-pair"><label>Como quer ser chamado?<input autoFocus name="preferredName" autoComplete="nickname" required maxLength={80} value={draft.preferredName} onChange={e=>setDraft({...draft,preferredName:e.target.value})} placeholder="Seu nome ou apelido" /></label><label>Nome completo<input name="fullName" autoComplete="name" maxLength={160} value={draft.fullName} onChange={e=>setDraft({...draft,fullName:e.target.value})} placeholder="Seu nome completo" /></label></div>
          <div className="profile-pair"><label>E-mail de contato<input name="email" type="email" autoComplete="email" maxLength={254} value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})} placeholder="voce@exemplo.com" /><small>Esse endereço não altera o acesso pelo ChatGPT.</small></label><label>Telefone<input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})} placeholder="(11) 99999-9999" /></label></div></fieldset>
        </section>
        <section className="profile-section"><div className="profile-section-heading"><BriefcaseBusiness size={21} aria-hidden="true" /><div><h2>Trabalho e renda</h2><p>Um retrato da sua rotina profissional.</p></div></div>
          <fieldset disabled={busy||uploading}><div className="profile-pair"><label>Cargo ou profissão<input name="occupation" autoComplete="organization-title" maxLength={120} value={draft.occupation} onChange={e=>setDraft({...draft,occupation:e.target.value})} placeholder="Ex.: analista, designer, autônomo" /></label><label>Empresa<input name="company" autoComplete="organization" maxLength={160} value={draft.company} onChange={e=>setDraft({...draft,company:e.target.value})} placeholder="Onde você trabalha" /></label></div><label className="profile-salary-field">Salário mensal (R$)<input name="monthlySalary" inputMode="decimal" value={salary} onChange={e=>setSalary(e.target.value)} placeholder="Ex.: 3.500,00" /><small>Informe o valor que costuma receber no mês. Se a renda variar, você pode deixar em branco.</small></label></fieldset>
        </section>
        <section className="profile-section"><div className="profile-section-heading"><CalendarDays size={21} aria-hidden="true" /><div><h2>Dias de pagamento</h2><p>Adicione os dias do mês em que o dinheiro entra.</p></div></div>
          <fieldset disabled={busy||uploading}><div className="profile-pay-presets" role="group" aria-label="Sugestões de dias de pagamento"><button type="button" onClick={()=>setDraft({...draft,paydays:[5]})}>Mensal: dia 5</button><button type="button" onClick={()=>setDraft({...draft,paydays:[5,20]})}>Quinzenal: dias 5 e 20</button><button type="button" onClick={()=>setDraft({...draft,paydays:[15,30]})}>Quinzenal: dias 15 e 30</button></div>
          <div className="profile-paydays">{draft.paydays.map(value=><button type="button" key={value} aria-label={"Remover dia "+value} onClick={()=>setDraft({...draft,paydays:draft.paydays.filter(d=>d!==value)})}><CalendarDays size={14} aria-hidden="true" />Dia {value}<X size={13} aria-hidden="true" /></button>)}</div>
          <div className="profile-add-day"><label>Adicionar dia<input type="number" inputMode="numeric" min={1} max={31} value={day} onChange={e=>setDay(e.target.value)} placeholder="1 a 31" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addDay();}}} /></label><button type="button" className="secondary-button" onClick={addDay}><Plus size={16} aria-hidden="true" />Adicionar</button></div><p className="profile-help">Personalize as datas para sua quinzena ou outros recebimentos. Em meses mais curtos, usamos o último dia disponível.</p></fieldset>
        </section>
      </div><aside className="profile-photo-card"><h2>Sua foto de perfil</h2><ProfileAvatar profile={draft} size="large" /><p>Um toque seu no seu espaço.</p><input ref={fileInput} className="sr-only" type="file" tabIndex={-1} aria-label="Escolher foto de perfil" accept="image/jpeg,image/png,image/webp" onChange={event=>void upload(event)} /><button type="button" className="secondary-button" disabled={busy||uploading} onClick={()=>fileInput.current?.click()}><Camera size={16} aria-hidden="true" />{uploading?"Preparando foto…":"Escolher foto"}</button>{draft.avatar&&<button type="button" className="text-button" disabled={busy||uploading} onClick={()=>setDraft({...draft,avatar:""})}><Trash2 size={14} aria-hidden="true" />Remover foto</button>}<small>JPG, PNG ou WebP. Até 5 MB.<br />A foto será ajustada para um formato quadrado.</small><div className="profile-privacy-note"><ShieldCheck size={19} aria-hidden="true" /><p>{demo?"Você está editando um perfil fictício. As mudanças ficam só nesta demonstração.":"Esses dados pertencem ao seu perfil e ficam separados dos outros usuários."}</p></div></aside></div>
      {formError&&<p className="form-error" role="alert">{formError}</p>}
      <div className="profile-savebar"><button type="button" className="secondary-button" disabled={busy||uploading} onClick={cancel}><ArrowLeft size={16} aria-hidden="true" />Cancelar</button><button className="primary-button" disabled={busy||uploading}><Check size={17} aria-hidden="true" />{busy?"Salvando…":"Salvar alterações"}</button></div>
    </form> : <>
      <section className="profile-hero"><ProfileAvatar profile={profile} size="large" /><div><span>{demo?"Perfil de demonstração":"Esse espaço é seu"}</span><h2>{profile.preferredName||"Seu perfil"}</h2><p>{profile.occupation ? profile.occupation+(profile.company?" na "+profile.company:"") : "Conte um pouco mais sobre você."}</p></div><span className="profile-private"><ShieldCheck size={15} aria-hidden="true" />Pessoal</span></section>
      <div className="profile-details-grid"><section className="profile-section"><div className="profile-section-heading"><CircleUserRound size={21} aria-hidden="true" /><h2>Informações pessoais</h2></div><dl><div><dt>Nome completo</dt><dd>{shown(profile.fullName)}</dd></div><div><dt><Mail size={14} aria-hidden="true" />E-mail de contato</dt><dd>{shown(profile.email)}</dd></div><div><dt><Phone size={14} aria-hidden="true" />Telefone</dt><dd>{shown(profile.phone)}</dd></div></dl></section>
      <section className="profile-section"><div className="profile-section-heading"><BriefcaseBusiness size={21} aria-hidden="true" /><h2>Trabalho e renda</h2></div><dl><div><dt>Cargo ou profissão</dt><dd>{shown(profile.occupation)}</dd></div><div><dt>Empresa</dt><dd>{shown(profile.company)}</dd></div><div><dt><Wallet size={14} aria-hidden="true" />Salário mensal</dt><dd className="profile-salary">{profile.monthlySalary===null?"Não informado":money(profile.monthlySalary)}</dd></div></dl></section>
      <section className="profile-section profile-pay-summary"><div className="profile-section-heading"><CalendarDays size={21} aria-hidden="true" /><div><h2>Seus recebimentos</h2><p>{profile.paydays.length===2?"Duas datas no mês, no seu ritmo.":"Sua rotina de pagamento."}</p></div></div><div className="profile-calendar-days">{profile.paydays.map(value=><div key={value}><span>Todo mês</span><strong>{String(value).padStart(2,"0")}</strong><small>dia de pagamento</small></div>)}</div>{dates.length?<div className="profile-next-dates"><span>Próximas datas</span>{dates.map(date=><span key={date}><CalendarDays size={14} aria-hidden="true" />{dateLabel(date)}</span>)}</div>:<p className="profile-help">Você ainda não definiu seus dias de pagamento.</p>}<button className="text-button" onClick={openEditor}>Ajustar meus dias<ArrowRight size={15} aria-hidden="true" /></button><p className="profile-help">As datas organizam sua rotina. O salário não é lançado automaticamente como receita.</p></section>
      <section className="profile-section profile-account"><div className="profile-section-heading"><ShieldCheck size={21} aria-hidden="true" /><h2>Sua conta no Zelo</h2></div><p>{demo?"Conheça o perfil com dados fictícios. O controle pessoal será liberado após a integração do cadastro e login.":"Seu acesso continua vinculado à conta ChatGPT. As informações de contato podem ser editadas no seu perfil."}</p>{!demo&&<span>{controller.accountEmail}</span>}<button className="secondary-button" onClick={openEditor}>Alterar meus dados<ChevronRight size={16} aria-hidden="true" /></button></section></div>
    </>}
  </div>;
}
