"use client";

import { useState, useEffect } from "react";

type Invite = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};

export default function AdminInvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"TEACHER" | "ADMIN">("TEACHER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchInvites = async () => {
    const res = await fetch("/api/admin/invites");
    if (res.ok) {
      const data = await res.json();
      setInvites(data.invites ?? []);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to create invite");
      return;
    }

    setSuccess(`Invite created for ${email}. Token: ${data.token}`);
    setEmail("");
    await fetchInvites();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-semibold">Google SSO Invites</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create an invite for a teacher before they sign in with Google. The invite is
          matched by email address and valid for 7 days.
        </p>
      </div>

      <form onSubmit={handleCreate} className="space-y-4 rounded-lg border p-4">
        <div>
          <label className="block text-sm font-medium">Teacher email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teacher@school.lr"
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "TEACHER" | "ADMIN")}
            className="mt-1 rounded border px-3 py-2 text-sm"
          >
            <option value="TEACHER">Teacher</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && (
          <p className="rounded bg-green-50 p-2 text-sm text-green-700 font-mono break-all">
            {success}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create invite"}
        </button>
      </form>

      <div>
        <h2 className="text-base font-semibold">Active invites</h2>
        {invites.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">No active invites.</p>
        ) : (
          <table className="mt-2 w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="pb-1">Email</th>
                <th className="pb-1">Role</th>
                <th className="pb-1">Status</th>
                <th className="pb-1">Expires</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0">
                  <td className="py-1.5">{inv.email}</td>
                  <td className="py-1.5">{inv.role}</td>
                  <td className="py-1.5">
                    {inv.usedAt ? (
                      <span className="text-green-600">Used</span>
                    ) : (
                      <span className="text-yellow-600">Pending</span>
                    )}
                  </td>
                  <td className="py-1.5 text-gray-400">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
