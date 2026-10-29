"use client";

import { useRef, useState } from "react";
import { Link2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CreditCard } from "@/lib/cards";
import { money, type Transaction } from "@/lib/finance";
import { MAX_BULK_LINK } from "@/lib/transaction-batch";

export default function CardBulkLink({
  cards,
  transactions,
  readOnly,
  disabled,
  onLink,
}: {
  cards: CreditCard[];
  transactions: Transaction[];
  readOnly: boolean;
  disabled: boolean;
  onLink: (ids: string[], cardId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [cardId, setCardId] = useState("");
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement | null>(null);
  const candidates = transactions
    .filter(
      (row) => row.type === "expense" && row.payment === "card" && !row.cardId,
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.description.localeCompare(b.description),
    );
  const activeCards = cards.filter((card) => !card.archived);
  const visible = candidates.filter((row) =>
    row.description
      .toLocaleLowerCase("pt-BR")
      .includes(query.trim().toLocaleLowerCase("pt-BR")),
  );
  const selection = candidates.filter((row) => selected.has(row.id));
  if (readOnly || !candidates.length) return null;

  function start() {
    setSelected(new Set());
    setQuery("");
    setCardId("");
    setError("");
    setOpen(true);
  }
  function toggle(id: string) {
    setError("");
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_BULK_LINK) next.add(id);
      return next;
    });
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (disabled || !selection.length) return;
    try {
      await onLink(
        selection.map((row) => row.id),
        cardId,
      );
      setOpen(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível vincular os lançamentos.",
      );
    }
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="secondary-button"
        disabled={disabled}
        onClick={start}
      >
        <Link2 size={17} /> Vincular compras antigas{" "}
        <span className="card-count">{candidates.length}</span>
      </button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!disabled) setOpen(next);
        }}
      >
        <DialogContent
          className="finance-dialog bulk-link-dialog"
          showCloseButton={!disabled}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (trigger.current?.isConnected) trigger.current.focus();
            else
              document
                .querySelector<HTMLButtonElement>(
                  ".multi-cards .primary-button",
                )
                ?.focus();
          }}
        >
          <DialogTitle>Vincular compras antigas</DialogTitle>
          <DialogDescription>
            Escolha até {MAX_BULK_LINK} lançamentos sem cartão e vincule todos
            de uma vez. Valores, vencimentos e situações serão preservados.
          </DialogDescription>
          <form className="finance-form" onSubmit={submit}>
            <label>
              Cartão de destino
              <select
                required
                value={cardId}
                disabled={disabled}
                onChange={(event) => setCardId(event.target.value)}
              >
                <option value="">Selecione um cartão ativo</option>
                {activeCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                  </option>
                ))}
              </select>
            </label>
            {!activeCards.length && (
              <p className="form-note">
                Cadastre ou restaure um cartão antes de vincular compras.
              </p>
            )}
            <label>
              Buscar lançamento
              <input
                type="search"
                placeholder="Buscar pela descrição"
                value={query}
                disabled={disabled}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="bulk-link-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={disabled || !visible.length}
                onClick={() =>
                  setSelected(
                    new Set(
                      visible.slice(0, MAX_BULK_LINK).map((row) => row.id),
                    ),
                  )
                }
              >
                Selecionar até {MAX_BULK_LINK} visíveis
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={disabled || !selection.length}
                onClick={() => setSelected(new Set())}
              >
                Limpar seleção
              </button>
            </div>
            <fieldset className="bulk-link-list">
              <legend className="sr-only">Compras sem cartão vinculado</legend>
              {visible.map((row) => (
                <label className="bulk-link-row" key={row.id}>
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${row.description}`}
                    checked={selected.has(row.id)}
                    disabled={
                      disabled ||
                      (!selected.has(row.id) && selected.size >= MAX_BULK_LINK)
                    }
                    onChange={() => toggle(row.id)}
                  />
                  <span>
                    {row.description}
                    <small>
                      {row.date.split("-").reverse().join("/")} ·{" "}
                      {row.status === "paid" ? "Pago" : "Previsto"}
                      {row.installments > 1
                        ? ` · ${row.installment}/${row.installments}`
                        : ""}
                    </small>
                  </span>
                  <strong>{money(row.amount)}</strong>
                </label>
              ))}
              {!visible.length && (
                <p className="form-note bulk-link-empty">
                  Nenhum lançamento encontrado para essa busca.
                </p>
              )}
            </fieldset>
            <p className="form-note" aria-live="polite">
              {selection.length} selecionados ·{" "}
              {money(selection.reduce((sum, row) => sum + row.amount, 0))}
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-buttons">
              <button
                type="button"
                className="secondary-button"
                disabled={disabled}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={disabled || !selection.length || !cardId}
              >
                {disabled
                  ? "Vinculando…"
                  : `Vincular ${selection.length} ${selection.length === 1 ? "lançamento" : "lançamentos"}`}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
