"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth/AuthProvider";

export default function MarketingPage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".marketing");
    if (!root) return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileQuery = window.matchMedia("(max-width: 760px)");
    // Pinned-stage scroll-jacking is desktop-only (the max-width:760px rules
    // in marketing.css collapse stages to normal stacked sections) — below
    // that breakpoint, skip the p1-p4 scroll math entirely rather than let
    // it hit a degenerate "stage height == viewport height" edge case.
    const reduced = reducedMotionQuery.matches || mobileQuery.matches;

    const cleanups: Array<() => void> = [];

    // ── word split ─────────────────────────────────────────────
    function splitHeadline(headline: Element) {
      const src = headline.querySelector("[data-text]");
      if (!src) return;
      let i = 0;
      const frag = document.createDocumentFragment();
      function wrapWord(text: string | null, accent: boolean) {
        if (!text) return;
        const span = document.createElement("span");
        span.className = "word" + (accent ? " word--accent" : "");
        span.style.setProperty("--i", String(i++));
        span.textContent = text;
        frag.appendChild(span);
        frag.appendChild(document.createTextNode(" "));
      }
      src.childNodes.forEach((node) => {
        if (node.nodeType === 3) {
          (node.textContent ?? "").split(/\s+/).filter(Boolean).forEach((w) => wrapWord(w, false));
        } else if (node.nodeType === 1 && (node as Element).tagName === "EM") {
          wrapWord((node as Element).textContent, true);
        }
      });
      src.innerHTML = "";
      src.appendChild(frag);
    }
    root.querySelectorAll(".split").forEach(splitHeadline);

    // ── reveal observer ──────────────────────────────────────────
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    root.querySelectorAll(".split, [data-rev]").forEach((el) => io.observe(el));
    cleanups.push(() => io.disconnect());

    const heroHeadline = document.getElementById("heroHeadline");
    const heroTimeout = window.setTimeout(() => {
      if (heroHeadline) {
        heroHeadline.classList.add("is-in");
        io.unobserve(heroHeadline);
      }
      root.querySelectorAll(".stage--hero [data-rev]").forEach((el) => {
        el.classList.add("is-in");
        io.unobserve(el);
      });
    }, 120);
    cleanups.push(() => window.clearTimeout(heroTimeout));

    // ── scroll-driven custom properties ───────────────────────────
    const docEl = document.documentElement;
    const stageIds = ["stage1", "stage2", "stage3", "stage4"];
    const stages = stageIds.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    let ticking = false;
    let lastLogIdx = -1;

    function progress(el: HTMLElement): number {
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      if (total <= 0) return rect.top <= 0 ? 1 : 0;
      const scrolled = -rect.top;
      if (scrolled < 0) return 0;
      if (scrolled > total) return 1;
      return scrolled / total;
    }

    function updateLogRows(p4: number) {
      const idx = Math.min(4, Math.floor(p4 * 5));
      if (idx === lastLogIdx) return;
      lastLogIdx = idx;
      root!.querySelectorAll(".log__row").forEach((row) => {
        const n = parseInt(row.getAttribute("data-row") ?? "0", 10);
        row.classList.toggle("is-lit", n <= idx);
      });
    }

    function onScroll() {
      if (reduced) return;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (stages.length === 4) {
            const values = stages.map(progress);
            const p1 = values[0] ?? 0;
            const p2 = values[1] ?? 0;
            const p3 = values[2] ?? 0;
            const p4 = values[3] ?? 0;
            docEl.style.setProperty("--p1", p1.toFixed(4));
            docEl.style.setProperty("--p2", p2.toFixed(4));
            docEl.style.setProperty("--p3", p3.toFixed(4));
            docEl.style.setProperty("--p4", p4.toFixed(4));
            updateLogRows(p4);
          }
          ticking = false;
        });
        ticking = true;
      }
    }
    if (!reduced) {
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => window.removeEventListener("scroll", onScroll));
      onScroll();
    } else {
      root.querySelectorAll(".log__row").forEach((r) => r.classList.add("is-lit"));
    }

    // ── phyllotaxis star field ─────────────────────────────────────
    const canvas = document.getElementById("stars") as HTMLCanvasElement | null;
    if (canvas && !reduced) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const COUNT = 220;
        const stars = Array.from({ length: COUNT }, (_, i) => ({
          angle: i * 2.399963,
          radius: Math.sqrt(i / COUNT),
          phase: Math.random() * Math.PI * 2,
          speed: 0.6 + Math.random() * 0.9,
          coral: i % 23 === 0,
        }));
        let rotation = 0;
        let running = false;
        let rafId: number | null = null;
        let lastT: number | null = null;

        function resize() {
          const size = canvas!.clientWidth * (window.devicePixelRatio || 1);
          canvas!.width = size;
          canvas!.height = size;
        }
        resize();
        window.addEventListener("resize", resize);
        cleanups.push(() => window.removeEventListener("resize", resize));

        function draw(t: number) {
          if (lastT === null) lastT = t;
          const dt = (t - lastT) / 1000;
          lastT = t;
          rotation += 0.035 * dt;

          const w = canvas!.width;
          const h = canvas!.height;
          const cx = w / 2;
          const cy = h / 2;
          const R = Math.min(w, h) * 0.46;

          ctx!.clearRect(0, 0, w, h);
          ctx!.strokeStyle = "rgba(240,229,212,0.08)";
          ctx!.lineWidth = 1;
          [0.5, 0.82].forEach((f) => {
            ctx!.beginPath();
            ctx!.arc(cx, cy, R * f, 0, Math.PI * 2);
            ctx!.stroke();
          });

          stars.forEach((s) => {
            const a = s.angle + rotation;
            const r = s.radius * R;
            const x = cx + Math.cos(a) * r;
            const y = cy + Math.sin(a) * r;
            const tw = 0.35 + 0.65 * Math.abs(Math.sin((t / 1000) * s.speed + s.phase));
            const size = s.coral ? 2.4 : 1.5;
            ctx!.beginPath();
            ctx!.arc(x, y, size, 0, Math.PI * 2);
            ctx!.fillStyle = s.coral ? `rgba(226,112,90,${tw.toFixed(3)})` : `rgba(245,237,226,${(tw * 0.9).toFixed(3)})`;
            ctx!.fill();
          });

          if (running) rafId = window.requestAnimationFrame(draw);
        }

        const fieldObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting && !running) {
                running = true;
                lastT = null;
                rafId = window.requestAnimationFrame(draw);
              } else if (!entry.isIntersecting && running) {
                running = false;
                if (rafId !== null) window.cancelAnimationFrame(rafId);
              }
            });
          },
          { threshold: 0.05 },
        );
        fieldObserver.observe(canvas);
        cleanups.push(() => {
          running = false;
          if (rafId !== null) window.cancelAnimationFrame(rafId);
          fieldObserver.disconnect();
        });
      }
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return (
    <div className="marketing">
      <div className="grain" aria-hidden="true" />

      <nav className="nav">
        <span className="nav__mark">
          taskflow<em>.</em>
        </span>
        <div className="nav__links mono">
          <a href="#capabilities">Product</a>
          <a href="#how-it-works">How it works</a>
          <a href="#faq">FAQ</a>
          <Link href="/login">Sign in</Link>
        </div>
      </nav>

      {/* ══════════════════════ HERO ══════════════════════ */}
      <section className="stage stage--hero" id="stage1">
        <div className="stage__inner">
          <div className="hero__art" aria-hidden="true">
            <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
              <g opacity="0.5">
                <rect x="1120" y="140" width="220" height="150" rx="3" fill="none" stroke="#E2705A" strokeOpacity=".35" />
                <rect x="1180" y="330" width="170" height="120" rx="3" fill="none" stroke="#F0E5D4" strokeOpacity=".18" />
                <rect x="980" y="420" width="240" height="160" rx="3" fill="none" stroke="#F0E5D4" strokeOpacity=".12" />
                <rect x="200" y="620" width="200" height="140" rx="3" fill="none" stroke="#E2705A" strokeOpacity=".22" />
                <rect x="60" y="230" width="180" height="130" rx="3" fill="none" stroke="#F0E5D4" strokeOpacity=".14" />
                <line x1="1230" y1="290" x2="1230" y2="330" stroke="#E2705A" strokeOpacity=".3" />
                <line x1="1100" y1="500" x2="980" y2="500" stroke="#F0E5D4" strokeOpacity=".12" />
              </g>
            </svg>
          </div>
          <div className="hero__veil" />
          <div className="hero__content">
            <p className="hero__strap strap" data-rev>
              Task &amp; project management
            </p>
            <h1 className="hero__headline split" id="heroHeadline">
              <span data-text>
                Assign the work. Let the system handle the <em>rest.</em>
              </span>
            </h1>
            <div className="hero__foot mono">
              <span data-rev style={{ "--d": "120ms" } as React.CSSProperties}>
                Projects &amp; tasks in one place
              </span>
              <span data-rev style={{ "--d": "180ms" } as React.CSSProperties}>
                Work assigned to the right person
              </span>
              <span data-rev style={{ "--d": "240ms" } as React.CSSProperties}>
                Notifications that don&apos;t get lost
              </span>
              <span data-rev style={{ "--d": "300ms" } as React.CSSProperties}>
                Every organization kept separate
              </span>
            </div>
            <div className="hero__cta" data-rev style={{ "--d": "360ms" } as React.CSSProperties}>
              <Link className="btn" href="/register">
                Get started free
              </Link>
              <Link className="btn btn--ghost" href="/login">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ FRAME — the board ══════════════════════ */}
      <section className="stage stage--frame" id="stage2">
        <div className="stage__inner">
          <div className="frame__numeral">02</div>
          <div className="frame__photo" aria-hidden="true">
            <div className="mockboard">
              <div className="mockboard__top">
                <span className="mockboard__dot" />
                <span className="mockboard__dot" />
                <span className="mockboard__dot" />
                <span className="mockboard__title">northstar labs / customer portal refresh</span>
              </div>
              <div className="mockboard__cols">
                <div className="mockboard__col">
                  <div className="mockboard__colhead">
                    <span>To do</span>
                    <span>5</span>
                  </div>
                  <div className="mockboard__card">
                    <b>Draft onboarding copy</b>
                    <div className="mockboard__bar" />
                  </div>
                  <div className="mockboard__card">
                    <b>Audit legacy endpoints</b>
                    <div className="mockboard__bar" style={{ width: "30%" }} />
                  </div>
                  <div className="mockboard__card is-ghost" />
                  <div className="mockboard__card is-ghost" />
                </div>
                <div className="mockboard__col">
                  <div className="mockboard__colhead">
                    <span>In progress</span>
                    <span>2</span>
                  </div>
                  <div className="mockboard__card">
                    <b>Refresh-token rotation</b>
                    <div className="mockboard__bar" style={{ width: "70%" }} />
                  </div>
                  <div className="mockboard__card">
                    <b>Dashboard counts</b>
                    <div className="mockboard__bar" style={{ width: "45%" }} />
                  </div>
                  <div className="mockboard__card is-ghost" />
                </div>
                <div className="mockboard__col">
                  <div className="mockboard__colhead">
                    <span>Review</span>
                    <span>1</span>
                  </div>
                  <div className="mockboard__card">
                    <b>Assignment email copy</b>
                    <div className="mockboard__bar" style={{ width: "85%" }} />
                  </div>
                  <div className="mockboard__card is-ghost" />
                  <div className="mockboard__card is-ghost" />
                </div>
                <div className="mockboard__col">
                  <div className="mockboard__colhead">
                    <span>Done</span>
                    <span>4</span>
                  </div>
                  <div className="mockboard__card is-done">
                    <b>Org-scoped auth</b>
                    <div className="mockboard__bar" />
                  </div>
                  <div className="mockboard__card is-done">
                    <b>Swagger docs</b>
                    <div className="mockboard__bar" />
                  </div>
                  <div className="mockboard__card is-ghost" />
                </div>
              </div>
            </div>
          </div>
          <div className="frame__caption">
            <div className="frame__scrim" />
            <p className="eyebrow" data-rev id="capabilities">
              The board
            </p>
            <h2 className="frame__headline split">
              <span data-text>
                See the whole board, not just your <em>corner.</em>
              </span>
            </h2>
          </div>
        </div>
      </section>

      {/* ══════════════════════ IRIS — how it works ══════════════════════ */}
      <section className="stage stage--iris" id="stage3">
        <div className="stage__inner">
          <div className="iris__photo" aria-hidden="true">
            <svg viewBox="0 0 800 800">
              <g stroke="#33291E" strokeOpacity=".28" strokeWidth="1.4">
                <line x1="230" y1="260" x2="330" y2="330" />
                <line x1="230" y1="260" x2="180" y2="380" />
                <line x1="330" y1="330" x2="180" y2="380" />
                <line x1="330" y1="330" x2="300" y2="470" />
                <line x1="180" y1="380" x2="300" y2="470" />
                <line x1="560" y1="300" x2="640" y2="410" />
                <line x1="560" y1="300" x2="480" y2="420" />
                <line x1="640" y1="410" x2="560" y2="520" />
                <line x1="480" y1="420" x2="560" y2="520" />
              </g>
              <g>
                <circle cx="230" cy="260" r="15" fill="#C64A32" />
                <circle cx="330" cy="330" r="11" fill="#33291E" fillOpacity=".55" />
                <circle cx="180" cy="380" r="11" fill="#33291E" fillOpacity=".55" />
                <circle cx="300" cy="470" r="11" fill="#33291E" fillOpacity=".55" />
                <circle cx="255" cy="200" r="9" fill="#33291E" fillOpacity=".4" />
                <circle cx="560" cy="300" r="15" fill="#C64A32" />
                <circle cx="640" cy="410" r="11" fill="#33291E" fillOpacity=".55" />
                <circle cx="480" cy="420" r="11" fill="#33291E" fillOpacity=".55" />
                <circle cx="560" cy="520" r="11" fill="#33291E" fillOpacity=".55" />
              </g>
            </svg>
          </div>
          <p className="eyebrow iris__eyebrow" data-rev id="how-it-works">
            How it works
          </p>
          <h2 className="iris__headline split">
            <span data-text>
              One team. <em>Everyone&apos;s</em> work in view.
            </span>
          </h2>
          <div className="iris__captions mono">
            <span data-rev>Northstar Labs — 5 members</span>
            <span data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
              Blue Orbit Studio — 3 members
            </span>
          </div>
        </div>
      </section>

      {/* ══════════════════════ LOG — reliable execution ══════════════════════ */}
      <section className="stage stage--log" id="stage4">
        <div className="stage__inner">
          <div className="log__inner">
            <div className="log__col">
              <p className="log__eyebrow strap" data-rev>
                Reliable execution
              </p>
              <h2 className="log__headline split">
                <span data-text>
                  Every assignment queues a <em>job.</em>
                </span>
              </h2>
              <p data-rev style={{ color: "var(--muted-dark)", fontSize: "13.5px", maxWidth: "36ch", margin: "-16px 0 28px" }}>
                If a notification fails to send, TaskFlow retries automatically — nothing just disappears.
              </p>
              <div className="log__rows" id="logRows">
                <div className="log__row" data-row="0">
                  <span className="mono">00:00:01</span>
                  <strong>task_assigned enqueued</strong>
                  <em>Redis / BullMQ picks it up instantly</em>
                </div>
                <div className="log__row" data-row="1">
                  <span className="mono">00:00:02</span>
                  <strong>attempt 1 / 3</strong>
                  <em>Email dispatch begins</em>
                </div>
                <div className="log__row" data-row="2">
                  <span className="mono">00:00:04</span>
                  <strong>retry · backoff 2s</strong>
                  <em>Transient failure, retried automatically</em>
                </div>
                <div className="log__row" data-row="3">
                  <span className="mono">00:00:08</span>
                  <strong>retry · backoff 4s</strong>
                  <em>Third attempt, exponential backoff</em>
                </div>
                <div className="log__row" data-row="4">
                  <span className="mono">00:00:12</span>
                  <strong>moved to dead-letter queue</strong>
                  <em>Exhausted retries land here, not lost</em>
                </div>
              </div>
            </div>
            <div className="log__field">
              <canvas id="stars" width="800" height="800" aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ KEY FEATURES ══════════════════════ */}
      <section className="band band--explainer">
        <div className="col">
          <p className="mono-label mono" data-rev>
            Multi-tenant &amp; secure
          </p>
          <h3 data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
            Every organization keeps to itself
          </h3>
          <p data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
            JWT access tokens, rotating refresh tokens, and organization-scoped access control — cross-tenant requests are
            rejected at the data layer, not just hidden in the UI.
          </p>
        </div>
        <div className="col">
          <p className="mono-label mono" data-rev>
            Built for real work
          </p>
          <h3 data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
            Boards, filters, and dashboards
          </h3>
          <p data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
            Projects, tasks, assignment, due-date and assignee filtering, pagination, and a per-project status dashboard —
            the everyday shape of managing work.
          </p>
        </div>
        <div className="col">
          <p className="mono-label mono" data-rev>
            Reliable by design
          </p>
          <h3 data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
            Failures don&apos;t disappear
          </h3>
          <p data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
            Three retry attempts with exponential backoff, then a dead-letter queue — so a failed notification is
            visible, never silently lost.
          </p>
        </div>
      </section>

      {/* ══════════════════════ ARCHITECTURE ══════════════════════ */}
      <section className="band band--stack" id="stack">
        <div className="band__head">
          <p className="strap mono" data-rev style={{ color: "var(--coral-soft)" }}>
            Under the hood
          </p>
          <h2 data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
            Ordinary tools, used <em>carefully.</em>
          </h2>
        </div>
        <p className="band__lede" data-rev style={{ "--d": "60ms" } as React.CSSProperties}>
          Projects and tasks live in PostgreSQL. Assigning someone to a task enqueues a background job in Redis — a
          separate worker process picks it up, retries automatically on failure, and routes anything it can&apos;t
          deliver to a dead-letter queue instead of losing it.
        </p>
        <div className="stack__table">
          <div className="stack__row">
            <span className="label" data-rev>
              Runtime
            </span>
            <span className="value mono" data-rev>
              Node.js 24 · TypeScript · Express 5
            </span>
          </div>
          <div className="stack__row">
            <span className="label" data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
              Database
            </span>
            <span className="value mono" data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
              PostgreSQL 17 via Prisma
            </span>
          </div>
          <div className="stack__row">
            <span className="label" data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
              Queue
            </span>
            <span className="value mono" data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
              Redis + BullMQ · 3 attempts · 1s / 2s / 4s
            </span>
          </div>
          <div className="stack__row">
            <span className="label" data-rev style={{ "--d": "120ms" } as React.CSSProperties}>
              Auth
            </span>
            <span className="value mono" data-rev style={{ "--d": "120ms" } as React.CSSProperties}>
              JWT access + rotating refresh tokens
            </span>
          </div>
          <div className="stack__row">
            <span className="label" data-rev style={{ "--d": "160ms" } as React.CSSProperties}>
              Testing
            </span>
            <span className="value mono" data-rev style={{ "--d": "160ms" } as React.CSSProperties}>
              Vitest · Supertest · CI on every push
            </span>
          </div>
          <div className="stack__row">
            <span className="label" data-rev style={{ "--d": "200ms" } as React.CSSProperties}>
              Deploy
            </span>
            <span className="value mono" data-rev style={{ "--d": "200ms" } as React.CSSProperties}>
              Docker Compose · Render · GitHub Actions
            </span>
          </div>
        </div>
      </section>

      {/* ══════════════════════ FAQ ══════════════════════ */}
      <section className="band band--faq" id="faq">
        <h2 data-rev>Questions</h2>
        <div className="faq__item">
          <h4 data-rev>What is TaskFlow?</h4>
          <p data-rev>
            A project and task management platform built for teams that need real accountability: every project and
            task belongs to an organization, every assignment is tracked, and background notifications are delivered
            reliably instead of silently failing.
          </p>
        </div>
        <div className="faq__item">
          <h4 data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
            How does task execution work?
          </h4>
          <p data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
            Assigning someone to a task queues a background job instead of blocking the request. A separate worker
            picks it up and sends the notification, so assigning work stays fast even when email delivery is slow.
          </p>
        </div>
        <div className="faq__item">
          <h4 data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
            What happens when a job fails?
          </h4>
          <p data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
            It retries automatically — three attempts with exponential backoff (1s, 2s, 4s). If every attempt fails,
            the job moves to a dead-letter queue instead of disappearing. On the hosted demo, background workers
            aren&apos;t running continuously (see the architecture note above), so jobs may stay queued — running the
            full stack locally via Docker Compose processes them end to end.
          </p>
        </div>
        <div className="faq__item">
          <h4 data-rev style={{ "--d": "120ms" } as React.CSSProperties}>
            How does organization isolation work?
          </h4>
          <p data-rev style={{ "--d": "120ms" } as React.CSSProperties}>
            Every project and task is scoped to an organization at the database query level. Access tokens carry the
            organization and role, and cross-tenant requests — even well-formed ones — are rejected with a 403, not
            just hidden in the interface.
          </p>
        </div>
        <div className="faq__item">
          <h4 data-rev style={{ "--d": "160ms" } as React.CSSProperties}>
            Can TaskFlow integrate with another application?
          </h4>
          <p data-rev style={{ "--d": "160ms" } as React.CSSProperties}>
            TaskFlow exposes a documented REST API (OpenAPI/Swagger), so any application that can make authenticated
            HTTP requests can create projects, assign tasks, or check job status programmatically.
          </p>
        </div>
        <div className="faq__item">
          <h4 data-rev style={{ "--d": "200ms" } as React.CSSProperties}>
            Is the source code available?
          </h4>
          <p data-rev style={{ "--d": "200ms" } as React.CSSProperties}>
            Yes — the backend and frontend are both open on GitHub.
          </p>
        </div>
      </section>

      {/* ══════════════════════ FINAL CTA ══════════════════════ */}
      <section className="band band--cta">
        <h2 data-rev>
          Your team&apos;s work, <em>organized.</em>
        </h2>
        <p data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
          Create an account, or sign in with the demo data to explore projects, tasks, and live assignment
          notifications.
        </p>
        <div className="btn-row" data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
          <Link className="btn" href="/register">
            Get started free
          </Link>
          <Link className="btn btn--ghost" href="/login">
            Sign in
          </Link>
        </div>
      </section>

      <footer className="footer mono">
        <div className="footer__brand">
          <strong>taskflow.</strong>
          <span className="footer__note">Project and task management, built for reliability.</span>
          <span className="footer__note">Built by Prateek Saxena</span>
        </div>
        <div className="footer__row">
          <span className="footer__note">
            <a href="#stack">See the architecture</a>
          </span>
          <div className="footer__links">
            <a href="https://github.com/maxsilver9890/taskflow-backend">GitHub</a>
            <a href="https://taskflow-backend-api-7iwy.onrender.com/api-docs">API docs</a>
            <a href="#stage1">Back to top</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
