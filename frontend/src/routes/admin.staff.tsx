import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PlusCircle,
  Pencil,
  Trash2,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  UserX,
  X,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { staffQuery, fetchAPI } from "@/lib/db";
import { useIsAdmin } from "@/lib/auth";
import type { StaffUser } from "@/lib/types";
import type { UserRole } from "@/lib/auth";

export const Route = createFileRoute("/admin/staff")({
  component: StaffManager,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roleBadge(role: string) {
  if (role === "SUPERADMIN") return <Badge variant="gold">SUPERADMIN</Badge>;
  if (role === "ADMIN") return <Badge variant="default">ADMIN</Badge>;
  return <Badge variant="glass">USER</Badge>;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type ModalMode =
  | { type: "create" }
  | { type: "edit"; user: StaffUser }
  | { type: "role"; user: StaffUser }
  | null;

interface ModalProps {
  mode: ModalMode;
  callerRole: UserRole;
  onClose: () => void;
}

function UserModal({ mode, callerRole, onClose }: ModalProps) {
  const qc = useQueryClient();

  // Form fields
  const [name, setName] = useState(mode?.type === "edit" ? (mode.user.name ?? "") : "");
  const [email, setEmail] = useState(mode?.type === "edit" ? mode.user.email : "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>(
    mode?.type === "create" ? "ADMIN" : mode?.type === "role" ? mode.user.role : "ADMIN",
  );
  const [isActive, setIsActive] = useState(
    mode?.type === "edit" ? mode.user.isActive : true,
  );
  const [loading, setLoading] = useState(false);

  const availableRoles: UserRole[] =
    callerRole === "SUPERADMIN" ? ["ADMIN", "SUPERADMIN"] : ["ADMIN"];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      if (mode?.type === "create") {
        await fetchAPI<any>("/data/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name || undefined, email: cleanEmail, password, role }),
        });
        toast.success("User created successfully");
      } else if (mode?.type === "edit") {
        await fetchAPI<any>(`/data/users/${mode.user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name || undefined, email: cleanEmail, isActive }),
        });
        toast.success("User updated");
      } else if (mode?.type === "role") {
        await fetchAPI<any>(`/data/users/${mode.user.id}/role`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        });
        toast.success("Role updated");
      }
      void qc.invalidateQueries({ queryKey: ["staff"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const title =
    mode?.type === "create"
      ? "Add new user"
      : mode?.type === "edit"
        ? `Edit — ${mode.user.name ?? mode.user.email}`
        : `Change role — ${mode?.user.name ?? mode?.user.email}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="glass-strong relative w-full max-w-md rounded-3xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="size-5" />
        </button>
        <h3 className="mb-5 font-display text-lg font-bold">{title}</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name — shown for create and edit */}
          {(mode?.type === "create" || mode?.type === "edit") && (
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Name (optional)</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </label>
          )}

          {/* Email — shown for create and edit */}
          {(mode?.type === "create" || mode?.type === "edit") && (
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Email *</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="user@example.com"
                className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </label>
          )}

          {/* Password — only on create */}
          {mode?.type === "create" && (
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Password *</span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  className="w-full rounded-xl border border-border bg-transparent px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </label>
          )}

          {/* Role — shown for create and role-change */}
          {(mode?.type === "create" || mode?.type === "role") && (
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              >
                {availableRoles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* isActive toggle — only on edit */}
          {mode?.type === "edit" && (
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border px-3 py-2">
              <span className="text-sm">Active account</span>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="size-4 accent-primary"
              />
            </label>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Save"}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function StaffManager() {
  const { data: staff = [], isLoading } = useQuery(staffQuery);
  const { isSuperAdmin, role: callerRole, user: me } = useIsAdmin();
  const qc = useQueryClient();
  const [modal, setModal] = useState<ModalMode>(null);

  // ── Delete mutation ──
  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchAPI<any>(`/data/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("User deleted");
      void qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Quick-toggle isActive ──
  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetchAPI<any>(`/data/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => {
      toast.success("Status updated");
      void qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function canModify(target: StaffUser) {
    if (!me) return false;
    if (target.id === me.id) return false; // can't act on yourself here
    if (isSuperAdmin) return target.email !== "nishanrajak01@gmail.com";
    // Admin can only act on USERs
    return target.role === "USER";
  }

  function canChangeRole(target: StaffUser) {
    if (!me) return false;
    if (target.id === me.id) return false;
    if (isSuperAdmin) return target.email !== "nishanrajak01@gmail.com";
    // Admin can promote USER→ADMIN but cannot touch ADMIN/SUPERADMIN
    return target.role === "USER";
  }

  const groups = [
    { label: "Superadmins", filter: (u: StaffUser) => u.role === "SUPERADMIN" },
    { label: "Admins", filter: (u: StaffUser) => u.role === "ADMIN" },
    { label: "Users (customers)", filter: (u: StaffUser) => u.role === "USER" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Staff &amp; User Management</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isSuperAdmin
              ? "You can manage all roles including Superadmin"
              : "You can manage Users and promote them to Admin"}
          </p>
        </div>
        <Button size="sm" onClick={() => setModal({ type: "create" })} className="gap-2">
          <PlusCircle className="size-4" />
          Add user
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Grouped tables */}
      {!isLoading &&
        groups.map(({ label, filter }) => {
          const rows = staff.filter(filter);
          if (rows.length === 0) return null;
          return (
            <section key={label} className="space-y-3">
              <h3 className="font-display text-base font-semibold text-muted-foreground uppercase tracking-widest">
                {label} ({rows.length})
              </h3>
              <div className="glass overflow-x-auto rounded-3xl">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Joined</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((u) => {
                      const isSelf = u.id === me?.id;
                      const modifiable = canModify(u);
                      const roleChangeable = canChangeRole(u);
                      return (
                        <tr
                          key={u.id}
                          className="border-t border-border/60 transition-colors hover:bg-white/[0.02]"
                        >
                          <td className="px-4 py-3 font-medium">
                            {u.name ?? <span className="text-muted-foreground">—</span>}
                            {isSelf && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                (you)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-3">{roleBadge(u.role)}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={u.isActive ? "default" : "destructive"}>
                              {u.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {new Date(u.createdAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {/* Edit name/email/status */}
                              {modifiable && (
                                <Button
                                  size="icon"
                                  variant="glass"
                                  className="size-7"
                                  title="Edit user"
                                  onClick={() => setModal({ type: "edit", user: u })}
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                              )}

                              {/* Change role */}
                              {roleChangeable && (
                                <Button
                                  size="icon"
                                  variant="glass"
                                  className="size-7"
                                  title="Change role"
                                  onClick={() => setModal({ type: "role", user: u })}
                                >
                                  <ShieldCheck className="size-3.5" />
                                </Button>
                              )}

                              {/* Toggle active */}
                              {modifiable && (
                                <Button
                                  size="icon"
                                  variant="glass"
                                  className="size-7"
                                  title={u.isActive ? "Deactivate" : "Activate"}
                                  onClick={() =>
                                    toggleActive.mutate({
                                      id: u.id,
                                      isActive: !u.isActive,
                                    })
                                  }
                                >
                                  {u.isActive ? (
                                    <UserX className="size-3.5 text-amber-400" />
                                  ) : (
                                    <UserCheck className="size-3.5 text-emerald-400" />
                                  )}
                                </Button>
                              )}

                              {/* Delete */}
                              {modifiable && (
                                <Button
                                  size="icon"
                                  variant="glass"
                                  className="size-7"
                                  title="Delete user"
                                  onClick={() => {
                                    toast.error(`Delete ${u.name ?? u.email}?`, {
                                      description: "This cannot be undone.",
                                      action: {
                                        label: "Delete",
                                        onClick: () => deleteMutation.mutate(u.id),
                                      },
                                    });
                                  }}
                                >
                                  <Trash2 className="size-3.5 text-destructive" />
                                </Button>
                              )}

                              {/* Promote shortcut: USER → ADMIN (Admin-only quick action) */}
                              {!isSuperAdmin && u.role === "USER" && !isSelf && (
                                <Button
                                  size="sm"
                                  variant="glass"
                                  className="h-7 px-2 text-xs"
                                  title="Promote to Admin"
                                  onClick={() => setModal({ type: "role", user: u })}
                                >
                                  Make Admin
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

      {!isLoading && staff.length === 0 && (
        <div className="glass rounded-3xl p-12 text-center text-muted-foreground">
          No users found. Click <strong>Add user</strong> to create one.
        </div>
      )}

      {/* Modal */}
      {modal && callerRole && (
        <UserModal mode={modal} callerRole={callerRole} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
