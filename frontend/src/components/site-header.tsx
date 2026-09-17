import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ChefHat,
  Receipt,
  ShoppingBag,
  UtensilsCrossed,
  Settings,
  User,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/lib/cart";
import { settingsQuery } from "@/lib/db";
import { useIsAdmin } from "@/lib/auth";
import { getCustomerSession } from "@/lib/auth";

const NAV_LINKS = [
  {
    to: "/menu" as const,
    search: { category: undefined },
    label: "Menu",
    icon: UtensilsCrossed,
  },
  { to: "/my-orders" as const, label: "My orders", icon: Receipt },
  { to: "/settings" as const, label: "Settings", icon: Settings },
] as const;

export function SiteHeader() {
  const { count, tableNumber } = useCart();
  const { data: settings } = useQuery(settingsQuery);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useIsAdmin();
  const customerSession = typeof window !== "undefined" ? getCustomerSession() : null;
  const isLoggedIn = !!user || !!customerSession;

  // Close menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  if (pathname.startsWith("/admin")) return null;

  return (
    <>
      <header
        className="sticky top-0 z-50 glass-strong"
        style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
          {/* Brand mark */}
          <Link
            to="/"
            className="flex min-w-0 items-center gap-3 rounded-xl transition-opacity duration-200 hover:opacity-80"
            aria-label={`${import.meta.env["VITE_BUSINESS_NAME"] ?? "Restaurant"} — Home`}
          >
            <span
              className="grid size-11 shrink-0 place-items-center rounded-2xl shadow-glow pulse-ring"
              style={{ background: "var(--gradient-primary)" }}
            >
              <ChefHat className="size-5 text-primary-foreground" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-base font-bold leading-tight sm:text-lg">
                {settings?.name ?? import.meta.env["VITE_BUSINESS_NAME"] ?? "Restaurant"}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {settings?.tagline ?? "Restaurant & Sweet Shop"}
              </span>
            </span>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Desktop nav links — hidden on mobile */}
            <nav
              className="hidden items-center gap-1.5 sm:flex"
              aria-label="Site navigation"
            >
              {NAV_LINKS.map(({ to, label, icon: Icon, ...rest }) => (
                <Button
                  key={to}
                  asChild
                  variant="ghost"
                  size="sm"
                  className="rounded-xl transition-all duration-200 hover:bg-primary/10 hover:text-primary"
                >
                  <Link
                    to={to}
                    {...("search" in rest
                      ? { search: (rest as { search: { category: undefined } }).search }
                      : {})}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                </Button>
              ))}
              {/* Profile / Login — context-aware */}
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="rounded-xl transition-all duration-200 hover:bg-primary/10 hover:text-primary"
              >
                <Link to={isLoggedIn ? "/profile" : "/login"}>
                  <User className="size-4" aria-hidden="true" />
                  <span>{isLoggedIn ? "Profile" : "Login"}</span>
                </Link>
              </Button>
            </nav>

            {/* Cart — always visible */}
            <Button
              asChild
              variant="hero"
              size="sm"
              className="relative rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <Link
                to="/cart"
                aria-label={
                  count > 0 ? `Cart — ${count} item${count > 1 ? "s" : ""}` : "Cart"
                }
              >
                <ShoppingBag className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Cart</span>
                {count > 0 ? (
                  <Badge
                    variant="gold"
                    className="absolute -right-2 -top-2 min-w-[1.25rem] animate-badge-pop px-1.5 py-0 text-[10px]"
                    aria-live="polite"
                  >
                    {count}
                  </Badge>
                ) : null}
              </Link>
            </Button>

            {/* Animated hamburger — mobile only */}
            <button
              id="mobile-menu-toggle"
              className="grid size-10 place-items-center rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm transition-all duration-200 hover:border-primary/50 hover:bg-primary/10 sm:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
            >
              <span
                className="relative flex size-5 flex-col justify-center"
                aria-hidden="true"
              >
                <span
                  className="absolute h-[2px] w-full rounded-full bg-foreground transition-all duration-300 ease-out"
                  style={{
                    top: "5px",
                    transform: mobileOpen ? "translateY(6px) rotate(45deg)" : "none",
                  }}
                />
                <span
                  className="absolute h-[2px] rounded-full bg-foreground transition-all duration-300 ease-out"
                  style={{
                    top: "11px",
                    width: mobileOpen ? "0%" : "100%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    opacity: mobileOpen ? 0 : 1,
                  }}
                />
                <span
                  className="absolute h-[2px] w-full rounded-full bg-foreground transition-all duration-300 ease-out"
                  style={{
                    top: "17px",
                    transform: mobileOpen ? "translateY(-6px) rotate(-45deg)" : "none",
                  }}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile nav drawer */}
      <div
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed inset-0 z-40 sm:hidden transition-all duration-300 ${mobileOpen ? "visible" : "invisible pointer-events-none"}`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity duration-300 ${mobileOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />

        {/* Slide-down panel */}
        <nav
          className={`absolute left-0 right-0 top-[60px] glass-strong border-b border-border/40 px-4 pb-5 pt-3 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.5)] transition-all duration-300 ease-out ${
            mobileOpen ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
          }`}
        >
          <ul className="flex flex-col gap-1" role="list">
            {NAV_LINKS.map(({ to, label, icon: Icon, ...rest }) => {
              const active = pathname === to || pathname.startsWith(to + "/");
              return (
                <li key={to}>
                  <Link
                    to={to}
                    {...("search" in rest
                      ? { search: (rest as { search: { category: undefined } }).search }
                      : {})}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium transition-all duration-150 ${
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-foreground hover:bg-primary/10 hover:text-primary"
                    }`}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden="true" />
                    {label}
                    {active && (
                      <span
                        className="ml-auto size-1.5 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
            {/* Profile / Login — mobile */}
            <li>
              <Link
                to={isLoggedIn ? "/profile" : "/login"}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium transition-all duration-150 ${
                  pathname === "/profile" || pathname === "/login"
                    ? "bg-primary/15 text-primary"
                    : "text-foreground hover:bg-primary/10 hover:text-primary"
                }`}
              >
                <User className="size-5 shrink-0" aria-hidden="true" />
                {isLoggedIn ? "Profile" : "Login"}
                {(pathname === "/profile" || pathname === "/login") && (
                  <span
                    className="ml-auto size-1.5 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                )}
              </Link>
            </li>
          </ul>

          {/* Table badge at bottom of drawer */}
          {tableNumber && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
              <ChefHat className="size-4 shrink-0" aria-hidden="true" />
              <span>
                Seated at <strong>Table {tableNumber}</strong> — dine-in
              </span>
            </div>
          )}
        </nav>
      </div>
    </>
  );
}
