import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useRef, useState, Suspense, Component, type ReactNode, type ErrorInfo } from "react";
import { Home, ArrowLeft, RefreshCw, ChefHat, AlertTriangle } from "lucide-react";
import { PageLoader } from "@/components/page-loader";
import { StartupSplash } from "@/components/startup-splash";

import appCss from "../styles.css?url";
import { CartProvider } from "@/lib/cart";
import { Provider, useSelector } from "react-redux";
import { store, RootState } from "@/store";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/db";
import { useIsAdmin } from "@/lib/auth";
import { useRealtimeSync } from "@/lib/useRealtimeSync";
import { SEO } from "@/components/SEO";

/** 🍬 Not Found — sweet-themed, auto-redirects after 10 s */
function NotFoundComponent() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(10);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(intervalRef.current!);
          void router.navigate({ to: "/", replace: true });
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [router]);

  const circumference = 2 * Math.PI * 20; // r=20
  const dashOffset = circumference - (countdown / 10) * circumference;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      {/* Decorative blur blobs */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-32 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 size-72 rounded-full bg-accent/10 blur-[80px]" />
      </div>

      <div className="animate-rise max-w-md space-y-6">
        {/* Animated sweet icon */}
        <div
          className="mx-auto flex size-24 items-center justify-center rounded-3xl shadow-glow pulse-ring"
          style={{ background: "var(--gradient-primary)" }}
        >
          <ChefHat className="size-12 text-primary-foreground" aria-hidden="true" />
        </div>

        <div>
          <h1 className="font-display text-3xl font-bold gradient-text sm:text-4xl">
            Our sweets are getting ready!
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            This page is still in the kitchen. Our chefs are working on it — we'll take
            you back to the menu shortly.
          </p>
        </div>

        {/* Countdown ring */}
        <div className="flex flex-col items-center gap-2">
          <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
            <circle
              cx="28"
              cy="28"
              r="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-border"
            />
            <circle
              cx="28"
              cy="28"
              r="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-primary transition-all duration-1000"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 28 28)"
            />
            <text
              x="28"
              y="33"
              textAnchor="middle"
              fontSize="14"
              fontWeight="700"
              fill="currentColor"
              className="fill-foreground"
            >
              {countdown}
            </text>
          </svg>
          <p className="text-xs text-muted-foreground">Redirecting in {countdown}s…</p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow transition-all hover:scale-105 hover:shadow-glow"
          >
            <Home className="size-4" aria-hidden="true" /> Go to menu
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-all hover:scale-105 hover:border-primary/60"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Go back
          </button>
        </div>
      </div>
    </div>
  );
}

