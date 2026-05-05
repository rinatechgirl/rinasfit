import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Users,
  Ruler,
  Palette,
  BarChart3,
  Shield,
  Globe,
  ChevronDown,
  Sun,
  Moon,
  Menu,
  X as XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import fallbackLogo from "@/assets/logo.jpeg";

// ─── Intersection observer hook ───────────────────────────────────────────────

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: Users,
    title: "Customer profiles",
    description:
      "Complete client records with contact history, preferences and measurement timeline — all searchable in seconds.",
  },
  {
    icon: Ruler,
    title: "25+ measurements",
    description:
      "Every body measurement recorded per customer, per outfit type. Never lose a sizing note again.",
  },
  {
    icon: Palette,
    title: "Design library",
    description:
      "Front and back view photos for every design, filterable by gender and category. Your catalogue, beautifully organised.",
  },
  {
    icon: BarChart3,
    title: "Business reports",
    description:
      "Admin-only insights into customer growth, design activity, and business performance over time.",
  },
  {
    icon: Shield,
    title: "Role-based teams",
    description:
      "Invite staff, assign roles, and control exactly what each person can access within your organisation.",
  },
  {
    icon: Globe,
    title: "Branded subdomain",
    description:
      "Your own portal at yourname.rinasfit.com — your logo, your name, your clients. Fully white-labelled.",
  },
];

const stats = [
  { value: "25+",   label: "Measurement fields" },
  { value: "100%",  label: "Data isolation"      },
  { value: "2 min", label: "Setup time"           },
  { value: "∞",     label: "Organisations"        },
];

const steps = [
  {
    num: "01",
    title: "Create your account",
    body: "Sign up with your business name and choose your username — it becomes your permanent subdomain.",
  },
  {
    num: "02",
    title: "Set up your portal",
    body: "Upload your logo, add business details, and invite your team. Takes under two minutes.",
  },
  {
    num: "03",
    title: "Start managing",
    body: "Add customers, record measurements, upload designs, and run your entire business from one dashboard.",
  },
];

// Unsplash fashion images — swap these for your own photos later
// const HERO_IMG    = "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80&auto=format&fit=crop";
const HERO_IMG    = "https://img.freepik.com/premium-photo/two-young-colleagues-standing-by-mannequins-creating-new-clothes_236854-55123.jpg?w=1920&q=80&auto=format&fit=crop";
const TAILOR_IMG  = "https://i.pinimg.com/474x/6c/30/a6/6c30a6c623055ca6658e1556eb9827d4.jpg?w=900&q=80&auto=format&fit=crop";
const FABRIC_IMG  = "https://i.pinimg.com/474x/77/2e/f8/772ef8832e5e77dae19ab81771ff4b4a.jpg?w=700&q=80&auto=format&fit=crop";
const FASHION_IMG = "https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=700&q=80&auto=format&fit=crop";

// ─── Theme toggle button ──────────────────────────────────────────────────────

