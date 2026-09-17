import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Gift,
  Home,
  Loader2,
  LogOut,
  MapPin,
  Pencil,
  ShieldCheck,
  Star,
  User,
  UtensilsCrossed,
  X,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Invoice } from "@/components/invoice";
import { SiteFooter } from "@/components/site-footer";
import { useIsAdmin, getCustomerSession, clearCustomerSession } from "@/lib/auth";
import { fetchAPI, apiClient } from "@/lib/db";
import { STATUS_LABEL, type Order } from "@/lib/types";
import { startRegistration } from "@simplewebauthn/browser";
import { formatDateTime, money } from "@/lib/format";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My profile — Maa Tara Sweets" },
      {
        name: "description",
        content: "View your loyalty points, order history and profile details.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(d: string | Date | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

function ProfilePage() {
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin, checking, user, hasMfaEnrolled } = useIsAdmin();

  const customerSession = getCustomerSession();

  // Redirect to login if not authenticated at all
  useEffect(() => {
    if (checking) return;
    if (!user && !customerSession) {
      navigate({ to: "/login", search: { redir: "/profile" }, replace: true });
    }
  }, [checking, user, customerSession, navigate]);

  if (checking) {
    return (
      <main className="grid min-h-[70vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  // Admin profile (JWT session takes priority)
  if (user && isAdmin) {
    return (
      <AdminProfile
        user={user}
        isSuperAdmin={isSuperAdmin}
        hasMfaEnrolled={hasMfaEnrolled}
      />
    );
  }

  // Customer profile (localStorage session)
  if (customerSession) {
    return <CustomerProfile session={customerSession} />;
  }

  return null;
}

// ─── Customer profile ─────────────────────────────────────────────────────────

function CustomerProfile({
  session,
}: {
  session: { phone: string; name: string; profileToken: string; exp: number };
}) {
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // Fetch full customer data from backend
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["customer-profile", session.phone],
    queryFn: async ({ signal }) => {
      const res = await fetchAPI<any>(
        `/customer-profile?phone=${encodeURIComponent(session.phone)}`,
        { signal },
      );
      return res as { customer: any; orders: Order[] };
    },
    retry: false,
    // refetchInterval: POLL_INTERVAL,
  });

  const customer = data?.customer;
  const orders = data?.orders ?? [];

  // Edit state
  const [form, setForm] = useState({ name: "", birthday: "", saved_address: "" });
  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name ?? "",
        birthday: customer.birthday
          ? new Date(customer.birthday).toISOString().slice(0, 10)
          : "",
        saved_address: customer.saved_address ?? "",
      });
    }
  }, [customer]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const payload = {
        phone: session.phone,
        name: form.name.trim() || undefined,
        birthday: form.birthday || undefined,
        saved_address: form.saved_address.trim() || undefined,
      };

      const res = await fetchAPI<any>("/customer-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return res;
    },
    onSuccess: () => {
      toast.success("Profile saved!");
      setEditing(false);
      void refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? e?.toString() ?? "Save failed"),
  });

  function handleSignOut() {
    clearCustomerSession();
    navigate({ to: "/login", replace: true });
    toast.success("Signed out");
  }

  if (isLoading) {
    return (
      <main className="grid min-h-[70vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const displayName = customer?.name ?? session.name ?? session.phone;

  return (
    <main className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header card */}
        <div className="glass animate-rise rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span
              className="grid size-16 shrink-0 place-items-center rounded-2xl text-xl font-bold text-primary-foreground"
              style={{ background: "var(--gradient-primary)" }}
            >
              {initials(displayName)}
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold">{displayName}</h1>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span>{session.phone}</span>
                {customer?.last_visit && (
                  <span className="ml-2">
                    • Last visit: {formatDate(customer.last_visit)}
                  </span>
                )}
              </p>
            </div>
          </div>
          <Button
            variant="glass"
            size="sm"
            className="rounded-full"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>

        {/* Loyalty stats */}
        {customer && (
          <div className="glass rounded-3xl p-6">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
              <Gift className="size-5 text-accent" /> Loyalty &amp; Stats
            </h2>
            <div className="grid gap-4 sm:grid-cols-4">
              <Stat
                label="Visits"
                value={String(customer.visits ?? 0)}
                icon={<Star className="size-4 text-accent" />}
              />
              <Stat
                label="Reward points"
                value={String(customer.reward_points ?? 0)}
                icon={<Gift className="size-4 text-accent" />}
              />
              <Stat
                label="Total spent"
                value={money(customer.total_spend ?? 0)}
                icon={<UtensilsCrossed className="size-4 text-accent" />}
              />
              <Stat
                label="Favourite item"
                value={customer.favourite_item ?? "—"}
                icon={<Star className="size-4 text-accent" />}
              />
            </div>
          </div>
        )}

        {/* Edit profile */}
        {customer && (
          <div className="glass rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <User className="size-5 text-accent" /> Profile details
              </h2>
              <Button
                variant="glass"
                size="sm"
                className="rounded-full"
                onClick={() => setEditing((v) => !v)}
              >
                {editing ? <X className="size-4" /> : <Pencil className="size-4" />}
                {editing ? "Cancel" : "Edit"}
              </Button>
            </div>

            {editing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveProfile.mutate();
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="profile-name">Name</Label>
                  <Input
                    id="profile-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Your name"
                    maxLength={80}
                  />
                </div>
                <div>
                  <Label htmlFor="profile-birthday">Birthday</Label>
                  <Input
                    id="profile-birthday"
                    type="date"
                    value={form.birthday}
                    onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="profile-address">Saved address</Label>
                  <Input
                    id="profile-address"
                    value={form.saved_address}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, saved_address: e.target.value }))
                    }
                    placeholder="Enter your address"
                    maxLength={200}
                  />
                </div>
                <Button
                  type="submit"
                  variant="hero"
                  className="rounded-full"
                  disabled={saveProfile.isPending}
                >
                  {saveProfile.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Save changes
                </Button>
              </form>
            ) : (
              <dl className="space-y-3 text-sm">
                <DetailRow
                  label="Name"
                  value={customer.name}
                  icon={<User className="size-4 text-muted-foreground" />}
                />
                <DetailRow
                  label="Birthday"
                  value={formatDate(customer.birthday) ?? "Not set"}
                  icon={<Calendar className="size-4 text-muted-foreground" />}
                />
                <DetailRow
                  label="Saved address"
                  value={customer.saved_address || "Not set"}
                  icon={<MapPin className="size-4 text-muted-foreground" />}
                />
              </dl>
            )}
          </div>
        )}

        {/* Order history */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">My orders</h2>
            <Link to="/my-orders" className="text-sm text-accent hover:underline">
              Search by phone →
            </Link>
          </div>

          {orders.length === 0 ? (
            <p className="glass rounded-3xl p-6 text-center text-sm text-muted-foreground">
              No orders found yet.{" "}
              <Link
                to="/menu"
                search={{ category: undefined }}
                className="text-accent underline"
              >
                Start your first order
              </Link>
              .
            </p>
          ) : (
            orders.slice(0, 10).map((order: any) => (
              <article key={order.id} className="glass rounded-3xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm">{order.order_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(order.created_at)} •{" "}
                      {order.table_number == null
                        ? "Takeaway"
                        : `Table ${order.table_number}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={order.status === "rejected" ? "destructive" : "glass"}
                    >
                      {STATUS_LABEL[order.status as keyof typeof STATUS_LABEL]}
                    </Badge>
                    <span className="font-display font-bold">{money(order.total)}</span>
                    <Button
                      variant="glass"
                      size="sm"
                      className="rounded-full"
                      onClick={() => setOpenId(openId === order.id ? null : order.id)}
                    >
                      {openId === order.id ? "Hide bill" : "View bill"}
                    </Button>
                  </div>
                </div>
                {openId === order.id && (
                  <div className="mt-4">
                    <Invoice order={order} settings={null} />
                  </div>
                )}
              </article>
            ))
          )}

          {orders.length > 10 && (
            <p className="text-center text-sm text-muted-foreground">
              Showing 10 of {orders.length} orders.{" "}
              <Link to="/my-orders" className="text-accent underline">
                View all
              </Link>
            </p>
          )}
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}

// ─── Admin profile ────────────────────────────────────────────────────────────

function AdminProfile({
  user,
  isSuperAdmin,
  hasMfaEnrolled,
}: {
  user: any;
  isSuperAdmin: boolean;
  hasMfaEnrolled: boolean;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function handleSignOut() {
    await qc.cancelQueries();
    try {
      await fetchAPI("/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    qc.clear();
    await qc.invalidateQueries({ queryKey: ["auth_me"] });
    navigate({ to: "/auth", replace: true });
    toast.success("Signed out");
  }

  const displayName = user.name ?? user.email;
  const roleLabel = isSuperAdmin ? "Superadmin" : "Admin";

  const [uploading, setUploading] = useState(false);
  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      await apiClient.post("/auth/me/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Profile picture updated!");
      qc.invalidateQueries({ queryKey: ["auth_me"] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setUploading(true);
    try {
      await apiClient.delete("/auth/me/avatar");
      toast.success("Profile picture removed!");
      qc.invalidateQueries({ queryKey: ["auth_me"] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to remove");
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="grid min-h-[80vh] place-items-center px-4 py-12">
      <div className="w-full max-w-md space-y-5 animate-rise">
        {/* Header card */}
        <div className="glass rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-2 shrink-0">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="size-16 rounded-2xl object-cover shadow-sm" />
              ) : (
                <span
                  className="grid size-16 place-items-center rounded-2xl text-xl font-bold text-primary-foreground shadow-sm"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <ShieldCheck className="size-7" />
                </span>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 rounded-full relative overflow-hidden" disabled={uploading}>
                  {uploading ? "..." : "Upload"}
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleUploadAvatar} disabled={uploading} />
                </Button>
                {user.avatarUrl && (
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 rounded-full text-destructive hover:bg-destructive/10" onClick={handleRemoveAvatar} disabled={uploading}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-bold">{displayName}</h1>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isSuperAdmin
                    ? "bg-[image:var(--gradient-primary)] text-primary-foreground"
                    : "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                    }`}
                >
                  {roleLabel}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Security */}
        <TotpSetup hasMfaEnrolled={hasMfaEnrolled} />

        {/* Passkeys */}
        <PasskeySetup />

        {/* Quick links */}
        <div className="glass rounded-3xl p-6 space-y-3">
          <h2 className="flex items-center gap-2 font-display text-base font-bold">
            Quick access
          </h2>
          <nav className="flex flex-col gap-2 text-sm">
            {(user.role === "ADMIN" || user.role === "SUPERADMIN") && <Link
              to="/admin"
              className="flex items-center gap-2 rounded-xl p-2 hover:bg-background/40 transition-colors text-muted-foreground hover:text-foreground"
            >
              <Home className="size-4" /> Admin dashboard
            </Link>}

            {(user.role === "ADMIN" || user.role === "SUPERADMIN") && <Link
              to="/admin/staff"
              className="flex items-center gap-2 rounded-xl p-2 hover:bg-background/40 transition-colors text-muted-foreground hover:text-foreground"
            >
              <ShieldCheck className="size-4" /> Staff management
            </Link>}
            {isSuperAdmin && (
              <Link
                to="/admin/settings"
                className="flex items-center gap-2 rounded-xl p-2 hover:bg-background/40 transition-colors text-muted-foreground hover:text-foreground"
              >
                <UtensilsCrossed className="size-4" /> System settings
              </Link>
            )}
          </nav>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full mx-auto mt-6">
          <Button variant="glass" className="w-full sm:w-1/2 rounded-full h-12" onClick={handleSignOut}>
            <LogOut className="size-4" />
            Sign out
          </Button>
          <Button variant="glass" className="w-full sm:w-1/2 rounded-full h-12 p-0" asChild>
            <Link to="/" className="w-full h-full flex items-center justify-center gap-2 rounded-full">
              <ArrowLeft className="size-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-1 font-display text-xl font-bold truncate">{value}</p>
    </div>
  );
}

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      {icon}
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-foreground">{value ?? "—"}</dd>
      </div>
    </div>
  );
}

