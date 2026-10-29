"use client";

import { useRef, useState, type ReactNode } from "react";
import { Archive, ArchiveRestore, CreditCard as CardIcon, Pencil, Plus, Trash2 } from "lucide-react";
import CardBulkLink from "./card-bulk-link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cardInvoice,
  validateCard,
  type CardInput,
  type CreditCard,
} from "@/lib/cards";
import {
  money,
  monthTitle,
  parseAmount,
  shiftMonth,
  type Transaction,
} from "@/lib/finance";

type Props = {
  cards: CreditCard[];
  transactions: Transaction[];
  month: string;
  readOnly: boolean;
  disabled: boolean;
  onSave: (value: CardInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onArchive: (id: string, archived: boolean) => Promise<void>;
  onLink: (ids: string[], cardId: string) => Promise<void>;
  onNewPurchase: (cardId: string) => void;
  renderTransactions: (rows: Transaction[]) => ReactNode;
};

export default function CardsPage({
  cards,
  transactions,
  month,
  readOnly,
  disabled,
  onSave,
  onDelete,
  onArchive,
  onLink,
  onNewPurchase,
  renderTransactions,
}: Props) {
  const [selected, setSelected] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [archiveCard, setArchiveCard] = useState<CreditCard | null>(null);
  const [archiveError, setArchiveError] = useState("");
  const visibleCards = cards.filter((card) => Boolean(card.archived) === showArchived);
  const archiveCount = cards.filter((card) => card.archived).length;
  const [form, setForm] = useState<{ card?: CreditCard } | null>(null);
  const [name, setName] = useState("");
  const [limit, setLimit] = useState("");
  const [closingDay, setClosingDay] = useState("25");
  const [dueDay, setDueDay] = useState("5");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const selection =
    selected === "all" ||
    visibleCards.some((c) => c.id === selected) ||
    (!showArchived && selected === "unassigned")
      ? selected
      : "all";
  const unassigned = transactions.some(
    (r) => r.type === "expense" && r.payment === "card" && !r.cardId,
  );
  const shown: (CreditCard | null)[] = [
    ...visibleCards.filter((card) => selection === "all" || selection === card.id),
    ...(!showArchived && unassigned && (selection === "all" || selection === "unassigned")
      ? [null]
      : []),
  ];

  function openForm(card?: CreditCard) {
    if (readOnly || disabled) return;
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setName(card?.name ?? "");
    setLimit(card ? (card.creditLimit / 100).toFixed(2).replace(".", ",") : "");
    setClosingDay(String(card?.closingDay ?? 25));
    setDueDay(String(card?.dueDay ?? 5));
    setError("");
    setDeleting(false);
    setForm({ card });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (readOnly || disabled) return;
    setError("");
    try {
      const value = validateCard({
        name,
        creditLimit: parseAmount(limit),
        closingDay: Number(closingDay),
        dueDay: Number(dueDay),
      });
      await onSave(value, form?.card?.id);
      if (!form?.card) setShowArchived(false);
      setForm(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível salvar o cartão.",
      );
    }
  }

  async function remove() {
    if (readOnly || disabled || !form?.card) return;
    if (!deleting) {
      setDeleting(true);
      return;
    }
    setError("");
    try {
      await onDelete(form.card.id);
      setForm(null);
      setSelected("all");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível excluir o cartão.",
      );
    }
  }
  function confirmArchive(card: CreditCard) {
    if (readOnly || disabled) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setArchiveError("");
    setArchiveCard(card);
  }
  async function archive() {
    if (readOnly || disabled || !archiveCard) return;
    try { await onArchive(archiveCard.id, !archiveCard.archived); setArchiveCard(null); setSelected("all"); } catch (caught) { setArchiveError(caught instanceof Error ? caught.message : "Não foi possível alterar o cartão."); }
  }

  return (
    <div className="multi-cards">
      <div className="section-head">
        <div>
          <h2>{showArchived ? "Cartões arquivados" : "Meus cartões"}</h2>
          <p className="context-note">
            Compras e faturas organizadas por cartão.
          </p>
        </div>
        <div className="card-page-actions">
        {!showArchived && <CardBulkLink cards={cards} transactions={transactions} readOnly={readOnly} disabled={disabled} onLink={onLink} />}
        {!readOnly && (
          <button
            className="primary-button"
            disabled={disabled}
            onClick={() => openForm()}
          >
            <Plus size={17} /> Novo cartão
          </button>
        )}
        </div>
      </div>
      <div className="card-archive-tabs" aria-label="Exibir cartões"><button type="button" aria-pressed={!showArchived} onClick={() => { setShowArchived(false); setSelected("all"); }}>Ativos <span>{cards.length - archiveCount}</span></button><button type="button" aria-pressed={showArchived} onClick={() => { setShowArchived(true); setSelected("all"); }}><Archive size={16} /> Arquivados <span>{archiveCount}</span></button></div>
      <div className="credit-cards-grid">
        {visibleCards.map((card) => {
          const invoice = cardInvoice(transactions, card.id, month);
          const available = Math.max(0, card.creditLimit - invoice.committed);
          return (
            <article className="credit-card-tile" key={card.id} data-archived={card.archived}>
              <div className="credit-card-heading">
                <CardIcon size={23} />
                <strong>{card.name}</strong>
                {card.archived && <span className="card-archived-badge">Arquivado</span>}
                {!readOnly && (
                  <button
                    className="card-edit-button"
                    disabled={disabled}
                    aria-label={`Editar cartão ${card.name}`}
                    onClick={() => openForm(card)}
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </div>
              <button
                className="credit-card-select"
                aria-pressed={selection === card.id}
                onClick={() =>
                  setSelected(selection === card.id ? "all" : card.id)
                }
              >
                <span>Fatura de {monthTitle(month)}</span>
                <strong>{money(invoice.total)}</strong>
                <small>Ver compras e parcelas</small>
              </button>
              <dl className="credit-card-details">
                <div>
                  <dt>Limite disponível</dt>
                  <dd>{money(available)}</dd>
                </div>
                <div>
                  <dt>Limite total</dt>
                  <dd>{money(card.creditLimit)}</dd>
                </div>
                <div>
                  <dt>Fechamento</dt>
                  <dd>Dia {card.closingDay}</dd>
                </div>
                <div>
                  <dt>Vencimento</dt>
                  <dd>Dia {card.dueDay}</dd>
                </div>
              </dl>
              {!readOnly && <div className="card-archive-action"><button type="button" className="secondary-button" disabled={disabled} onClick={() => confirmArchive(card)}>{card.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}{card.archived ? "Restaurar cartão" : "Arquivar cartão"}</button></div>}
              {invoice.committed > card.creditLimit && (
                <p className="card-limit-alert" role="status">
                  Compromissos acima do limite em{" "}
                  {money(invoice.committed - card.creditLimit)}.
                </p>
              )}
            </article>
          );
        })}
      </div>
      {!visibleCards.length && (
        <div className="empty-state">
          <CardIcon size={32} />
          <h3>{showArchived ? "Nenhum cartão arquivado." : "Nenhum cartão ativo."}</h3>
          <p>
            {showArchived ? "Os cartões arquivados aparecerão aqui com seu histórico." : "Cadastre um cartão ou restaure um cartão arquivado para organizar suas compras."}
          </p>
        </div>
      )}
      {shown.length > 0 && (
        <label className="card-filter">
          Exibir faturas
          <select
            value={selection}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="all">Todos os cartões</option>
            {visibleCards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name}
              </option>
            ))}
            {!showArchived && unassigned && (
              <option value="unassigned">Sem cartão vinculado</option>
            )}
          </select>
        </label>
      )}
      {shown.map((card) => {
        const invoice = cardInvoice(transactions, card?.id ?? null, month);
        const nextMonths = Array.from({ length: 6 }, (_, i) =>
          shiftMonth(month, i + 1),
        ).filter((m) => m <= "2100-12");
        const dueDates = [...new Set(invoice.transactions.map((r) => r.date))];
        return (
          <section
            className="recent-panel card-invoice"
            key={card?.id ?? "unassigned"}
            aria-label={`Fatura: ${card?.name ?? "Sem cartão vinculado"}`}
          >
            <div className="section-head">
              <div>
                <h2>{card?.name ?? "Sem cartão vinculado"}</h2>
                <p className="context-note">
                  Fatura de {monthTitle(month)}
                  {dueDates.length === 1
                    ? ` · vence em ${dueDates[0].split("-").reverse().join("/")}`
                    : ""}
                </p>
              </div>
              {card && !card.archived && !readOnly && (
                <button
                  className="secondary-button"
                  disabled={disabled}
                  onClick={() => onNewPurchase(card.id)}
                >
                  <Plus size={16} /> Nova compra
                </button>
              )}
            </div>
            {!card && (
              <p className="context-note card-legacy-note">
                Seus lançamentos anteriores foram preservados. Vincule as compras em lote ou edite um lançamento para escolher seu cartão; o vencimento será mantido.
              </p>
            )}
            <dl className="invoice-totals">
              <div>
                <dt>Total da fatura</dt>
                <dd>{money(invoice.total)}</dd>
              </div>
              <div>
                <dt>Pago</dt>
                <dd>{money(invoice.paid)}</dd>
              </div>
              <div>
                <dt>A pagar</dt>
                <dd>{money(invoice.pending)}</dd>
              </div>
            </dl>
            {invoice.transactions.length > 0 ? (
              renderTransactions(invoice.transactions)
            ) : (
              <p className="card-empty-invoice">Nenhuma compra nesta fatura.</p>
            )}
            {card && nextMonths.length > 0 && (
              <details className="card-future">
                <summary>Próximas faturas e parcelas</summary>
                <div className="future-months">
                  {nextMonths.map((m) => (
                    <div className="card-future-month" key={m}>
                      <span>{monthTitle(m)}</span>
                      <strong>
                        {money(cardInvoice(transactions, card.id, m).pending)}
                      </strong>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </section>
        );
      })}
      <p className="context-note">
        O limite disponível desconta todas as compras ainda não pagas, incluindo
        parcelas futuras. Os cartões são registros manuais, sem conexão com o
        banco.
      </p>
      <Dialog open={archiveCard !== null} onOpenChange={(open) => { if (!open && !disabled) setArchiveCard(null); }}>
        <DialogContent className="finance-dialog" showCloseButton={!disabled} onCloseAutoFocus={(event) => { event.preventDefault(); if (returnFocus.current?.isConnected) returnFocus.current.focus(); else document.querySelector<HTMLButtonElement>(".multi-cards .primary-button")?.focus(); }}>
          <DialogTitle>{archiveCard?.archived ? "Restaurar cartão?" : "Arquivar cartão?"}</DialogTitle>
          <DialogDescription>{archiveCard?.name}. {archiveCard?.archived ? "O cartão voltará a receber novas compras." : "Novas compras serão bloqueadas. O histórico, as faturas e as parcelas futuras continuarão disponíveis em Arquivados e nos totais do mês."}</DialogDescription>
          {archiveCard && cardInvoice(transactions, archiveCard.id, month).committed > 0 && <p className="form-note">Este cartão ainda possui {money(cardInvoice(transactions, archiveCard.id, month).committed)} em compras pendentes.</p>}
          {archiveError && <p className="form-error" role="alert">{archiveError}</p>}
          <div className="form-buttons"><button type="button" className="secondary-button" disabled={disabled} onClick={() => setArchiveCard(null)}>Cancelar</button><button type="button" className="primary-button" disabled={disabled} onClick={() => void archive()}>{disabled ? "Salvando…" : archiveCard?.archived ? "Restaurar cartão" : "Arquivar cartão"}</button></div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={form !== null}
        onOpenChange={(open) => {
          if (!open && !disabled) setForm(null);
        }}
      >
        <DialogContent
          className="finance-dialog"
          showCloseButton={!disabled}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocus.current?.isConnected) returnFocus.current.focus();
            else
              document
                .querySelector<HTMLButtonElement>(
                  ".multi-cards .primary-button",
                )
                ?.focus();
          }}
        >
          <DialogTitle>
            {form?.card ? "Editar cartão" : "Novo cartão"}
          </DialogTitle>
          <DialogDescription>
            Configure o fechamento e o vencimento. Guarde apenas o nome do
            cartão, sem número completo ou código de segurança.
          </DialogDescription>
          <form className="finance-form" onSubmit={submit}>
            <label>
              Nome do cartão
              <input
                autoFocus
                required
                maxLength={40}
                value={name}
                placeholder="Ex.: Cartão principal"
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Limite total (R$)
              <input
                required
                inputMode="decimal"
                value={limit}
                placeholder="0,00"
                onChange={(e) => setLimit(e.target.value)}
              />
            </label>
            <div className="field-pair">
              <label>
                Dia de fechamento
                <input
                  required
                  type="number"
                  min={1}
                  max={31}
                  value={closingDay}
                  onChange={(e) => setClosingDay(e.target.value)}
                />
              </label>
              <label>
                Dia de vencimento
                <input
                  required
                  type="number"
                  min={1}
                  max={31}
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                />
              </label>
            </div>
            <p className="form-note">
              Compras no dia do fechamento entram na próxima fatura. Dias 29, 30
              e 31 se ajustam ao último dia do mês. Alterações valem para novas
              compras; vencimentos já registrados são preservados.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {deleting && (
              <p className="form-error" role="alert">
                Excluir este cartão? Cartões com compras vinculadas não podem
                ser excluídos.
              </p>
            )}
            <div className="form-buttons">
              <button
                className="secondary-button"
                type="button"
                disabled={disabled}
                onClick={() => setForm(null)}
              >
                Cancelar
              </button>
              <button
                className="primary-button"
                disabled={disabled}
                type="submit"
              >
                {disabled ? "Salvando…" : "Salvar cartão"}
              </button>
            </div>
            {form?.card && (
              <button
                className="card-delete-button"
                type="button"
                disabled={disabled}
                onClick={() => void remove()}
              >
                <Trash2 size={16} />
                {deleting ? "Confirmar exclusão" : "Excluir cartão"}
              </button>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
