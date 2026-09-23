import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChefHat, Clock, MapPin, Phone, Star, Heart } from "lucide-react";
import { settingsQuery } from "@/lib/db";
import { SiteFooter } from "@/components/site-footer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
const PLACEHOLDER = {
  name: "Maa Tara Sweets",
  tagline: "Freshly made sweets & Indian classics, served right at your seat.",
  address:
    "Opposite ICFAI University, Near Dhoni Farmhouse, Daladali Chowk, Ranchi – 835 222, Jharkhand",
  phone: "+91 99990 12031",
  opening_time: "07:00 AM",
  closing_time: "09:30 PM",
} as const;

export const Route = createFileRoute("/owner")({
  head: () => ({
    meta: [
      { title: "About the owner — Maa Tara Sweets" },
      {
        name: "description",
        content:
          "Meet the family behind Maa Tara Sweets — decades of passion for authentic Indian sweets and hospitality in Ranchi.",
      },
      { property: "og:title", content: "About the owner — Maa Tara Sweets" },
      { property: "og:description", content: "Our story, our kitchen, our family." },
    ],
  }),
  component: OwnerPage,
});

function OwnerPage() {
  const { data: settings } = useQuery({
    ...settingsQuery,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const s = { ...PLACEHOLDER, ...settings };

  const highlights = [
    { icon: Star, label: "Est.", value: "2025" },
    { icon: Heart, label: "Speciality", value: "Indian Sweets" },
    { icon: ChefHat, label: "Chef", value: "In-house" },
  ];

  return (
    <main className="min-h-screen px-4 py-12 sm:px-6">
      {/* Decorative background glow */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-32 left-1/2 size-[50rem] -translate-x-1/2 rounded-full bg-primary/8 blur-[140px]" />
        <div className="absolute bottom-20 right-0 size-80 rounded-full bg-accent/10 blur-[100px]" />
      </div>

      <div className="mx-auto max-w-4xl space-y-10">
        {/* Hero card */}
        <section className="glass animate-rise rounded-3xl overflow-hidden">
          {/* Gradient banner */}
          <div
            className="h-36 w-full relative"
            aria-hidden="true"
          >
            <div
              className="absolute inset-0 opacity-30"
              style={{ background: "var(--gradient-primary)" }}
            />
          </div>

          {/* Avatar + name */}
          <div className="px-8 pb-8">
            <div className="-mt-12 flex flex-wrap items-end gap-4">
              <span
                className="grid size-24 shrink-0 place-items-center rounded-3xl border-4 border-background shadow-glow"
                style={{ background: "var(--gradient-primary)" }}
                aria-hidden="true"
              >
                <ChefHat className="size-12 text-primary-foreground" />
              </span>
              <div className="pb-1">
                <h1 className="font-display text-3xl font-bold gradient-text sm:text-4xl">
                  {s.name}
                </h1>
                <p className="text-sm text-muted-foreground">{s.tagline}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Quick stats */}
        <section className="grid gap-4 sm:grid-cols-3" aria-label="Restaurant highlights">
          {highlights.map(({ icon: Icon, label, value }) => (
            <div key={label} className="glass rounded-3xl p-5 text-center space-y-2">
              <span
                className="mx-auto grid size-10 place-items-center rounded-2xl"
                style={{ background: "var(--gradient-primary)" }}
              >
                <Icon className="size-5 text-primary-foreground" aria-hidden="true" />
              </span>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              <p className="font-display text-xl font-bold">{value}</p>
            </div>
          ))}
        </section>

        {/* Our story */}
        <section className="glass rounded-3xl p-8 space-y-4">
          <h2 className="font-display text-2xl font-bold">Our Story</h2>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Maa Tara Sweets began with a simple dream — to bring the authentic taste of
              handcrafted Indian sweets to the heart of Ranchi. What started as a small
              family kitchen has grown into a beloved landmark for locals and visitors
              alike.
            </p>
            <p>
              Every sweet is prepared fresh daily, using traditional recipes passed down
              through generations. From silky <em>Rasgulla</em> and crumbly{" "}
              <em>Kalakand</em> to the ever-popular <em>Gulab Jamun</em>, each piece
              carries the warmth of home cooking.
            </p>
            <p>
              Beyond sweets, our kitchen serves a rotating menu of Indian classics —
              curries, chaats and snacks — made with locally sourced ingredients and
              cooked with care.
            </p>
          </div>
        </section>

        {/* Contact & hours */}
        <section className="glass rounded-3xl p-8 space-y-5">
          <h2 className="font-display text-2xl font-bold">Visit Us</h2>
          <div className="grid gap-4 sm:grid-cols-3 text-sm">
            <Dialog>
              <DialogTrigger asChild>
                <button className="text-left flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors group">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent/10 group-hover:bg-accent/20 transition-colors">
                    <MapPin className="size-4 text-accent" aria-hidden="true" />
                  </span>
                  <span className="leading-relaxed">{s.address}</span>
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Our Location</DialogTitle>
                </DialogHeader>
                <div className="aspect-video w-full overflow-hidden rounded-xl border border-border">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    style={{ border: 0 }} 
                    loading="lazy" 
                    allowFullScreen 
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(s.address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <a
                    href="https://maps.app.goo.gl/Wc3uMz7K1z4XcoHL8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:scale-105"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    <MapPin className="size-4" />
                    Open in Google Maps
                  </a>
                </div>
              </DialogContent>
            </Dialog>

            <a
              href={`tel:${s.phone}`}
              className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors group"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent/10 group-hover:bg-accent/20 transition-colors">
                <Phone className="size-4 text-accent" aria-hidden="true" />
              </span>
              {s.phone}
            </a>

            <div className="flex items-center gap-3 text-muted-foreground">
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent/10">
                <Clock className="size-4 text-accent" aria-hidden="true" />
              </span>
              <span>
                {s.opening_time} – {s.closing_time}
                <br />
                <span className="text-xs">Open every day</span>
              </span>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="flex flex-wrap justify-center gap-4 pb-4">
          <Link
            to="/menu"
            search={{ category: undefined }}
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:scale-105"
            style={{ background: "var(--gradient-primary)" }}
          >
            <ChefHat className="size-4" aria-hidden="true" />
            View our menu
          </Link>
          <a
            href="https://maps.app.goo.gl/Wc3uMz7K1z4XcoHL8"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-all hover:scale-105 hover:border-primary/60"
          >
            <MapPin className="size-4" aria-hidden="true" />
            Get directions
          </a>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