function TotpSetup({ hasMfaEnrolled }: { hasMfaEnrolled: boolean }) {
  const [enabled, setEnabled] = useState(hasMfaEnrolled);
  const [setupData, setSetupData] = useState<{ qrCode: string; secret: string } | null>(
    null,
  );
  const [token, setToken] = useState("");
  const qc = useQueryClient();

  const enableMfa = async () => {
    try {
      const res = await fetchAPI<any>("/auth/totp/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setSetupData(res.data);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const verifyMfa = async () => {
    try {
      await fetchAPI("/auth/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      toast.success("Two-factor authentication enabled!");
      setSetupData(null);
      setEnabled(true);
      qc.invalidateQueries({ queryKey: ["auth_me"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const disableMfa = async () => {
    try {
      await fetchAPI("/auth/totp/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      toast.success("Two-factor authentication disabled.");
      setEnabled(false);
      setSetupData(null);
      qc.invalidateQueries({ queryKey: ["auth_me"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="glass rounded-3xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          Security
        </h2>
        <Switch
          checked={enabled || !!setupData}
          onCheckedChange={(v) => {
            if (v) enableMfa();
            else disableMfa();
          }}
        />
      </div>
      <div className="text-sm text-muted-foreground">
        Two-factor authentication (TOTP)
      </div>

      {setupData && !enabled && (
        <div className="mt-4 p-4 border border-border/50 rounded-xl space-y-4 bg-background/50">
          <p className="text-sm text-foreground">
            Scan this QR code with your authenticator app, or enter the setup key
            manually.
          </p>
          <div className="flex justify-center bg-white p-2 rounded-xl w-max mx-auto">
            <img src={setupData.qrCode} alt="TOTP QR Code" className="w-40 h-40" />
          </div>
          <div className="text-center font-mono text-xs bg-muted p-2 rounded break-all">
            {setupData.secret}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Enter 6-digit code"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              maxLength={6}
            />
            <Button variant="hero" onClick={verifyMfa}>
              Verify
            </Button>
            <Button
              variant="glass"
              onClick={() => {
                setSetupData(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PasskeySetup() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const { passkeyCount } = useIsAdmin();

  const registerPasskey = async () => {
    setLoading(true);
    try {
      // 1. Get options from server
      const { data: res } = await apiClient.post("/auth/webauthn/register/generate", {});

      // 2. Pass options to browser to create a passkey
      const attResp = await startRegistration(res.data);

      // 3. Send response back to server to verify
      await apiClient.post("/auth/webauthn/register/verify", attResp);

      toast.success("Passkey registered successfully!");
      qc.invalidateQueries({ queryKey: ["auth_me"] });
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || "Failed to register passkey";
      if (msg.includes("timed out or was not allowed") || msg.toLowerCase().includes("cancel")) {
        toast.error("Passkey setup was cancelled.");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const removePasskeys = async () => {
    try {
      await apiClient.delete("/auth/webauthn/passkeys");
      toast.success("Passkeys removed successfully!");
      qc.invalidateQueries({ queryKey: ["auth_me"] });
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || "Failed to remove passkeys");
    }
  };

  return (
    <div className="glass rounded-3xl p-6 space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          Passkeys
          {passkeyCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {passkeyCount} registered
            </Badge>
          )}
        </h2>
      </div>
      <div className="text-sm text-muted-foreground">
        Sign in securely using fingerprint, face recognition, or a hardware key.
      </div>
      <div className="flex items-center gap-4">
        <Button variant="hero" onClick={registerPasskey} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
          Register a Passkey
        </Button>
        {passkeyCount > 0 && (
          <Button variant="glass" onClick={removePasskeys} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
            Remove Passkeys
          </Button>
        )}
      </div>
    </div>
  );
}