/** ⚠️ Error boundary — handles stale build caches with a clean-reload option */
function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  // Detect chunk-load failures typical of stale build caches
  const isChunkError =
    error.message.includes("Failed to fetch dynamically imported module") ||
    error.message.includes("Unable to preload CSS") ||
    error.message.includes("error loading dynamically imported module") ||
    error.message.toLowerCase().includes("chunk");

  function hardReload() {
    // Clear app-specific caches and local storage, leaving other apps intact
    const clearStorage = () => {
      localStorage.removeItem("maatara-theme-v1");
      localStorage.removeItem("maatara-cart-v1");
    };

    const reload = () => window.location.reload();

    if ("caches" in window) {
      void caches
        .keys()
        .then((keys) => {
          const appKeys = keys.filter(
            (k) => k.includes("maatara") || k.includes("vite") || k.includes("workbox"),
          );
          return Promise.all(appKeys.map((k) => caches.delete(k)));
        })
        .then(() => {
          clearStorage();
          reload();
        });
    } else {
      clearStorage();
      reload();
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-32 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-destructive/8 blur-[120px]" />
      </div>

      <div className="animate-rise max-w-md space-y-6">
        <div className="mx-auto flex size-20 items-center justify-center rounded-3xl border border-destructive/30 bg-destructive/10">
          <AlertTriangle className="size-10 text-destructive" aria-hidden="true" />
        </div>

        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {isChunkError ? "Menu updated — please refresh" : "Something went wrong"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {isChunkError
              ? "We've pushed fresh updates to our kitchen! Your browser has a stale copy. A quick reload will serve you the latest version."
              : "An unexpected error occurred. This is on us — our team has been notified. Try refreshing or heading back home."}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={
              isChunkError
                ? hardReload
                : () => {
                    router.invalidate();
                    reset();
                  }
            }
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow transition-all hover:scale-105"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {isChunkError ? "Reload & clear cache" : "Try again"}
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-all hover:scale-105 hover:border-primary/60"
          >
            <Home className="size-4" aria-hidden="true" /> Go home
          </a>
        </div>

        {!isChunkError && (
          <details className="text-left">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Technical details
            </summary>
            <pre className="mt-2 overflow-auto rounded-xl border border-border bg-card p-3 text-left font-mono text-[11px] text-muted-foreground">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

class SuspensionErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("SuspensionGuard caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return <ErrorComponent error={this.state.error} reset={() => this.setState({ hasError: false, error: null })} />;
    }
    return this.props.children;
  }
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  pendingComponent: PageLoader,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

/** JWT-based auth sync — invalidates on visibility change (tab focus) */
function AuthSync() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    const onFocus = () => void queryClient.invalidateQueries({ queryKey: ["auth_me"] });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [queryClient]);
  return null;
}

function ThemeSync() {
  const { mode, base } = useSelector((state: RootState) => state.theme);
  useEffect(() => {
    const root = document.documentElement;
    // Remove previous modes
    root.classList.remove("light", "dark");
    if (mode === "auto") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.add(isDark ? "dark" : "light");
    } else {
      root.classList.add(mode);
    }

    // Remove previous bases
    root.classList.remove(
      "style-amoled-black",
      "style-minimalist",
      "style-liquid-glass",
      "style-claymorphism"
    );
    root.classList.add(`style-${base}`);
  }, [mode, base]);
  return null;
}

function ScrollToTop() {
  const router = useRouter();
  useEffect(() => {
    return router.subscribe("onResolved", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [router]);
  return null;
}

function SuspensionGuard({ children }: { children: ReactNode }) {
  const { data: settings, isFetching } = useQuery(settingsQuery);
  const { isSuperAdmin } = useIsAdmin();
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    // Once the first fetch completes, we have the authoritative remote state
    if (!isFetching) {
      setInitialCheckDone(true);
    }
  }, [isFetching]);

  if (!initialCheckDone) {
    return <StartupSplash onComplete={() => {}} />;
  }

  // Always allow access to the login and auth pages so superadmins can log in and disable the shutdown
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    return <>{children}</>;
  }

  if (settings?.is_suspended && !isSuperAdmin) {
    const statusCode = settings.shutdown_code || 503;
    const message = settings.shutdown_message || "We're currently performing maintenance. Please check back shortly.";
    const restaurantName = settings.name || "Restaurant";
    const restaurantTagline = settings.tagline || "";
    const phone = settings.phone;
    const address = settings.address;
    const openingTime = settings.opening_time;
    const closingTime = settings.closing_time;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-center">
        {/* Background effects */}
        <div
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
          aria-hidden="true"
        >
          <div className="absolute -top-32 left-1/2 size-[50rem] -translate-x-1/2 rounded-full bg-destructive/8 blur-[140px] animate-pulse" />
          <div className="absolute bottom-0 right-0 size-[30rem] rounded-full bg-primary/5 blur-[100px]" />
        </div>

        <div className="animate-rise max-w-lg w-full space-y-8">
          {/* Shield Icon */}
          <div className="mx-auto relative">
            <div className="absolute inset-0 mx-auto size-24 rounded-full bg-destructive/20 blur-xl animate-pulse" />
            <div className="relative mx-auto flex size-24 items-center justify-center rounded-full border-2 border-destructive/30 bg-gradient-to-b from-destructive/10 to-destructive/5 shadow-lg shadow-destructive/10">
              <svg
                className="size-12 text-destructive"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v4" />
                <circle cx="12" cy="16" r="1" fill="currentColor" />
              </svg>
            </div>
          </div>

          {/* Restaurant branding */}
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">
              {restaurantName}
            </h1>
            {restaurantTagline && (
              <p className="text-sm text-muted-foreground italic">{restaurantTagline}</p>
            )}
          </div>

          {/* Status badge */}
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-destructive/10 border border-destructive/30 px-4 py-2 text-sm font-semibold text-destructive">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-destructive" />
              </span>
              TEMPORARILY UNAVAILABLE · {statusCode}
            </span>
          </div>

          {/* Custom message card */}
          <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-6 shadow-sm text-left">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-display text-base font-semibold text-foreground mb-2">
                  Service Notice
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {message}
                </p>
              </div>
            </div>
          </div>

          {/* Info cards */}
          {(phone || address || (openingTime && closingTime)) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {phone && (
                <a
                  href={`tel:${phone}`}
                  className="group rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4 transition-all hover:bg-card hover:shadow-md hover:border-primary/30"
                >
                  <div className="text-2xl mb-2">📞</div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Contact Us</div>
                  <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{phone}</div>
                </a>
              )}
              {address && (
                <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4">
                  <div className="text-2xl mb-2">📍</div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Visit Us</div>
                  <div className="text-sm font-medium text-foreground leading-snug">{address}</div>
                </div>
              )}
              {openingTime && closingTime && (
                <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4">
                  <div className="text-2xl mb-2">⏰</div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Regular Hours</div>
                  <div className="text-sm font-medium text-foreground">{openingTime} – {closingTime}</div>
                </div>
              )}
            </div>
          )}

          {/* Footer message */}
          <div className="pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              This is a temporary measure. We apologize for the inconvenience and will be back shortly.
              <br />
              <span className="inline-flex items-center gap-1 mt-1">
                Please check back later
                <span className="inline-flex gap-0.5">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                </span>
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function RealtimeSync() {
  useRealtimeSync();
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <CartProvider>
          <AuthSync />
          <ThemeSync />
          <RealtimeSync />
          <SEO />
          <ScrollToTop />
          <div className="relative min-h-screen">
            <div className="pointer-events-none fixed inset-0 -z-10 aurora-bg opacity-70" />
            <SiteHeader />
            {/* Suspense boundary: shows PageLoader while lazy route chunks load */}
            <Suspense fallback={<PageLoader />}>
              <SuspensionErrorBoundary>
                <SuspensionGuard>
                  <Outlet />
                </SuspensionGuard>
              </SuspensionErrorBoundary>
            </Suspense>
          </div>
          <Toaster position="top-center" richColors />
        </CartProvider>
      </QueryClientProvider>
    </Provider>
  );
}