const ThemeToggle = ({ className }: { className?: string }) => {
  const { isDark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className={cn(
        "p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
        className
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};

// ─── Accent tag ───────────────────────────────────────────────────────────────

const Tag = ({ label, center = false }: { label: string; center?: boolean }) => (
  <div className={cn("flex items-center gap-2 mb-6", center && "justify-center")}>
    <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
    <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-accent font-body">
      {label}
    </span>
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function Landing() {
  const navigate = useNavigate();

  // Scroll-reveal refs
  const statsRef     = useInView();
  const editorialRef = useInView(0.1);
  const featuresRef  = useInView(0.1);
  const stepsRef     = useInView(0.1);
  const magRef       = useInView(0.1);
  const ctaRef       = useInView(0.2);
  const founderRef   = useInView(0.15);

  // Hero entrance — small delay so CSS is ready before classes apply
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <img
              src={fallbackLogo}
              alt="Rina's Fit"
              className="w-8 h-8 object-contain rounded-lg border border-border"
            />
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-sm text-foreground tracking-tight">
                Rina's Fit
              </span>
              <span className="hidden sm:block text-[9px] font-bold tracking-[0.2em] uppercase text-accent/70 font-body">
                Digital Atelier
              </span>
            </div>
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            <a
              href="#about"
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors tracking-wide font-body"
            >
              About
            </a>
            <button
              onClick={() => navigate("/magazine")}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors tracking-wide font-body"
            >
              Magazine
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors tracking-wide font-body"
            >
              Sign in
            </button>
            <ThemeToggle />
            <Button size="sm" onClick={() => navigate("/register-business")} className="gap-1.5">
              Get started <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Mobile right side */}
          <div className="flex md:hidden items-center gap-1">
            <ThemeToggle />
            <button
              onClick={() => setMobileNavOpen(true)}
              className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile nav drawer ─────────────────────────────────────────────── */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-[60] flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative ml-auto w-64 h-full bg-card border-l border-border flex flex-col p-6 gap-1">
            <div className="flex items-center justify-between mb-4">
              <span className="font-display font-bold text-sm text-foreground">Menu</span>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <a
              href="#about"
              onClick={() => setMobileNavOpen(false)}
              className="text-left text-sm text-muted-foreground hover:text-foreground py-3 border-b border-border transition-colors font-body"
            >
              About
            </a>
            <button
              onClick={() => { navigate("/magazine"); setMobileNavOpen(false); }}
              className="text-left text-sm text-muted-foreground hover:text-foreground py-3 border-b border-border transition-colors font-body"
            >
              Magazine
            </button>
            <button
              onClick={() => { navigate("/auth"); setMobileNavOpen(false); }}
              className="text-left text-sm text-muted-foreground hover:text-foreground py-3 border-b border-border transition-colors font-body"
            >
              Sign in
            </button>
            <Button
              onClick={() => { navigate("/register-business"); setMobileNavOpen(false); }}
              className="mt-4 gap-2"
            >
              Get started <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col justify-center pt-16 overflow-hidden">
        {/* Full-bleed background */}
        <div className="absolute inset-0 z-0">
          <img
            src={HERO_IMG}
            alt=""
            aria-hidden
            className="w-full h-full object-cover object-top"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          {/* Left-heavy gradient so text stays readable, image shows right */}
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>

        {/* Content — left-aligned */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 py-24">
          <div className="max-w-xl">

            {/* Tag */}
            <div className={cn("reveal", heroLoaded && "visible")}>
              <Tag label="For modern fashion creators" />
            </div>

            {/* Headline — dramatic clip-path reveal per line */}
            <div className="font-display text-5xl sm:text-6xl lg:text-[5.5rem] font-bold leading-[1.05] mb-8">
              <div className="overflow-hidden">
                <span className={cn("block text-foreground hero-word", heroLoaded && "visible d1")}>
                  A Smart Fashion
                </span>
              </div>
              <div className="overflow-hidden">
                <span className={cn("block text-accent italic hero-word", heroLoaded && "visible d2")}>
                  Catalogue with
                </span>
              </div>
              <div className="overflow-hidden">
                <span className={cn("block text-foreground hero-word", heroLoaded && "visible d3")}>
                  Tailor Measurement Integration.
                </span>
              </div>
            </div>

            {/* Subheadline */}
            <p className={cn("font-body text-base sm:text-lg text-muted-foreground max-w-md leading-relaxed mb-10 reveal d4", heroLoaded && "visible")}>
              Customers, measurements, designs — managed from your own branded portal.
              Built exclusively for tailoring and fashion businesses across the globe.
            </p>

            {/* CTAs */}
            <div className={cn("flex flex-wrap gap-4 reveal d5", heroLoaded && "visible")}>
              <Button size="lg" onClick={() => navigate("/register-business")} className="gap-2">
                Start for free <ArrowRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
                Sign in
              </Button>
            </div>

            {/* Subdomain hint */}
            <div className={cn("mt-10 inline-flex items-center gap-3 border border-border bg-card/60 backdrop-blur-sm px-4 py-3 rounded-lg reveal d6", heroLoaded && "visible")}>
              <span className="font-body text-xs text-muted-foreground">Your portal at</span>
              <code className="text-xs font-mono">
                <span className="text-muted-foreground">https://</span>
                <span className="text-accent font-semibold">yourbrand</span>
                <span className="text-muted-foreground">.rinasfit.com</span>
              </code>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 opacity-30">
          <span className="font-body text-[9px] tracking-[0.2em] uppercase text-foreground">Scroll</span>
          <ChevronDown className="w-3.5 h-3.5 animate-bounce text-foreground" />
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      <div ref={statsRef.ref} className="border-y border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8 grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cn("px-6 text-center reveal-snap", `d${i + 1}`, statsRef.inView && "visible")}
            >
              <p className="font-display text-3xl font-bold text-accent">{s.value}</p>
              <p className="font-body text-[11px] text-muted-foreground uppercase tracking-[0.15em] mt-1">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Editorial / Problem ──────────────────────────────────────────────── */}
      <section
        ref={editorialRef.ref}
        className="max-w-7xl mx-auto px-6 lg:px-10 py-28 grid lg:grid-cols-2 gap-16 lg:gap-24 items-center"
      >
        {/* Left — text */}
        <div className={cn("reveal-left", editorialRef.inView && "visible")}>
          <Tag label="The problem we solve" />
          <h2 className="font-display text-4xl lg:text-5xl font-bold text-foreground leading-tight mb-6">
            Tailoring businesses<br />
            <span className="text-muted-foreground font-normal italic">deserve better</span><br />
            than notebooks.
          </h2>
          <p className="font-body text-sm text-muted-foreground leading-relaxed mb-8 max-w-md">
            Most tailors still manage customers and measurements in notebooks, WhatsApp groups, and
            spreadsheets. Rina's Fit gives every tailoring business a professional digital workspace
            — in minutes, not months.
          </p>
          <div className="h-px bg-gradient-to-r from-accent/30 to-transparent mb-8" />
          <div className="grid grid-cols-2 gap-4">
            {["Customer records", "Measurement history", "Design catalogue", "Staff management"].map(
              (item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <span className="w-1 h-1 rounded-full bg-accent shrink-0" />
                  <span className="font-body text-xs text-muted-foreground">{item}</span>
                </div>
              )
            )}
          </div>
        </div>

        {/* Right — image */}
        <div className={cn("relative h-[480px] hidden lg:block reveal-right", editorialRef.inView && "visible")}>
          <div className="absolute inset-0 overflow-hidden rounded-2xl">
            <img
              src={TAILOR_IMG}
              alt="Tailor at work"
              className="w-full h-full object-cover"
              onError={(e) => {
                const el = e.currentTarget.parentElement as HTMLElement;
                el.classList.add("bg-muted");
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/50 to-transparent rounded-2xl" />
          </div>
          {/* Floating label */}
          <div className="absolute -bottom-6 -left-6 border border-accent/20 bg-card p-5 rounded-xl shadow-xl">
            <p className="font-display text-3xl font-bold text-accent">Africa's</p>
            <p className="font-body text-xs text-muted-foreground mt-1 uppercase tracking-wider">
              tailoring platform
            </p>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section ref={featuresRef.ref} className="border-t border-border bg-card/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-28">
          <div className={cn("mb-16 reveal", featuresRef.inView && "visible")}>
            <Tag label="Platform features" />
            <h2 className="font-display text-4xl font-bold text-foreground">
              Everything in one place
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={cn(
                    "group p-6 rounded-xl border border-border bg-card",
                    "hover:border-accent/40 hover:shadow-lg hover:-translate-y-1",
                    "transition-all duration-300 cursor-default",
                    "reveal-snap",
                    `d${Math.min(i + 1, 6)}`,
                    featuresRef.inView && "visible"
                  )}
                >
                  <div className="w-9 h-9 border border-accent/30 bg-accent/5 rounded-lg flex items-center justify-center mb-6 group-hover:bg-accent/15 transition-colors">
                    <Icon className="w-4 h-4 text-accent" />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-foreground mb-3">
                    {f.title}
                  </h3>
                  <p className="font-body text-sm text-muted-foreground leading-relaxed">
                    {f.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section ref={stepsRef.ref} className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-28">
          <div className={cn("text-center mb-20 reveal", stepsRef.inView && "visible")}>
            <Tag label="Getting started" center />
            <h2 className="font-display text-4xl font-bold text-foreground">
              Up and running in minutes
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-0 relative">
            {/* Animated connector line */}
            <div className="hidden md:block absolute top-[38px] left-[16.67%] right-[16.67%] h-px overflow-hidden">
              <div
                className={cn(
                  "h-full bg-gradient-to-r from-accent/20 via-accent/50 to-accent/20",
                  "transition-all duration-[1400ms] ease-out",
                  stepsRef.inView ? "w-full" : "w-0"
                )}
              />
            </div>

            {steps.map((step, i) => (
              <div
                key={step.num}
                className={cn("px-8 text-center reveal", `d${i + 2}`, stepsRef.inView && "visible")}
              >
                <div className="w-10 h-10 rounded-full border border-accent/35 bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <span className="font-body text-[11px] font-bold text-accent">{step.num}</span>
                </div>
                <div className="font-display text-[64px] font-bold leading-none text-accent/10 select-none -mt-1 mb-2">
                  {step.num}
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Magazine teaser ──────────────────────────────────────────────────── */}
      <section ref={magRef.ref} className="relative border-t border-border overflow-hidden">
        {/* Subtle section background */}
        <div className="absolute inset-0 z-0">
          <img
            src={FASHION_IMG}
            alt=""
            aria-hidden
            className="w-full h-full object-cover"
            onError={() => {}}
          />
          <div className="absolute inset-0 bg-background/92" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 py-28">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left — text */}
            <div className={cn("reveal-left", magRef.inView && "visible")}>
              <Tag label="Fashion magazine" />
              <h2 className="font-display text-4xl lg:text-5xl font-bold text-foreground leading-tight mb-6">
                Showcase your designs<br />
                <span className="text-accent italic">to the world.</span>
              </h2>
              <p className="font-body text-sm text-muted-foreground leading-relaxed mb-8 max-w-md">
                Publish your designs to the Rina's Fit global magazine. Clients across Africa
                discover your work, browse front and back views, and click through to your personal
                catalogue page.
              </p>
              <Button variant="outline" onClick={() => navigate("/magazine")} className="gap-2">
                Browse the magazine <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Right — image grid */}
            <div className={cn("grid grid-cols-2 gap-3 reveal-right", magRef.inView && "visible")}>
              <div className="aspect-[3/4] overflow-hidden rounded-xl hover:scale-[1.02] transition-transform duration-500">
                <img
                  src={FASHION_IMG}
                  alt="Fashion design"
                  className="w-full h-full object-cover"
                  onError={() => {}}
                />
              </div>
              <div className="mt-8 space-y-3">
                <div className="aspect-square overflow-hidden rounded-xl hover:scale-[1.02] transition-transform duration-500">
                  <img
                    src={FABRIC_IMG}
                    alt="Fabric detail"
                    className="w-full h-full object-cover"
                    onError={() => {}}
                  />
                </div>
                <div className="border border-accent/20 bg-accent/5 p-4 rounded-xl">
                  <p className="font-display text-sm font-semibold text-foreground mb-1">
                    Your catalogue
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    slug.rinasfit.com/catalogue
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Subdomain showcase ───────────────────────────────────────────────── */}
      <section className="border-t border-border bg-card/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-28 text-center">
          <Tag label="White-labelled" center />
          <h2 className="font-display text-4xl font-bold text-foreground mb-6">
            Your brand. Your portal.
          </h2>
          <p className="font-body text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed mb-12">
            Every business gets their own branded login page with their logo and business name —
            completely separate from every other organisation on the platform.
          </p>

          {/* Mock browser */}
          <div className="max-w-2xl mx-auto border border-border bg-card overflow-hidden rounded-xl shadow-2xl">
            {/* Browser chrome */}
            <div className="border-b border-border px-4 py-3 flex items-center gap-3 bg-muted/50">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-destructive/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-warning/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-success/50" />
              </div>
              <div className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-[11px] font-mono text-left text-muted-foreground">
                https://<span className="text-accent font-semibold">yourbrand</span>.rinasfit.com
              </div>
            </div>
            {/* Fake login UI */}
            <div className="p-8 flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                <span className="font-display text-lg font-bold text-accent">B</span>
              </div>
              <div className="text-center">
                <p className="font-display text-base font-semibold text-foreground">
                  Sign in to Your Brand
                </p>
                <p className="font-body text-xs text-muted-foreground mt-1">
                  Powered by Rina's Fit
                </p>
              </div>
              <div className="w-full max-w-xs space-y-2">
                <div className="h-9 bg-muted border border-border rounded-lg" />
                <div className="h-9 bg-muted border border-border rounded-lg" />
                <div className="h-9 bg-primary rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── About the Founder ──────────────────────────────────────────────── */}
      <section id="about" ref={founderRef.ref} className="border-t border-border scroll-mt-20">
            <div className="max-w-7xl mx-auto px-6 lg:px-10 py-28 grid lg:grid-cols-[340px_1fr] gap-16 items-start">

              {/* Left — photo + name */}
              <div className={cn("flex flex-col items-center lg:items-start gap-6 reveal-left", founderRef.inView && "visible")}>
                <div className="w-48 h-48 rounded-2xl overflow-hidden border border-border shadow-lg">
                  <img
                    src={fallbackLogo}
                    alt="Uzoamaka Favour Oluchi — Rina"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-center lg:text-left">
                  <h3 className="font-display text-xl font-bold text-foreground">Uzoamaka Favour Oluchi</h3>
                  <p className="font-body text-sm text-accent font-medium mt-1">Founder — Rina's Fit</p>
                  <p className="font-body text-xs text-muted-foreground mt-1">Fashion Designer · Tech Enthusiast</p>
                </div>
              </div>

              {/* Right — bio */}
              <div className={cn("reveal-right", founderRef.inView && "visible")}>
                <Tag label="Meet the founder" />
                <h2 className="font-display text-4xl font-bold text-foreground leading-tight mb-8">
                  Bridging fashion<br />
                  <span className="text-accent italic">& technology.</span>
                </h2>

                <div className="space-y-5 font-body text-sm text-muted-foreground leading-relaxed max-w-xl">
                  <p>
                    My name is <span className="text-foreground font-medium">Uzoamaka Favour Oluchi</span>, popularly known as <span className="text-accent font-semibold">Rina</span>. I am a student of ESTAM University, currently studying in Cotonou, with my roots in Nigeria. I am both a tech enthusiast and a fashion designer, combining creativity with technology to solve real-life problems in the fashion industry.
                  </p>
                  <p>
                    The idea behind Rina's Fit came from my personal experience as a fashion designer. I noticed that most times, it is difficult to fully visualize a dress design, especially when only partial references are available. In addition, recording measurements in notebooks can be stressful and unreliable. There were situations where I was away from home and needed to recall measurements for my sisters, and it required a lot of effort trying to remember or access those details.
                  </p>
                  <p>
                    These challenges inspired me to develop a smarter solution — a web-based system that integrates fashion catalogues with accurate measurement storage. Rina's Fit is designed to help designers organize their work, access customer measurements anytime, and present complete fashion designs clearly.
                  </p>
                </div>

                {/* Vision */}
                <div className="mt-10 border-l-2 border-accent/40 pl-6">
                  <h3 className="font-display text-lg font-semibold text-foreground mb-3">Vision</h3>
                  <p className="font-body text-sm text-muted-foreground leading-relaxed max-w-xl">
                    My vision is to bridge the gap between fashion and technology by creating simple, accessible, and efficient digital tools that empower fashion designers to work smarter, reduce errors, and deliver better results.
                  </p>
                  <p className="font-body text-sm text-muted-foreground leading-relaxed max-w-xl mt-3">
                    Through Rina's Fit, I aim to transform the traditional tailoring process into a more structured, reliable, and modern experience.
                  </p>
                </div>
              </div>
            </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section ref={ctaRef.ref} className="relative border-t border-border overflow-hidden">
        {/* Background with overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={TAILOR_IMG}
            alt=""
            aria-hidden
            className="w-full h-full object-cover"
            onError={() => {}}
          />
          <div className="absolute inset-0 bg-background/88" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 py-32 text-center">
          <div className={cn("reveal", ctaRef.inView && "visible")}>
            <Tag label="Join Rina's Fit" center />
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] max-w-3xl mx-auto mb-8">
              Your digital atelier<br />
              <span className="text-muted-foreground font-normal italic">starts today.</span>
            </h2>
            <p className="font-body text-sm text-muted-foreground max-w-sm mx-auto mb-10">
              No credit card required. Set up your organisation in under two minutes.
            </p>
            <Button
              size="lg"
              onClick={() => navigate("/register-business")}
              className="gap-2 text-base px-8"
            >
              Create your free account <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={fallbackLogo}
              alt="Rina's Fit"
              className="w-6 h-6 object-contain rounded opacity-60"
            />
            <span className="font-body text-xs text-muted-foreground">Rina's Fit</span>
            <span className="text-border">·</span>
            <span className="font-body text-[9px] font-bold tracking-[0.15em] uppercase text-accent/60">
              Digital Atelier
            </span>
          </div>

          <div className="flex items-center gap-6">
            {(
              [
                ["Magazine", "/magazine"],
                ["Sign in", "/auth"],
                ["Register", "/register-business"],
              ] as const
            ).map(([label, path]) => (
              <button
                key={label}
                onClick={() => navigate(path)}
                className="font-body text-xs text-muted-foreground hover:text-accent transition-colors"
              >
                {label}
              </button>
            ))}
          </div>

          <p className="font-body text-[11px] text-muted-foreground/50">
            © {new Date().getFullYear()} Rina's Fit. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
