import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Camera,
  CameraOff,
  ScanLine,
  Loader2,
  ExternalLink,
  Copy,
  CheckCheck,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import jsQR from "jsqr";

export const Route = createFileRoute("/scanner")({
  head: () => ({
    meta: [
      { title: "QR Scanner — Maa Tara Sweets" },
      {
        name: "description",
        content: "Scan a table QR code to open the menu for that table.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScannerPage,
});

type ScanState = "idle" | "requesting" | "active" | "denied" | "unsupported";

const INTERNAL_ORIGIN = typeof window !== "undefined" ? window.location.origin : "";

function ScannerPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectorRef = useRef<any>(null);

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  // ── jsQR setup ─────────────────────────────────────────────────────────────
  // Relaxed support check to allow native permissions if available

  const stopStream = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startScan = useCallback(async () => {
    setScanState("requesting");
    try {
      const getUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices) ||
                           (navigator as any).getUserMedia?.bind(navigator) ||
                           (navigator as any).webkitGetUserMedia?.bind(navigator);
                           
      if (!getUserMedia) {
        setScanState("unsupported");
        return;
      }

      const stream = await getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true"); // required to tell iOS safari we don't want fullscreen
        await videoRef.current.play();
      }

      setScanState("active");
      rafRef.current = requestAnimationFrame(tick);
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        setScanState("denied");
      } else {
        toast.error("Could not start camera: " + (err?.message || "unknown error"));
        setScanState("idle");
      }
    }
  }, [facingMode]);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    // Match canvas dimensions to video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code) {
      const value = code.data;
      
      // Prevent spamming the same result
      setLastResult((prev) => {
        if (prev !== value) {
          // If it's an internal /table/... URL — navigate directly
          if (value.startsWith(INTERNAL_ORIGIN + "/table/")) {
            const path = value.slice(INTERNAL_ORIGIN.length);
            toast.success("Table QR detected — opening menu…");
            stopStream();
            setScanState("idle");
            navigate({ to: path as any });
            return value;
          }

          // Otherwise show the result and keep scanning
          toast.info("Scanned: " + value.slice(0, 60) + (value.length > 60 ? "…" : ""));
        }
        return value;
      });
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [navigate, stopStream]);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  // Restart when facingMode changes while active
  useEffect(() => {
    if (scanState === "active") {
      stopStream();
      void startScan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const copyResult = async () => {
    if (!lastResult) return;
    await navigator.clipboard.writeText(lastResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isInternalLink = lastResult?.startsWith(INTERNAL_ORIGIN + "/") ?? false;

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-32 left-1/2 size-[50rem] -translate-x-1/2 rounded-full bg-primary/8 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-display text-3xl font-bold">QR Scanner</h1>
          <p className="text-sm text-muted-foreground">
            Point your camera at a table QR code to jump straight to that table's menu.
            Tap the screen to begin.
          </p>
        </header>

        {/* Camera viewport — acts as the start button when idle */}
        <button
          type="button"
          onClick={scanState !== "active" ? startScan : undefined}
          disabled={scanState === "requesting" || scanState === "unsupported"}
          className={`relative overflow-hidden rounded-3xl aspect-[4/3] flex items-center justify-center w-full transition-all duration-300 ${
            scanState === "active"
              ? "glass bg-black/20 cursor-default"
              : "glass-strong hover:bg-primary/5 cursor-pointer ring-1 ring-border/50 hover:ring-primary/50"
          }`}
          aria-label={
            scanState !== "active" ? "Click to start camera" : "Camera preview active"
          }
        >
          {/* Live video */}
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            muted
            playsInline
            aria-label="Camera preview"
            style={{ display: scanState === "active" ? "block" : "none" }}
          />

          {/* Hidden canvas for future jsQR fallback (not rendered) */}
          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

          {/* Scanning reticle overlay */}
          {scanState === "active" && (
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              aria-hidden="true"
            >
              {/* Corner brackets */}
              <div className="relative size-52">
                {/* TL */}
                <span className="absolute left-0 top-0 h-8 w-8 border-l-[3px] border-t-[3px] border-primary rounded-tl-xl" />
                {/* TR */}
                <span className="absolute right-0 top-0 h-8 w-8 border-r-[3px] border-t-[3px] border-primary rounded-tr-xl" />
                {/* BL */}
                <span className="absolute left-0 bottom-0 h-8 w-8 border-l-[3px] border-b-[3px] border-primary rounded-bl-xl" />
                {/* BR */}
                <span className="absolute right-0 bottom-0 h-8 w-8 border-r-[3px] border-b-[3px] border-primary rounded-br-xl" />

                {/* Animated scan line */}
                <ScanLine
                  className="absolute left-1 right-1 text-primary/80 animate-bounce"
                  style={{ top: "45%", width: "calc(100% - 8px)" }}
                  aria-hidden="true"
                />
              </div>
            </div>
          )}

          {/* Idle / denied / unsupported states */}
          {scanState !== "active" && (
            <div className="flex flex-col items-center gap-4 p-8 text-center">
              {scanState === "requesting" ? (
                <>
                  <Loader2 className="size-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Requesting camera access…
                  </p>
                </>
              ) : scanState === "denied" ? (
                <>
                  <CameraOff className="size-10 text-destructive" />
                  <div>
                    <p className="font-semibold text-foreground">Camera access denied</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Allow camera access in your browser settings, then click to try
                      again.
                    </p>
                  </div>
                </>
              ) : scanState === "unsupported" ? (
                <>
                  <CameraOff className="size-10 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">Scanner not supported</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Use Chrome or Safari on a modern device to scan QR codes.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
                    <Camera className="size-8" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Click to start camera</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Scan your table QR code to view the menu
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Flip camera button (visible when active) */}
          {scanState === "active" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFacingMode((m) => (m === "environment" ? "user" : "environment"));
              }}
              className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-black/80 text-white hover:bg-black transition-colors pointer-events-auto"
              aria-label="Flip camera"
            >
              <RotateCcw className="size-4" />
            </button>
          )}
        </button>

        {/* Controls */}
        {scanState === "active" && (
          <div className="flex justify-center">
            <Button
              variant="glass"
              className="rounded-full"
              onClick={() => {
                stopStream();
                setScanState("idle");
              }}
            >
              <CameraOff className="size-4" /> Stop camera
            </Button>
          </div>
        )}

        {/* Last scan result */}
        {lastResult && (
          <div className="glass animate-rise rounded-3xl p-5 space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Last scan
            </p>
            <p className="break-all font-mono text-sm text-foreground leading-relaxed">
              {lastResult}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="glass"
                size="sm"
                className="rounded-full"
                onClick={copyResult}
              >
                {copied ? (
                  <CheckCheck className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied ? "Copied!" : "Copy"}
              </Button>
              {isInternalLink && (
                <Button
                  variant="hero"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    const path = lastResult.slice(INTERNAL_ORIGIN.length);
                    navigate({ to: path as any });
                  }}
                >
                  <ExternalLink className="size-3.5" /> Open
                </Button>
              )}
              {!isInternalLink && lastResult.startsWith("http") && (
                <a
                  href={lastResult}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/60 transition-colors"
                >
                  <ExternalLink className="size-3.5" /> Open link
                </a>
              )}
              <Button
                variant="glass"
                size="sm"
                className="rounded-full"
                onClick={() => setLastResult(null)}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        <div className="glass rounded-3xl p-5 text-sm text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">How to use</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>
              <strong>Tap the camera screen</strong> — the browser will request camera
              access.
            </li>
            <li>
              Point at a table QR code — the app navigates to the menu automatically.
            </li>
            <li>
              For other QR codes, the decoded text appears below with copy/open options.
            </li>
          </ol>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
