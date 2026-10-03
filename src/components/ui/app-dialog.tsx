"use client";

import { useEffect, useId, useRef } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CircleAlert,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AppDialogVariant =
  | "info"
  | "warning"
  | "success"
  | "error"
  | "confirm"
  | "destructive";

const presentation = {
  info: { Icon: Info, icon: "border-sky-300/20 bg-sky-300/10 text-sky-200", edge: "via-sky-300/70" },
  warning: { Icon: TriangleAlert, icon: "border-[#e6b95c]/25 bg-[#e6b95c]/10 text-[#f3ce7c]", edge: "via-[#e6b95c]/80" },
  success: { Icon: CheckCircle2, icon: "border-[#0fc9a7]/25 bg-[#0fc9a7]/10 text-[#72ead4]", edge: "via-[#0fc9a7]/80" },
  error: { Icon: AlertCircle, icon: "border-red-400/25 bg-red-400/10 text-red-200", edge: "via-red-400/75" },
  confirm: { Icon: CircleAlert, icon: "border-[#0fc9a7]/25 bg-[#0fc9a7]/10 text-[#72ead4]", edge: "via-[#0fc9a7]/80" },
  destructive: { Icon: TriangleAlert, icon: "border-red-400/25 bg-red-400/10 text-red-200", edge: "via-red-400/75" },
} satisfies Record<AppDialogVariant, { Icon: typeof Info; icon: string; edge: string }>;

type AppDialogProps = {
  open: boolean;
  variant?: AppDialogVariant;
  title: string;
  description?: string;
  actionLabel: string;
  cancelLabel?: string;
  closeLabel: string;
  busy?: boolean;
  direction?: "rtl" | "ltr";
  onAction: () => void | Promise<void>;
  onClose: () => void;
};

export function AppDialog({
  open,
  variant = "info",
  title,
  description,
  actionLabel,
  cancelLabel,
  closeLabel,
  busy = false,
  direction = "ltr",
  onAction,
  onClose,
}: AppDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const { Icon, icon, edge } = presentation[variant];
  const destructive = variant === "destructive";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      window.requestAnimationFrame(() => (cancelRef.current ?? actionRef.current)?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      role={variant === "info" || variant === "success" ? "dialog" : "alertdialog"}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      dir={direction}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;

        const focusable = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;

        if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === document.body)) {
          event.preventDefault();
          first.focus();
        }
      }}
      onClose={() => {
        if (open) onClose();
        returnFocusRef.current?.focus();
        returnFocusRef.current = null;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0b1118]/95 p-0 text-[#f0f4f8] shadow-[0_28px_90px_rgba(0,0,0,.58),inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-2xl open:animate-[isaudi-dialog-in_.18s_ease-out] motion-reduce:open:animate-none [&::backdrop]:bg-[#020508]/75 [&::backdrop]:backdrop-blur-sm"
    >
      <div className={cn("h-px bg-gradient-to-r from-transparent to-transparent", edge)} />
      <div className="relative p-5 sm:p-6">
        <button
          type="button"
          aria-label={closeLabel}
          disabled={busy}
          onClick={close}
          className="isaudi-focus absolute end-4 top-4 grid h-11 w-11 place-items-center rounded-xl text-[#94a3b8] transition-colors hover:bg-white/[.06] hover:text-white disabled:opacity-45 motion-reduce:transition-none"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="pe-12">
          <span className={cn("grid h-12 w-12 place-items-center rounded-2xl border shadow-inner", icon)}>
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 id={titleId} className="mt-5 text-xl font-bold tracking-tight text-white">{title}</h2>
          {description && <p id={descriptionId} className="mt-2 text-sm leading-7 text-[#a4b0c0]">{description}</p>}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {cancelLabel && (
            <Button ref={cancelRef} type="button" variant="outline" disabled={busy} onClick={close} className="w-full sm:w-auto">
              {cancelLabel}
            </Button>
          )}
          <Button
            ref={actionRef}
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            aria-busy={busy}
            onClick={() => void onAction()}
            className={cn(
              "w-full sm:w-auto",
              !destructive && variant === "warning" && "bg-[#e6b95c] text-[#120d04] hover:bg-[#f3ce7c]",
              !destructive && variant === "error" && "bg-red-500 text-white hover:bg-red-500/90",
            )}
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
