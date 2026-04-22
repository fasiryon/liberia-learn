import * as React from "react";

type CredentialDeliveryActionsProps = {
  userId: string;
  pin: string;
  phone?: string | null;
};

export function CredentialDeliveryActions({ userId, pin, phone }: CredentialDeliveryActionsProps) {
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);

  async function handleSendSms() {
    setSending(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/credentials/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not send SMS.");
        return;
      }
      setMessage(`SMS sent to ${data.phone}`);
    } catch {
      setError("Could not send SMS.");
    } finally {
      setSending(false);
    }
  }

  function handlePrint() {
    window.open(`/admin/credential-card?userId=${encodeURIComponent(userId)}&pin=${encodeURIComponent(pin)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={handleSendSms} disabled={sending} className="min-h-11 rounded-xl bg-[var(--ll-yellow)] px-4 py-3 text-sm font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-60">
          {sending ? "Sending..." : "Send SMS"}
        </button>
        <button type="button" onClick={handlePrint} className="min-h-11 rounded-xl border border-[var(--ll-border)] px-4 py-3 text-sm font-semibold text-[var(--ll-text)] hover:border-[var(--ll-border)]">
          Print Credential Card
        </button>
      </div>
      {!phone && !error && <p className="text-sm text-[var(--ll-yellow)]">No phone number on file. Use Print instead.</p>}
      {message && <p className="text-sm text-[var(--ll-yellow)]">{message}</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}

