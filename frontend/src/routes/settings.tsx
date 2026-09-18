import { createFileRoute } from "@tanstack/react-router";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store";
import {
  setThemeMode,
  setThemeBase,
  ThemeMode,
  ThemeBase,
} from "@/store/slices/themeSlice";
import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Maa Tara Sweets Restaurant" },
      { name: "description", content: "Customize your UI experience." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const dispatch = useDispatch();
  const { mode, base } = useSelector((state: RootState) => state.theme);

  const handleModeChange = (newMode: ThemeMode) => {
    dispatch(setThemeMode(newMode));
  };

  const handleBaseChange = (newBase: ThemeBase) => {
    dispatch(setThemeBase(newBase));
  };

  return (
    <main className="min-h-screen flex flex-col">
      <section className="flex-1 px-4 py-14 sm:px-6 scroll-reveal">
        <div className="mx-auto max-w-3xl space-y-12">
          <header className="space-y-2">
            <h1 className="font-display text-4xl font-bold gradient-text">
              Display Settings
            </h1>
            <p className="text-muted-foreground">
              Customize how the app looks on your device.
            </p>
          </header>

          {/* Theme Mode Selection */}
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-semibold">Theme Mode</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { id: "dark", label: "Dark", desc: "Deep violet & amber" },
                { id: "light", label: "Light", desc: "Clean & bright" },
                { id: "auto", label: "Auto", desc: "Follow system" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleModeChange(m.id as ThemeMode)}
                  className={`card-3d p-5 rounded-2xl border-2 transition-all ${mode === m.id
                      ? "border-primary bg-primary/10 shadow-glow"
                      : "border-border bg-card hover:border-primary/50"
                    }`}
                >
                  <div className="font-bold text-foreground">{m.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Base/Style Selection */}
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
              UI Base Style
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  id: "amoled-black",
                  label: "Amoled Black",
                  desc: "Pure OLED black, extreme contrast",
                },
                {
                  id: "minimalist",
                  label: "Minimalist",
                  desc: "Clean typography, flat UI, no glass",
                },
                {
                  id: "liquid-glass",
                  label: "Liquid Glass",
                  desc: "Adaptive Apple-like translucency",
                },
                {
                  id: "claymorphism",
                  label: "Claymorphism",
                  desc: "Soft 3D, chunky, playful borders",
                },
              ].map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleBaseChange(b.id as ThemeBase)}
                  className={`card-3d p-5 rounded-2xl border-2 transition-all text-left ${base === b.id
                      ? "border-accent bg-accent/10 shadow-glow-gold"
                      : "border-border bg-card hover:border-accent/50"
                    }`}
                >
                  <div className="font-bold text-foreground">{b.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{b.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
