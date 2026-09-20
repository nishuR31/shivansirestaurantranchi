import { useEffect, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAppConfig,
  getOwnerSettings,
  saveAppConfig,
  saveOwnerSettings,
  enableLockdown,
  disableLockdown,
} from "@/lib/config.functions";
import { useIsAdmin } from "@/lib/auth";
import { PageLoader } from "@/components/page-loader";
import { settingsQuery } from "@/lib/db";
import { Lock, Unlock, ShieldAlert, ShieldCheck, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsManager,
});

const FIELDS: Array<{ key: string; label: string; type?: string }> = [
  { key: "name", label: "Restaurant name" },
  { key: "tagline", label: "Tagline" },
  { key: "address", label: "Address" },
  { key: "phone", label: "Phone" },
  { key: "gst_number", label: "GST number" },
  { key: "upi_id", label: "UPI ID" },
  { key: "opening_time", label: "Opening time" },
  { key: "closing_time", label: "Closing time" },
  { key: "tax_percent", label: "GST %", type: "number" },
  { key: "packing_charge", label: "Packing charge", type: "number" },
  { key: "delivery_charge", label: "Delivery charge", type: "number" },
  { key: "currency", label: "Currency symbol" },
];

function SettingsManager() {
  const qc = useQueryClient();
  const { isSuperAdmin } = useIsAdmin();
  const { data: settings } = useQuery({
    queryKey: ["owner-settings"],
    queryFn: ({ signal }) => getOwnerSettings({ signal }),
  });
  const [form, setForm] = useState<Record<string, unknown>>({});
  const isLoadingSettings = settings === undefined && !form["id"]; // naive check

  const save = useMutation({
    mutationFn: async () => {
      const data = Object.fromEntries(
        FIELDS.map((f) => [
          f.key,
          f.type === "number" ? Number(form[f.key] ?? 0) : String(form[f.key] ?? ""),
        ]),
      ) as any;
      if (form["id"]) data.id = form["id"];

      return saveOwnerSettings(data);
    },
    onSuccess: () => {
      toast.success("Settings saved");
      void qc.invalidateQueries({ queryKey: ["owner-settings"] });
      void qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: any) =>
      toast.error(e?.message ?? e?.toString() ?? "Could not save settings"),

  });

  const { data: config } = useQuery({
    queryKey: ["app-config"],
    queryFn: ({ signal }) => getAppConfig({ signal }),
  });
  const [cfg, setCfg] = useState({
    ownerEmail: "",
    whatsappPhoneNumberId: "",
    whatsappToken: "",
  });
  const isLoadingConfig = config === undefined && !cfg.ownerEmail;

  const saveConfig = useMutation({
    mutationFn: () => saveAppConfig(cfg),
    onSuccess: () => {
      toast.success("Owner & WhatsApp settings saved");
      setCfg((c) => ({ ...c, whatsappToken: "" }));
      void qc.invalidateQueries({ queryKey: ["app-config"] });
    },
    onError: (e: any) =>
      toast.error(e?.message ?? e?.toString() ?? "Could not save config"),
  });

  useEffect(() => {
    if (settings) setForm({ ...settings });
  }, [settings]);

  useEffect(() => {
    if (config)
      setCfg({
        ownerEmail: config.ownerEmail,
        whatsappPhoneNumberId: config.whatsappPhoneNumberId,
        whatsappToken: "",
      });
  }, [config]);

  if (!isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (isLoadingSettings || isLoadingConfig) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-xl font-bold">Restaurant settings</h2>
        <p className="text-sm text-muted-foreground">
          Everything here updates the customer-facing app instantly.
        </p>
      </header>

      <div className="glass grid gap-4 rounded-3xl p-6 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <Label htmlFor={field.key}>{field.label}</Label>
            <Input
              id={field.key}
              type={field.type ?? "text"}
              placeholder={`Enter ${field.label.toLowerCase()}`}
              value={String(form[field.key] ?? "")}
              onChange={(e) =>
                setForm({
                  ...form,
                  [field.key]:
                    field.type === "number" ? Number(e.target.value) : e.target.value,
                })
              }
            />
          </div>
        ))}

        <div className="sm:col-span-2 mt-2">
          <Button
            variant="hero"
            className="rounded-full"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            Save settings
          </Button>
        </div>
      </div>

      {/* ── Lockdown Control Panel ── */}
      <LockdownPanel />

      <div className="glass grid gap-4 rounded-3xl p-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h3 className="font-display text-lg font-bold">Location & Map View</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Verify your restaurant's location on Google Maps.
          </p>
          <div className="w-full h-[300px] overflow-hidden rounded-xl border border-border">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d14656.786566418934!2d85.253683!3d23.3639423!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39f4e04778be81bd%3A0xc3b8a36270b2011b!2sDaladali%20Chowk!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen={true}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        </div>
      </div>

      <div className="glass grid gap-4 rounded-3xl p-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h3 className="font-display text-lg font-bold">Owner & WhatsApp bot</h3>
          <p className="text-sm text-muted-foreground">
            Add your WhatsApp Cloud API credentials here — order updates start sending
            automatically once saved.
          </p>
          <div className="mt-2 text-xs text-muted-foreground bg-primary/5 border border-primary/20 p-3 rounded-xl">
            <strong className="text-foreground">How to get these?</strong><br />
            1. Go to the <a href="https://developers.facebook.com/" target="_blank" className="text-primary hover:underline font-medium">Meta for Developers</a> dashboard and create an app (Type: Business).<br />
            2. Add the WhatsApp product to your app.<br />
            3. In the WhatsApp Setup page, you will find the <strong>Phone number ID</strong> and a temporary <strong>Access Token</strong> (for permanent tokens, create a System User in Business Manager).
          </div>
        </div>
        <div>
          <Label htmlFor="ownerEmail">Owner email</Label>
          <Input
            id="ownerEmail"
            type="email"
            placeholder="Enter your email address"
            value={cfg.ownerEmail}
            onChange={(e) => setCfg({ ...cfg, ownerEmail: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="waPhoneId">WhatsApp phone number ID</Label>
          <Input
            id="waPhoneId"
            placeholder="Enter WhatsApp phone number ID"
            value={cfg.whatsappPhoneNumberId}
            onChange={(e) => setCfg({ ...cfg, whatsappPhoneNumberId: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="waToken">
            WhatsApp access token{" "}
            {config?.whatsappTokenSet ? "(saved — leave blank to keep)" : ""}
          </Label>
          <Input
            id="waToken"
            type="password"
            autoComplete="new-password"
            placeholder={config?.whatsappTokenSet ? "••••••••••••" : "EAAG..."}
            value={cfg.whatsappToken}
            onChange={(e) => setCfg({ ...cfg, whatsappToken: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Button
            variant="hero"
            className="rounded-full"
            disabled={saveConfig.isPending}
            onClick={() => saveConfig.mutate()}
          >
            Save owner & WhatsApp
          </Button>
        </div>
      </div>

      <div className="glass grid gap-4 rounded-3xl p-6 sm:grid-cols-2">
        <div className="sm:col-span-2 flex flex-col gap-2">
          <h3 className="font-display text-lg font-bold">System Maintenance</h3>
          <p className="text-sm text-muted-foreground mb-4">
            If the application is showing stale builds, encountering internal server errors during load, or
            experiencing caching issues, click the button below to clear all service workers,
            caches, and local storage.
          </p>
          <Button
            variant="destructive"
            className="w-fit"
            onClick={() => {
              toast.error("Are you sure you want to clear all app caches and reload?", {
                description: "This will clear local storage and refresh the page.",
                action: {
                  label: "Yes, Clear Cache",
                  onClick: () => {
                    const clearStorage = () => {
                      localStorage.removeItem("maatara-theme-v1");
                      localStorage.removeItem("maatara-cart-v1");
                    };
                    if ("caches" in window) {
                      void caches.keys().then((keys) => {
                        const appKeys = keys.filter(
                          (k) => k.includes("maatara") || k.includes("vite") || k.includes("workbox")
                        );
                        return Promise.all(appKeys.map((k) => caches.delete(k)));
                      }).then(() => {
                        clearStorage();
                        globalThis.location.reload();
                      });
                    } else {
                      clearStorage();
                      globalThis.location.reload();
                    }
                  }
                },
                cancel: {
                  label: "Cancel",
                  onClick: () => {}
                }
              });
            }}
          >
            Clear App Cache & Reload
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Lockdown Control Panel — password-protected, no governance
   ═══════════════════════════════════════════════════════════════ */

function LockdownPanel() {
  const qc = useQueryClient();
  const { data: publicSettings } = useQuery(settingsQuery);
  const isLocked = Boolean(publicSettings?.is_suspended);

  // Enable lockdown form state
  const [lockForm, setLockForm] = useState({
    shutdown_code: 503,
    shutdown_message: "",
    lockdown_password: "",
    confirm_password: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  // Disable lockdown form state
  const [unlockPassword, setUnlockPassword] = useState("");
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ["settings"] });
    void qc.invalidateQueries({ queryKey: ["owner-settings"] });
  };

  const lockMutation = useMutation({
    mutationFn: () => {
      if (lockForm.lockdown_password !== lockForm.confirm_password) {
        throw new Error("Passwords do not match");
      }
      if (lockForm.lockdown_password.length < 4) {
        throw new Error("Password must be at least 4 characters");
      }
      return enableLockdown({
        shutdown_code: lockForm.shutdown_code,
        shutdown_message: lockForm.shutdown_message,
        lockdown_password: lockForm.lockdown_password,
      });
    },
    onSuccess: () => {
      toast.success("🔒 Lockdown activated successfully");
      setLockForm({ shutdown_code: 503, shutdown_message: "", lockdown_password: "", confirm_password: "" });
      invalidateAll();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to activate lockdown"),
  });

  const unlockMutation = useMutation({
    mutationFn: () => disableLockdown({ lockdown_password: unlockPassword }),
    onSuccess: () => {
      toast.success("🔓 Lockdown disabled — restaurant is back online!");
      setUnlockPassword("");
      invalidateAll();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to disable lockdown"),
  });

  return (
    <div className={`rounded-3xl border-2 p-6 transition-colors ${
      isLocked
        ? "border-destructive/50 bg-destructive/5"
        : "border-border glass"
    }`}>
      <div className="flex items-start gap-4 mb-5">
        <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
          isLocked
            ? "bg-destructive/15 text-destructive"
            : "bg-primary/10 text-primary"
        }`}>
          {isLocked ? <ShieldAlert className="size-6" /> : <ShieldCheck className="size-6" />}
        </div>
        <div>
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            Lockdown Control
            {isLocked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2.5 py-0.5 text-xs font-semibold text-destructive-foreground animate-pulse">
                <Lock className="size-3" />
                ACTIVE
              </span>
            )}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLocked
              ? "Lockdown is currently active. All customers are blocked from accessing the restaurant. Enter the lockdown password to restore access."
              : "Instantly lock down the entire restaurant app. A password is required to activate and is needed again to unlock — preventing unauthorized access restoration."}
          </p>
        </div>
      </div>

      {isLocked ? (
        /* ── Unlock Form ── */
        <div className="space-y-4">
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-destructive">Status Code:</span>
              <span className="font-mono text-foreground">{publicSettings?.shutdown_code || 503}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="font-medium text-destructive shrink-0">Message:</span>
              <span className="text-foreground whitespace-pre-wrap">
                {publicSettings?.shutdown_message || "Restaurant is temporarily unavailable."}
              </span>
            </div>
          </div>

          <div className="border-t border-destructive/20 pt-4">
            <label className="text-sm font-medium text-foreground block mb-1">
              Enter lockdown password to unlock
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              Only the password set during lockdown activation will work. Failed attempts are logged to the audit trail.
            </p>
            <div className="flex gap-3 items-end">
              <div className="relative flex-1">
                <input
                  type={showUnlockPassword ? "text" : "password"}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Enter lockdown password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && unlockPassword && unlockMutation.mutate()}
                />
                <button
                  type="button"
                  onClick={() => setShowUnlockPassword(!showUnlockPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showUnlockPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <Button
                variant="default"
                className="bg-green-600 hover:bg-green-700 text-white gap-2 shrink-0"
                disabled={!unlockPassword || unlockMutation.isPending}
                onClick={() => unlockMutation.mutate()}
              >
                <Unlock className="size-4" />
                {unlockMutation.isPending ? "Unlocking…" : "Disable Lockdown"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Activate Lockdown Form ── */
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
            <strong>⚠️ Warning:</strong> Activating lockdown will immediately block all customer access to the restaurant app.
            Orders, menus, and all features will be inaccessible. You will need the password to unlock.
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Status Code</label>
              <p className="text-xs text-muted-foreground mb-2">HTTP status shown to customers (e.g. 402, 503)</p>
              <input
                type="number"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="503"
                value={lockForm.shutdown_code}
                onChange={(e) => setLockForm({ ...lockForm, shutdown_code: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Shutdown Message</label>
              <p className="text-xs text-muted-foreground mb-2">Displayed to locked-out users</p>
              <input
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Maintenance in progress..."
                value={lockForm.shutdown_message}
                onChange={(e) => setLockForm({ ...lockForm, shutdown_message: e.target.value })}
              />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5">
              <Lock className="size-3.5" />
              Lockdown Password
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Set a password that will be required to disable lockdown. Keep this safe — without it, lockdown cannot be lifted.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="relative">
                <label className="text-sm font-medium text-foreground block mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Min 4 characters"
                    value={lockForm.lockdown_password}
                    onChange={(e) => setLockForm({ ...lockForm, lockdown_password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">Confirm Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                    lockForm.confirm_password && lockForm.confirm_password !== lockForm.lockdown_password
                      ? "border-destructive focus-visible:ring-destructive"
                      : "border-input"
                  }`}
                  placeholder="Re-enter password"
                  value={lockForm.confirm_password}
                  onChange={(e) => setLockForm({ ...lockForm, confirm_password: e.target.value })}
                />
                {lockForm.confirm_password && lockForm.confirm_password !== lockForm.lockdown_password && (
                  <p className="text-xs text-destructive mt-1">Passwords do not match</p>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button
              variant="destructive"
              className="gap-2"
              disabled={
                !lockForm.lockdown_password ||
                lockForm.lockdown_password !== lockForm.confirm_password ||
                lockForm.lockdown_password.length < 4 ||
                lockMutation.isPending
              }
              onClick={() => {
                toast.error("Confirm: Activate lockdown and block all customer access?", {
                  description: "You will need the password to unlock the restaurant.",
                  action: {
                    label: "🔒 Yes, Lock Down",
                    onClick: () => lockMutation.mutate(),
                  },
                  cancel: {
                    label: "Cancel",
                    onClick: () => {},
                  },
                });
              }}
            >
              <Lock className="size-4" />
              {lockMutation.isPending ? "Activating…" : "Activate Lockdown"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
