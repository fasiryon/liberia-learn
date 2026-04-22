"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CredentialDeliveryActions } from "@/components/CredentialDeliveryActions";
import { AdminNav } from "@/components/admin/AdminNav";

type TeacherRow = {
  id: string;
  name: string;
  email: string | null;
  loginId: string | null;
  phone: string | null;
  contact: string | null;
  classes: Array<{ id: string; name: string; subject: string }>;
  subjectSpecialty: string | null;
  status: "ACTIVE" | "INACTIVE";
};

type CredentialState = {
  userId: string;
  loginId: string | null;
  tempPin: string;
  phone: string | null;
};

const emptyForm = {
  firstName: "",
  lastName: "",
  contact: "",
  subjectSpecialty: "",
};

export function AdminTeachersManager() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"add" | "edit" | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherRow | null>(null);
  const [credentials, setCredentials] = useState<CredentialState | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch("/api/admin/teachers", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Unable to load teachers.");
        return data.teachers ?? [];
      })
      .then((rows) => {
        if (active) setTeachers(rows);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredTeachers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return teachers;
    return teachers.filter((teacher) =>
      [
        teacher.name,
        teacher.email ?? "",
        teacher.phone ?? "",
        teacher.subjectSpecialty ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [search, teachers]);

  function openAddForm() {
    setMode("add");
    setSelectedTeacher(null);
    setForm(emptyForm);
    setCredentials(null);
    setError(null);
  }

  function openEditForm(teacher: TeacherRow) {
    setMode("edit");
    setSelectedTeacher(teacher);
    setForm({
      firstName: teacher.name.split(" ").slice(0, -1).join(" ") || teacher.name,
      lastName: teacher.name.split(" ").slice(-1).join(" "),
      contact: teacher.phone ?? teacher.email ?? "",
      subjectSpecialty: teacher.subjectSpecialty ?? "",
    });
    setCredentials(null);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const fullName = `${form.firstName} ${form.lastName}`.trim();
    if (!fullName || !form.contact.trim()) {
      setError("First name, last name, and email or phone are required.");
      return;
    }

    setSaving(true);
    setError(null);
    setCredentials(null);

    try {
      const isPhone = form.contact.includes("+") || /\d{7,}/.test(form.contact);
      const payload =
        mode === "edit" && selectedTeacher
          ? {
              id: selectedTeacher.id,
              action: "edit",
              fullName,
              email: isPhone ? "" : form.contact.trim(),
              phone: isPhone ? form.contact.trim() : "",
              subjectSpecialty: form.subjectSpecialty.trim(),
            }
          : {
              fullName,
              email: isPhone ? undefined : form.contact.trim(),
              phone: isPhone ? form.contact.trim() : undefined,
              subjectSpecialty: form.subjectSpecialty.trim() || undefined,
            };

      const res = await fetch("/api/admin/teachers", {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to save teacher.");

      if (mode === "edit" && selectedTeacher) {
        setTeachers((current) =>
          current.map((teacher) =>
            teacher.id === selectedTeacher.id
              ? {
                  ...teacher,
                  name: fullName,
                  email: isPhone ? teacher.email : form.contact.trim(),
                  phone: isPhone ? form.contact.trim() : teacher.phone,
                  contact: form.contact.trim(),
                  subjectSpecialty: form.subjectSpecialty.trim() || null,
                  status: "ACTIVE",
                }
              : teacher
          )
        );
      } else {
        const contact = isPhone ? data.phone ?? form.contact.trim() : data.teacher.email ?? form.contact.trim();
        setTeachers((current) => [
          {
            id: data.userId,
            name: fullName,
            email: isPhone ? data.teacher.email ?? null : form.contact.trim(),
            loginId: data.loginId ?? null,
            phone: data.phone ?? null,
            contact,
            classes: [],
            subjectSpecialty: form.subjectSpecialty.trim() || null,
            status: "ACTIVE",
          },
          ...current,
        ]);
        setCredentials({
          userId: data.userId,
          loginId: data.loginId ?? null,
          tempPin: data.tempPin,
          phone: data.phone ?? null,
        });
      }

      setMode(null);
      setSelectedTeacher(null);
      setForm(emptyForm);
    } catch (err: any) {
      setError(err.message ?? "Unable to save teacher.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(teacher: TeacherRow) {
    if (!confirm(`Deactivate ${teacher.name}?`)) return;
    const res = await fetch("/api/admin/teachers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: teacher.id, action: "deactivate" }),
    });
    if (!res.ok) {
      setError("Unable to deactivate teacher.");
      return;
    }
    setTeachers((current) =>
      current.map((row) => (row.id === teacher.id ? { ...row, status: "INACTIVE" } : row))
    );
  }

  async function handleResendInvite(teacher: TeacherRow) {
    setError(null);
    const res = await fetch("/api/admin/teachers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: teacher.id,
        action: "resendInvite",
        subjectSpecialty: teacher.subjectSpecialty ?? "",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Unable to resend invite.");
      return;
    }
    setCredentials({
      userId: data.userId,
      loginId: data.loginId ?? teacher.loginId,
      tempPin: data.tempPin,
      phone: data.phone ?? teacher.phone,
    });
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin" className="text-xs text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
              Back to Admin Console
            </Link>
            <h1 className="mt-2 text-2xl font-bold">Teachers</h1>
            <p className="text-sm text-[var(--ll-text-muted)]">
              Manage teachers, resend credentials, and track roster status.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddForm}
            className="rounded-xl bg-[var(--ll-yellow)] px-5 py-3 text-sm font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)]"
          >
            Add Teacher
          </button>
        </header>

        <AdminNav />

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, phone, email, or specialty"
            className="min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]"
          />
        </section>

        {mode ? (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
            <h2 className="text-lg font-semibold">
              {mode === "add" ? "Add Teacher" : `Edit ${selectedTeacher?.name ?? "Teacher"}`}
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs text-[var(--ll-text-muted)]">First Name</label>
                <input
                  value={form.firstName}
                  onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--ll-text-muted)]">Last Name</label>
                <input
                  value={form.lastName}
                  onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--ll-text-muted)]">Email or Phone</label>
                <input
                  value={form.contact}
                  onChange={(event) => setForm((current) => ({ ...current, contact: event.target.value }))}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--ll-text-muted)]">Subject Specialty</label>
                <input
                  value={form.subjectSpecialty}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, subjectSpecialty: event.target.value }))
                  }
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]"
                />
              </div>
              <div className="md:col-span-2 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[var(--ll-yellow)] px-5 py-3 text-sm font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-60"
                >
                  {saving ? "Saving..." : mode === "add" ? "Create Teacher" : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  className="rounded-xl border border-[var(--ll-border)] px-5 py-3 text-sm font-semibold text-[var(--ll-text)]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {credentials ? (
          <section className="rounded-xl border border-emerald-500/30 bg-[var(--ll-yellow)]/10 p-6">
            <h2 className="text-xl font-semibold text-[var(--ll-yellow)]">Credential delivery</h2>
            <p className="mt-2 text-sm text-[var(--ll-text)]">
              Teacher ID: <span className="font-semibold text-[var(--ll-text)]">{credentials.loginId ?? "Pending"}</span>
            </p>
            <p className="mt-1 text-sm text-[var(--ll-text)]">
              Temporary PIN: <span className="font-semibold text-[var(--ll-text)]">{credentials.tempPin}</span>
            </p>
            <div className="mt-4">
              <CredentialDeliveryActions
                userId={credentials.userId}
                pin={credentials.tempPin}
                phone={credentials.phone}
              />
            </div>
          </section>
        ) : null}

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-xl bg-[var(--ll-surface)]/60" />
              ))}
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="rounded-xl border border-[var(--ll-border)] bg-black/10 p-8 text-center text-sm text-[var(--ll-text-muted)]">
              No teachers yet. Add your first teacher to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--ll-border)] text-left text-xs text-[var(--ll-text-faint)]">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email/Phone</th>
                    <th className="px-4 py-3">Classes</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeachers.map((teacher) => (
                    <tr key={teacher.id} className="border-b border-white/5 text-[var(--ll-text)]">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{teacher.name}</p>
                        <p className="text-xs text-[var(--ll-text-faint)]">{teacher.subjectSpecialty ?? "General educator"}</p>
                      </td>
                      <td className="px-4 py-3">{teacher.contact ?? teacher.email ?? teacher.phone ?? "-"}</td>
                      <td className="px-4 py-3">
                        {teacher.classes.length === 0
                          ? "-"
                          : teacher.classes.map((item) => item.name).join(", ")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            teacher.status === "ACTIVE"
                              ? "bg-[var(--ll-yellow)]/20 text-[var(--ll-yellow)]"
                              : "bg-[var(--ll-surface-muted)] text-[var(--ll-text)]"
                          }`}
                        >
                          {teacher.status === "ACTIVE" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleResendInvite(teacher)}
                            className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-[11px] font-semibold text-[var(--ll-text)]"
                          >
                            Resend Invite
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditForm(teacher)}
                            className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-[11px] font-semibold text-[var(--ll-text)]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeactivate(teacher)}
                            className="rounded-full border border-red-500/30 px-3 py-1 text-[11px] font-semibold text-red-300"
                          >
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
