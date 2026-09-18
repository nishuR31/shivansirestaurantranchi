import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useRef, useState, Suspense, type ReactNode } from "react";
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

  // Always allow access to the login page so superadmins can log in and disable the shutdown
  if (pathname.startsWith("/login")) {
    return <>{children}</>;
  }

  if (settings?.is_suspended && !isSuperAdmin) {
    const statusCode = settings.shutdown_code || 402;
    const message = settings.shutdown_message || "Payment not received or maintenance in progress. Access restricted.";

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <div
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
          aria-hidden="true"
        >
          <div className="absolute -top-32 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-destructive/10 blur-[120px]" />
        </div>
        <div className="animate-rise max-w-md space-y-6">
          <div className="mx-auto flex size-20 items-center justify-center rounded-3xl border border-destructive/30 bg-destructive/10">
            <AlertTriangle className="size-10 text-destructive" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Error {statusCode}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {message}
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
              <SuspensionGuard>
                <Outlet />
              </SuspensionGuard>
            </Suspense>
          </div>
          <Toaster position="top-center" richColors />
        </CartProvider>
      </QueryClientProvider>
    </Provider>
  );
}
