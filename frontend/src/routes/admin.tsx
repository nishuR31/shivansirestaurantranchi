import { useEffect } from "react";
import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  Home,
  LayoutGrid,
  Loader2,
  LogOut,
  Settings,
  Star,
  LucideShieldX,
  Tag,
  Users,
  ShieldCheck,
  ShieldAlert,
  UtensilsCrossed,
  UserCircle2,
  Palette,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/lib/auth";
import { fetchAPI } from "@/lib/db";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Owner dashboard — Maa Tara Sweets" },
      {
        name: "description",
        content: "Manage live orders, menu, inventory, offers and reports.",
      },
      { property: "og:title", content: "Owner dashboard — Maa Tara Sweets" },
      { property: "og:description", content: "Manage the restaurant from one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Live orders", icon: ClipboardList, live: true },
  { to: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes },
  { to: "/admin/offers", label: "Offers & loyalty", icon: Tag },
  { to: "/admin/tables", label: "Tables & QR", icon: LayoutGrid },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
  { to: "/admin/staff", label: "Staff", icon: ShieldCheck },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/audit", label: "Audit Logs", icon: LucideShieldX },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/governance", label: "Governance", icon: Lock },
] as const;

function AdminLayout() {
  const { isAdmin, mfaSatisfied, checking, user } = useIsAdmin();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (checking) return;
    if (!user || !isAdmin || !mfaSatisfied) {
      navigate({ to: "/auth", search: { redir: pathname }, replace: true });
    }
  }, [checking, user, isAdmin, mfaSatisfied, navigate]);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, [isAdmin, mfaSatisfied]);

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
  }

  if (checking) {
    return (
      <main className="grid min-h-[70vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!user || !isAdmin || !mfaSatisfied) {
    return <main className="min-h-[70vh]" aria-label="Checking owner access" />;
  }

  return (
    <main className="px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* ── Pill navigation bar ── */}
        <nav
          className="glass flex flex-nowrap items-center gap-1 overflow-x-auto rounded-full p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Admin navigation"
        >
          {NAV.filter((item) => {
            if (user?.role !== "SUPERADMIN" && (item.to === "/admin/settings" || item.to === "/admin/governance")) return false;
            return true;
          }).map((item) => {
            const active =
              item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-200 ${active
                  ? "bg-[image:var(--gradient-primary)] text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  }`}
              >
                <item.icon className="size-3.5 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
                {"live" in item && item.live && (
                  <span className="relative ml-0.5 flex size-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-green-500" />
                  </span>
                )}
              </Link>
            );
          })}

          {/* ── Utility buttons ── */}
          <div className="ml-auto flex shrink-0 items-center gap-1 pl-1">
            <Link
              to="/"
              aria-label="Go to app home"
              title="App Home"
              className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
            >
              <Home className="size-5" />
            </Link>
            <Link
              to="/settings"
              aria-label="Theme settings"
              title="Theme settings"
              className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
            >
              <Palette className="size-5" />
            </Link>
            <Link
              to="/profile"
              aria-label="My profile"
              title="My profile"
              className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
            >
              {user["avatarUrl"] ? (
                <img src={user["avatarUrl"]} alt="Profile" className="size-6 rounded-full object-cover" />
              ) : (
                <UserCircle2 className="size-5" />
              )}
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 rounded-full"
              onClick={handleSignOut}
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </nav>

        <Outlet />
      </div>
      <div className="mt-12">
        <SiteFooter />
      </div>
    </main>
  );
}
