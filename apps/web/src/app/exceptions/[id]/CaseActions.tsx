'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Check, ShieldCheck, Sparkles } from "lucide-react";
import { usePreferences } from "@/components/PreferencesProvider";
import {
  approveException,
  approveRestockException,
  approveWithoutTerms,
  dismissException,
  draftReasonAction,
  executeIssueInvoiceAction,
  executeRefundAction,
  executeRestockAction,
} from "./actions";

interface CaseActionsProps {
  orgId: string;
  exceptionId: string;
  orderId: string;
  status: string;
  code: string;
}

export function CaseActions({
  orgId,
  exceptionId,
  orderId,
  status,
  code,
}: CaseActionsProps) {
  const router = useRouter();
  const { t, locale } = usePreferences();
  const isRefund = code === "REFUND_MISSING";
  const isRestock = code === "RESTOCK_MISSING";
  const isInvoice = code === "INVOICE_MISSING";
  const hasAutomatedAction = isRefund || isRestock || isInvoice;
  const [isPending, startTransition] = useTransition();
  const [isDrafting, setIsDrafting] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonSource, setReasonSource] = useState<
    "human" | "ai-draft" | "ai-edited"
  >("human");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<
    "approve" | "execute" | null
  >(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!confirmation) return;
    confirmButtonRef.current?.focus();
    function handleDialogKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setConfirmation(null);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleDialogKey);
    return () => {
      window.removeEventListener("keydown", handleDialogKey);
      dialogTriggerRef.current?.focus();
    };
  }, [confirmation]);

  function openConfirmation(type: "approve" | "execute", trigger: HTMLElement) {
    dialogTriggerRef.current = trigger;
    setConfirmation(type);
  }

  function runAction(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(result.error);
        return;
      }
      setConfirmation(null);
      router.refresh();
    });
  }

  function confirmApprove() {
    if (isRefund)
      return approveException(
        orgId,
        exceptionId,
        reason,
        amount,
        currency,
        reasonSource,
      );
    if (isRestock)
      return approveRestockException(
        orgId,
        exceptionId,
        reason,
        quantity,
        reasonSource,
      );
    return approveWithoutTerms(orgId, exceptionId, reason, reasonSource);
  }

  function confirmExecute() {
    if (isRefund) return executeRefundAction(orgId, exceptionId);
    if (isInvoice) return executeIssueInvoiceAction(orgId, exceptionId);
    return executeRestockAction(orgId, exceptionId);
  }

  // Drafts text only — the operator still reviews/edits the field before submitting.
  async function suggestReason() {
    setIsDrafting(true);
    setError(null);
    const result = await draftReasonAction(
      orgId,
      exceptionId,
      "approve",
      locale,
    );
    setIsDrafting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.draft) {
      setReason(result.draft);
      setReasonSource("ai-draft");
    }
  }

  if (status === "resolved" || status === "dismissed") {
    return (
      <section className="decision-panel">
        <ShieldCheck aria-hidden="true" />
        <h2>{t("actions.completed")}</h2>
        <p>
          {t("actions.completedDescription", {
            state:
              status === "resolved"
                ? t("actions.state.resolved")
                : t("actions.state.dismissed"),
          })}
        </p>
      </section>
    );
  }

  const approveDisabled =
    isPending ||
    reason.trim().length === 0 ||
    (isRefund && (amount.length === 0 || !/^[A-Z]{3}$/.test(currency))) ||
    (isRestock && quantity.length === 0);

  return (
    <section className="decision-panel" aria-labelledby="decision-title">
      <p className="eyebrow">{t("actions.eyebrow")}</p>
      <h2 id="decision-title">
        {status === "approved"
          ? t("actions.executeTitle")
          : t("actions.reviewTitle")}
      </h2>
      <p className="decision-intro">
        {status === "approved"
          ? t("actions.executeIntro")
          : t("actions.reviewIntro")}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {status === "open" && isRefund && (
        <div className="decision-fields">
          <label className="field">
            {t("actions.amount")}
            <input
              required
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label className="field currency-field">
            {t("actions.currency")}
            <input
              required
              type="text"
              maxLength={3}
              value={currency}
              onChange={(event) =>
                setCurrency(event.target.value.toUpperCase())
              }
              placeholder="EUR"
            />
          </label>
        </div>
      )}

      {status === "open" && isRestock && (
        <div className="decision-fields">
          <label className="field">
            {t("actions.quantity")}
            <input
              required
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
        </div>
      )}

      <div className="decision-reason">
        <label className="field">
          {t("actions.reason")}
          <input
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonSource((previous) =>
                previous === "human" ? "human" : "ai-edited",
              );
            }}
            placeholder={t("actions.reasonPlaceholder")}
          />
        </label>
        {status === "open" && (
          <button
            type="button"
            className="button button-secondary"
            disabled={isDrafting}
            onClick={suggestReason}
          >
            <Sparkles size={15} aria-hidden="true" />{" "}
            {isDrafting ? t("common.processing") : t("actions.suggestReason")}
          </button>
        )}
      </div>
      <div className="decision-actions">
        {status === "open" ? (
          <button
            type="button"
            disabled={approveDisabled}
            onClick={(event) =>
              openConfirmation("approve", event.currentTarget)
            }
            className="button"
          >
            <Check size={17} aria-hidden="true" /> {t("actions.approve")}
          </button>
        ) : hasAutomatedAction ? (
          <button
            type="button"
            disabled={isPending}
            onClick={(event) =>
              openConfirmation("execute", event.currentTarget)
            }
            className="button"
          >
            <ShieldCheck size={17} aria-hidden="true" />{" "}
            {isRefund
              ? t("actions.confirmRefund")
              : isRestock
                ? t("actions.confirmRestock")
                : t("actions.confirmIssueInvoice")}
          </button>
        ) : null}
        <button
          type="button"
          disabled={isPending || reason.trim().length === 0}
          onClick={() =>
            runAction(() =>
              dismissException(orgId, exceptionId, reason, reasonSource),
            )
          }
          className="button button-secondary"
        >
          <Archive size={17} aria-hidden="true" /> {t("actions.dismiss")}
        </button>
      </div>

      {status === "approved" && !hasAutomatedAction && (
        <p className="decision-intro">
          {t("actions.noActionAvailableDescription")}
        </p>
      )}

      {confirmation ? (
        <div className="dialog-backdrop">
          <div
            ref={dialogRef}
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-description"
          >
            <span className="dialog-icon">
              <ShieldCheck size={22} aria-hidden="true" />
            </span>
            <h3 id="confirm-title">
              {confirmation === "approve"
                ? t("actions.confirmApprovalTitle")
                : isRefund
                  ? t("actions.confirmRefundTitle")
                  : isRestock
                    ? t("actions.confirmRestockTitle")
                    : t("actions.confirmIssueInvoiceTitle")}
            </h3>
            <p id="confirm-description">
              {confirmation === "approve"
                ? isRefund
                  ? t("actions.confirmApprovalDescription", {
                      amount,
                      currency,
                      orderId,
                    })
                  : isRestock
                    ? t("actions.confirmRestockApprovalDescription", {
                        quantity,
                        orderId,
                      })
                    : t("actions.confirmApprovalDescription", {
                        amount: "",
                        currency: "",
                        orderId,
                      })
                : isRefund
                  ? t("actions.confirmRefundDescription", { orderId })
                  : isRestock
                    ? t("actions.confirmRestockDescription", { orderId })
                    : t("actions.confirmIssueInvoiceDescription", { orderId })}
            </p>
            <dl>
              <div>
                <dt>{t("actions.reasonSummary")}</dt>
                <dd>{reason || t("actions.previousReason")}</dd>
              </div>
            </dl>
            <div className="dialog-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setConfirmation(null)}
              >
                {t("common.cancel")}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                className="button"
                disabled={isPending}
                onClick={() =>
                  runAction(() =>
                    confirmation === "approve"
                      ? confirmApprove()
                      : confirmExecute(),
                  )
                }
              >
                {isPending
                  ? t("common.processing")
                  : confirmation === "approve"
                    ? t("actions.yesApprove")
                    : t("actions.yesExecute")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
