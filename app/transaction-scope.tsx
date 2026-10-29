"use client";

import {
  transactionTargets,
  type TransactionScope,
} from "@/lib/transaction-batch";
import type { Transaction } from "@/lib/finance";

export default function TransactionScopeControl({
  anchor,
  rows,
  scope,
  onChange,
  action,
  disabled,
}: {
  anchor: Transaction;
  rows: Transaction[];
  scope: TransactionScope;
  onChange: (scope: TransactionScope) => void;
  action: "edit" | "delete";
  disabled: boolean;
}) {
  if (anchor.installments <= 1 || !anchor.groupId)
    return anchor.installments > 1 ? (
      <p className="form-note">
        Este lançamento antigo pode ser alterado individualmente.
      </p>
    ) : null;
  const selected = transactionTargets(rows, anchor.id, scope);
  const paid = selected.filter((row) => row.status === "paid").length;
  return (
    <div className="transaction-scope" data-operation-scope={action}>
      <label>
        {action === "edit" ? "Aplicar edição a" : "Excluir"}
        <select
          value={scope}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value as TransactionScope)}
        >
          <option value="single">Somente esta parcela</option>
          <option value="following">Esta e as próximas parcelas</option>
          <option value="all">Toda a compra</option>
        </select>
      </label>
      <p className="form-note" aria-live="polite">
        {selected.length}{" "}
        {selected.length === 1
          ? "parcela selecionada"
          : "parcelas selecionadas"}
        {paid ? ` · ${paid} já ${paid === 1 ? "paga" : "pagas"}` : ""}.
      </p>
      {scope !== "single" && action === "edit" && (
        <p className="form-note">
          Somente os campos editados serão aplicados às parcelas selecionadas.
          Os demais valores, situações e vencimentos individuais serão mantidos.
        </p>
      )}
      {scope !== "single" && action === "delete" && (
        <p className="form-note">
          A exclusão remove as parcelas selecionadas e atualiza os totais de
          todos os meses afetados.
        </p>
      )}
    </div>
  );
}
