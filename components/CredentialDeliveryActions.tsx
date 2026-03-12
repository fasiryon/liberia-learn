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
        <button type="button" onClick={handleSendSms} disabled={sending} className="min-h-11 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60">
          {sending ? "Sending..." : "Send SMS"}
        </button>
        <button type="button" onClick={handlePrint} className="min-h-11 rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-100 hover:border-slate-400">
          Print Credential Card
        </button>
      </div>
      {!phone && !error && <p className="text-sm text-amber-300">No phone number on file. Use Print instead.</p>}
      {message && <p className="text-sm text-emerald-300">{message}</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}

