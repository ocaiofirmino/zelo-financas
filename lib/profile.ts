import { parseAmount } from "./finance.ts";

export type Profile = {
  preferredName: string;
  fullName: string;
  email: string;
  phone: string;
  occupation: string;
  company: string;
  monthlySalary: number | null;
  paydays: number[];
  avatar: string;
};
export const emptyProfile: Profile = { preferredName: "", fullName: "", email: "", phone: "", occupation: "", company: "", monthlySalary: null, paydays: [], avatar: "" };
export const demoProfile: Profile = { ...emptyProfile, preferredName: "Alex", fullName: "Alex Silva", email: "alex@example.com", phone: "(11) 99999-0000", occupation: "Designer de produto", company: "Estúdio Criativo", monthlySalary: 620000, paydays: [5, 20] };

function text(value: unknown, label: string, max: number, required = false) {
  if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) throw new Error("Confira " + label + ".");
  return value.trim();
}
export function validateProfile(value: unknown): Profile {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Dados de perfil inválidos.");
  const v = value as Record<string, unknown>;
  const preferredName = text(v.preferredName, "como quer ser chamado", 80, true);
  const fullName = text(v.fullName, "seu nome completo", 160);
  const email = text(v.email, "o e-mail de contato", 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Confira o e-mail de contato.");
  const phone = text(v.phone, "o telefone", 30);
  if (phone && (phone.replace(/\D/g, "").length < 8 || phone.replace(/\D/g, "").length > 15 || !/^[+\d\s().-]+$/.test(phone))) throw new Error("Confira o telefone, incluindo o DDD.");
  const occupation = text(v.occupation, "seu cargo ou profissão", 120);
  const company = text(v.company, "a empresa", 160);
  if (v.monthlySalary !== null && (typeof v.monthlySalary !== "number" || !Number.isSafeInteger(v.monthlySalary) || v.monthlySalary < 0 || v.monthlySalary > 1000000000)) throw new Error("Informe um salário válido, em reais.");
  if (!Array.isArray(v.paydays) || v.paydays.length > 6 || v.paydays.some(d => !Number.isInteger(d) || d < 1 || d > 31) || new Set(v.paydays).size !== v.paydays.length) throw new Error("Escolha até seis dias diferentes, entre 1 e 31.");
  const avatar = text(v.avatar, "a foto de perfil", 220000);
  if (avatar) {
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(avatar);
    if (!match) throw new Error("Use uma foto JPG, PNG ou WebP.");
    let bytes: string;
    try { bytes = atob(match[2]); } catch { throw new Error("A foto está inválida."); }
    const valid = match[1] === "jpeg" ? bytes.startsWith("\xff\xd8\xff") : match[1] === "png" ? bytes.startsWith("\x89PNG\r\n\x1a\n") : bytes.startsWith("RIFF") && bytes.slice(8,12) === "WEBP";
    if (!valid || bytes.length > 160000) throw new Error("A foto está inválida ou é muito grande.");
  }
  return { preferredName, fullName, email, phone, occupation, company, monthlySalary: v.monthlySalary as number | null, paydays: [...v.paydays].sort((a,b) => a-b) as number[], avatar };
}
export function nextPaydays(days: number[], today: string, count = 3) {
  const [year, month] = today.split("-").map(Number);
  const dates: string[] = [];
  for (let offset=0; offset<4; offset++) {
    const base = new Date(Date.UTC(year, month-1+offset, 1, 12));
    const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth()+1, 0, 12)).getUTCDate();
    for (const day of days) {
      const date = `${base.getUTCFullYear()}-${String(base.getUTCMonth()+1).padStart(2,"0")}-${String(Math.min(day,last)).padStart(2,"0")}`;
      if (date >= today && !dates.includes(date)) dates.push(date);
    }
  }
  return dates.sort().slice(0,count);
}

export function parseProfileSalary(input: string) {
  let value=input.trim().replace(/^R\$\s*/, "").trim();
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(value)) value=value.replace(/\./g, "");
  return parseAmount(value);
}
