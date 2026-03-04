import { useState, useRef, useEffect } from "react";

const C = {
  bg: "#07090F",
  panel: "#0C0F1A",
  card: "#111520",
  border: "#1A2035",
  borderHi: "#2A3555",
  accent: "#7C5CFC",
  green: "#00E5A0",
  gold: "#F5C518",
  coral: "#FF5E5E",
  blue: "#3B9EFF",
  pink: "#FF4FA0",
  text: "#DDE2F0",
  muted: "#5A6688",
  dim: "#3A4465",
};

const PHASES = [
  {
    id: 1, title: "Foundation & Auth", subtitle: "User system + live site baseline",
    status: "active", eta: "Week 1–2", color: C.green,
    tasks: [
      { id: "1a", title: "Supabase Auth",       desc: "Email/password + Google OAuth. Artist profiles stored in DB.",           status: "next",  effort: "M", file: "src/lib/auth.js"            },
      { id: "1b", title: "Profile Pages",        desc: "Public artist profile: bio, portfolio grid, follower count, shop link.", status: "next",  effort: "M", file: "src/pages/Profile.jsx"      },
      { id: "1c", title: "Netlify Env Vars",     desc: "Move all API keys out of frontend into Netlify Functions.",              status: "ready", effort: "S", file: "netlify/functions/api.js"   },
      { id: "1d", title: "GA4 Analytics",        desc: "Google Analytics 4 tracking: page views, Ares usage, product clicks.",  status: "ready", effort: "S", file: "index.html"                 },
    ],
  },
  {
    id: 2, title: "Ares AI Engine", subtitle: "Secure API + image generation",
    status: "queued", eta: "Week 2–3", color: C.accent,
    tasks: [
      { id: "2a", title: "Netlify Fn: Ares",     desc: "Server-side Claude API calls. API key never exposed to browser.",        status: "queued", effort: "S", file: "netlify/functions/ares.js"    },
      { id: "2b", title: "Gemini Image Gen",      desc: "Ares generates art via Gemini API. Returns image to frontend.",          status: "queued", effort: "L", file: "netlify/functions/imagine.js" },
      { id: "2c", title: "Prompt History",        desc: "Save each artist's prompts + outputs to Supabase.",                      status: "queued", effort: "M", file: "src/lib/prompts.js"           },
      { id: "2d", title: "Style Reference Upload",desc: "Artist uploads a ref image. Ares matches aesthetic in all generations.", status: "queued", effort: "L", file: "src/components/StyleLock.jsx" },
    ],
  },
  {
    id: 3, title: "Printful Integration", subtitle: "Product creation + order sync",
    status: "queued", eta: "Week 3–4", color: C.gold,
    tasks: [
      { id: "3a", title: "Printful OAuth",        desc: "Connect artist's Printful account. Store tokens in Supabase.",           status: "queued", effort: "M", file: "netlify/functions/printful-auth.js"    },
      { id: "3b", title: "Product Creator",       desc: "AI art → select product → auto-create mockup via Printful API.",         status: "queued", effort: "L", file: "src/components/ProductCreator.jsx"     },
      { id: "3c", title: "Shop Sync",             desc: "Pull artist's Printful products into their Dreamscape storefront.",       status: "queued", effort: "M", file: "src/pages/Shop.jsx"                    },
      { id: "3d", title: "Order Webhooks",        desc: "Printful order events → update artist dashboard in real-time.",          status: "queued", effort: "M", file: "netlify/functions/printful-webhook.js" },
    ],
  },
  {
    id: 4, title: "Marketplace & Channels", subtitle: "Commerce + community feed",
    status: "queued", eta: "Week 4–6", color: C.blue,
    tasks: [
      { id: "4a", title: "Product Marketplace",   desc: "Browse/search/filter all artist products. Cart + Stripe checkout.",      status: "queued", effort: "L", file: "src/pages/Marketplace.jsx"  },
      { id: "4b", title: "Live Channels DB",      desc: "Channel posts in Supabase. Real-time updates via Supabase Realtime.",    status: "queued", effort: "L", file: "src/lib/channels.js"         },
      { id: "4c", title: "Stripe Payouts",        desc: "Artists get paid. Marketplace fee logic + Stripe Connect for splits.",   status: "queued", effort: "L", file: "netlify/functions/stripe.js" },
      { id: "4d", title: "Notifications",         desc: "In-app + email alerts: new followers, sales, channel mentions.",         status: "queued", effort: "M", file: "src/lib/notifications.js"    },
    ],
  },
  {
    id: 5, title: "Growth & Analytics", subtitle: "SEO, A/B tests, dashboards",
    status: "queued", eta: "Week 6–8", color: C.pink,
    tasks: [
      { id: "5a", title: "Artist Dashboard",      desc: "Revenue, top products, channel engagement, follower growth charts.",     status: "queued", effort: "M", file: "src/pages/Dashboard.jsx"    },
      { id: "5b", title: "SEO: Artist Pages",     desc: "Dynamic meta tags per profile. Sitemap generation. Schema markup.",     status: "queued", effort: "M", file: "src/lib/seo.js"             },
      { id: "5c", title: "A/B Test Framework",    desc: "Test hero copy, CTA colors, channel layouts. Track via GA4.",           status: "queued", effort: "M", file: "src/lib/experiments.js"     },
      { id: "5d", title: "Referral System",       desc: "Artists share invite links. Track conversions. Reward with discounts.", status: "queued", effort: "L", file: "src/lib/referral.js"        },
    ],
  },
];

const API_STACK = [
  { name: "Supabase",    role: "Database + Auth + Realtime",  color: C.green,  icon: "🗄️", docs: "supabase.com/docs",       priority: 1 },
  { name: "Anthropic",  role: "Ares AI (Claude)",            color: C.accent, icon: "⚡",  docs: "docs.anthropic.com",      priority: 1 },
  { name: "Gemini",     role: "AI Image Generation",         color: C.blue,   icon: "🎨", docs: "ai.google.dev",           priority: 1 },
  { name: "Printful",   role: "Print-on-Demand Products",    color: C.gold,   icon: "🖨️", docs: "developers.printful.com", priority: 1 },
  { name: "Stripe",     role: "Payments + Artist Payouts",   color: C.green,  icon: "💳", docs: "stripe.com/docs",         priority: 2 },
  { name: "Netlify",    role: "Hosting + Serverless Fn",     color: C.blue,   icon: "🚀", docs: "docs.netlify.com",        priority: 1 },
  { name: "GA4",        role: "Analytics + A/B Tracking",    color: C.coral,  icon: "📊", docs: "analytics.google.com",    priority: 2 },
  { name: "Cloudinary", role: "Image Storage + CDN",         color: C.pink,   icon: "☁️", docs: "cloudinary.com/docs",     priority: 2 },
];

const DEPLOY_LOG = [
  { time: "Today",   msg: "trydreamscape.com live on Netlify",         type: "deploy",  status: "success" },
  { time: "Today",   msg: "GitHub repo connected, auto-deploy active", type: "git",     status: "success" },
  { time: "Today",   msg: "Channels feature shipped",                  type: "feature", status: "success" },
  { time: "Pending", msg: "Netlify Function: secure Ares API calls",   type: "task",    status: "pending" },
  { time: "Pending", msg: "Supabase project setup + schema",           type: "task",    status: "pending" },
];

function AresChat() {
  const [msgs, setMsgs] = useState([
    { role: "ares", text: "Dreamscape is live at trydreamscape.com 🚀\n\nI'm ready to start writing code. Tell me which task to tackle first and I'll output the complete file — you review it, approve it, and we push to GitHub. Netlify deploys automatically.\n\nRecommended first move: secure the Anthropic API key inside a Netlify Function so it's never exposed in the browser. Want me to write that now?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async () => {
    if (!input.trim()) return;
    const msg = input; setInput("");
    setMsgs(p => [...p, { role: "user", text: msg }]);
    setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 2000,
          system: `You are Ares, the AI engineering partner for Dreamscape (trydreamscape.com) — an artist social media platform and marketplace. The site is LIVE on Netlify, connected to GitHub for auto-deploy. Stack: React + Vite, Netlify Functions (serverless JS), Supabase (DB + auth), Printful API, Anthropic API, Gemini API, Stripe.

Your job: write actual JavaScript/JSX code when asked. Output complete, copy-paste-ready files. When Kingsley approves, he pushes to GitHub and Netlify auto-deploys.

Current priorities:
1. Move Anthropic API key to Netlify Function (netlify/functions/ares.js)
2. Add Supabase auth
3. Connect Printful API
4. Add Gemini image generation

Always be specific. When writing code, output the full file with filename at the top. Be concise but complete. If asked for a plan, give bullet points with file names and exact steps.`,
          messages: [
            ...msgs.filter(m => m.role !== "ares").map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })),
            { role: "user", content: msg }
          ],
        }),
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "Ready to code — what's next?";
      setMsgs(p => [...p, { role: "ares", text }]);
    } catch {
      setMsgs(p => [...p, { role: "ares", text: "Connection hiccup. Try again — I'm ready to write code." }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 10, flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
            {m.role === "ares" && (
              <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, marginTop: 2 }}>⚡</div>
            )}
            <div style={{
              maxWidth: "86%",
              background: m.role === "user" ? `linear-gradient(135deg, ${C.accent}CC, #4B2FD0CC)` : C.card,
              border: m.role === "user" ? "none" : `1px solid ${C.border}`,
              borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              padding: "10px 14px", fontSize: 13, lineHeight: 1.65, color: C.text, whiteSpace: "pre-wrap",
            }}>{m.text}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>⚡</div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "14px 14px 14px 4px", padding: "10px 14px", fontSize: 13, color: C.muted }}>Writing code…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask Ares to write code, plan a feature, or debug…"
          style={{ flex: 1, background: C.bg, border: `1px solid ${C.borderHi}`, borderRadius: 10, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none" }} />
        <button onClick={send} style={{ width: 42, height: 42, borderRadius: 10, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: "none", cursor: "pointer", fontSize: 16, color: "#fff" }}>→</button>
      </div>
    </div>
  );
}

function PhaseCard({ phase, isActive, onClick }) {
  const done = phase.tasks.filter(t => t.status === "done").length;
  const total = phase.tasks.length;
  const pct = Math.round((done / total) * 100);
  return (
    <div onClick={onClick} style={{ background: isActive ? C.card : C.panel, border: `1px solid ${isActive ? phase.color + "55" : C.border}`, borderRadius: 12, padding: "16px 18px", cursor: "pointer", transition: "all 0.2s", boxShadow: isActive ? `0 0 20px ${phase.color}22` : "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: phase.color, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>Phase {phase.id} · {phase.eta}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{phase.title}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{phase.subtitle}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: phase.color, fontFamily: "monospace" }}>{pct}%</div>
          <div style={{ fontSize: 10, color: C.muted }}>{done}/{total} done</div>
        </div>
      </div>
      <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: phase.color, borderRadius: 2, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

function TaskRow({ task, phaseColor, onStatusChange }) {
  const statusColors = { done: C.green, next: phaseColor, ready: C.gold, queued: C.dim };
  const statusLabels = { done: "✓ Done", next: "▶ Up Next", ready: "○ Ready", queued: "· Queued" };
  const effortColors = { S: C.green, M: C.gold, L: C.coral };
  return (
    <div style={{ background: C.card, border: `1px solid ${task.status === "next" ? phaseColor + "44" : C.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 10, borderLeft: `3px solid ${statusColors[task.status]}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{task.title}</span>
            <span style={{ fontSize: 9, fontWeight: 700, background: effortColors[task.effort] + "33", color: effortColors[task.effort], border: `1px solid ${effortColors[task.effort]}44`, borderRadius: 4, padding: "2px 6px" }}>{task.effort === "S" ? "SMALL" : task.effort === "M" ? "MED" : "LARGE"}</span>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{task.desc}</div>
          <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace" }}>📄 {task.file}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: statusColors[task.status], whiteSpace: "nowrap" }}>{statusLabels[task.status]}</span>
          <button onClick={() => onStatusChange(task.id)} style={{ background: task.status === "done" ? C.border : `${phaseColor}22`, border: `1px solid ${task.status === "done" ? C.dim : phaseColor + "55"}`, color: task.status === "done" ? C.muted : phaseColor, borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            {task.status === "done" ? "Undo" : "✓ Mark Done"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DevDashboard() {
  const [phases, setPhases] = useState(PHASES);
  const [activePhase, setActivePhase] = useState(1);
  const [view, setView] = useState("roadmap");

  const toggleTask = (phaseId, taskId) => {
    setPhases(prev => prev.map(ph => ph.id !== phaseId ? ph : {
      ...ph, tasks: ph.tasks.map(t => t.id !== taskId ? t : { ...t, status: t.status === "done" ? "next" : "done" })
    }));
  };

  const current = phases.find(p => p.id === activePhase);
  const totalDone = phases.flatMap(p => p.tasks).filter(t => t.status === "done").length;
  const totalTasks = phases.flatMap(p => p.tasks).length;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Mono', 'Fira Code', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: ${C.bg}; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
        button { font-family: inherit; } input { font-family: inherit; }
      `}</style>

      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: "0 28px", display: "flex", alignItems: "center", height: 56, gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✦</div>
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, color: C.text }}>Dreamscape</span>
          <span style={{ fontSize: 12, color: C.muted }}>/</span>
          <span style={{ fontSize: 12, color: C.muted }}>dev-ops</span>
        </div>
        <div style={{ display: "flex", gap: 4, marginLeft: 16 }}>
          {[["roadmap", "📋 Roadmap"], ["apis", "🔌 APIs"], ["deploy", "🚀 Deploy Log"], ["ares", "⚡ Ares"]].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} style={{ background: view === id ? `${C.accent}25` : "none", border: `1px solid ${view === id ? C.accent + "55" : "transparent"}`, borderRadius: 8, padding: "6px 14px", color: view === id ? C.accent : C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>{label}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 12, color: C.muted }}>
            <span style={{ color: C.green, fontWeight: 700 }}>{totalDone}</span>/{totalTasks} tasks
          </div>
          <div style={{ width: 100, height: 6, background: C.border, borderRadius: 3 }}>
            <div style={{ width: `${(totalDone / totalTasks) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${C.accent}, ${C.green})`, borderRadius: 3, transition: "width 0.4s" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${C.green}18`, border: `1px solid ${C.green}44`, borderRadius: 20, padding: "4px 12px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, display: "inline-block" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>trydreamscape.com · LIVE</span>
          </div>
        </div>
      </div>

      {/* ROADMAP */}
      {view === "roadmap" && (
        <div style={{ display: "flex", height: "calc(100vh - 56px)" }}>
          <div style={{ width: 280, flexShrink: 0, background: C.panel, borderRight: `1px solid ${C.border}`, padding: "20px 16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, paddingLeft: 2 }}>Development Phases</div>
            {phases.map(ph => <PhaseCard key={ph.id} phase={ph} isActive={activePhase === ph.id} onClick={() => setActivePhase(ph.id)} />)}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: current.color }} />
                <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: C.text }}>{current.title}</span>
                <span style={{ fontSize: 12, color: current.color, background: current.color + "20", border: `1px solid ${current.color}44`, borderRadius: 20, padding: "3px 10px", fontWeight: 700 }}>{current.eta}</span>
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginLeft: 22 }}>{current.subtitle}</div>
            </div>
            <div style={{ background: `${C.accent}12`, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: C.accent, fontWeight: 700, marginBottom: 3 }}>⚡ Ares can write any of these files</div>
                <div style={{ fontSize: 12, color: C.muted }}>Click a task → ask Ares in the chat tab to generate the complete code</div>
              </div>
              <button onClick={() => setView("ares")} style={{ background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: "none", borderRadius: 9, padding: "9px 16px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Open Ares ⚡</button>
            </div>
            {current.tasks.map(task => <TaskRow key={task.id} task={task} phaseColor={current.color} onStatusChange={(id) => toggleTask(current.id, id)} />)}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px", marginTop: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>🚀 Deploy Flow</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12, color: C.muted, flexWrap: "wrap" }}>
                {["Ares writes code", "You review", "Approve + push to GitHub", "Netlify auto-deploys ✓"].map((step, i, arr) => (
                  <>
                    <span key={step} style={{ background: i === arr.length - 1 ? `${C.green}18` : C.panel, border: `1px solid ${i === arr.length - 1 ? C.green + "44" : C.border}`, borderRadius: 6, padding: "4px 10px", color: i === arr.length - 1 ? C.green : C.muted }}>{step}</span>
                    {i < arr.length - 1 && <span style={{ color: C.dim }}>→</span>}
                  </>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* APIS */}
      {view === "apis" && (
        <div style={{ padding: "28px 32px", overflowY: "auto", maxHeight: "calc(100vh - 56px)" }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: C.text, marginBottom: 6 }}>API Integration Stack</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 28 }}>All keys go in Netlify Environment Variables. Never in your code.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14, marginBottom: 28 }}>
            {API_STACK.map(api => (
              <div key={api.name} style={{ background: C.card, border: `1px solid ${api.priority === 1 ? api.color + "44" : C.border}`, borderRadius: 12, padding: "20px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: api.color + "22", border: `1px solid ${api.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{api.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16, color: C.text }}>{api.name}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{api.role}</div>
                  </div>
                  {api.priority === 1 && <span style={{ fontSize: 9, fontWeight: 700, color: api.color, background: api.color + "22", border: `1px solid ${api.color}33`, borderRadius: 4, padding: "3px 7px", textTransform: "uppercase" }}>Priority 1</span>}
                </div>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: "monospace", background: C.panel, borderRadius: 7, padding: "8px 12px" }}>📚 {api.docs}</div>
              </div>
            ))}
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "22px 24px" }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 16 }}>Netlify Environment Variables to Set Now</div>
            {[
              ["ANTHROPIC_API_KEY",      "console.anthropic.com → API Keys"],
              ["VITE_SUPABASE_URL",      "supabase.com → Project Settings → API"],
              ["VITE_SUPABASE_ANON_KEY", "supabase.com → Project Settings → API"],
              ["PRINTFUL_API_KEY",       "printful.com → Developer Portal"],
              ["STRIPE_SECRET_KEY",      "stripe.com → Developers → API Keys"],
              ["GEMINI_API_KEY",         "aistudio.google.com → API Keys"],
            ].map(([key, hint]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                <code style={{ fontSize: 12, color: C.green, background: C.panel, borderRadius: 5, padding: "3px 8px", minWidth: 240 }}>{key}</code>
                <span style={{ fontSize: 12, color: C.muted }}>{hint}</span>
              </div>
            ))}
            <div style={{ marginTop: 16, fontSize: 12, color: C.muted, background: `${C.gold}12`, border: `1px solid ${C.gold}33`, borderRadius: 8, padding: "10px 14px" }}>
              💡 Netlify dashboard → Site configuration → Environment variables → Add a variable
            </div>
          </div>
        </div>
      )}

      {/* DEPLOY LOG */}
      {view === "deploy" && (
        <div style={{ padding: "28px 32px" }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: C.text, marginBottom: 6 }}>Deploy Log & Workflow</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 28 }}>Every git push to main auto-deploys via Netlify.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px" }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 14 }}>Deploy Workflow</div>
              {["Ares writes the file", "You review the code", "Copy into your repo", "git add . && git commit -m 'feature'", "git push origin main", "Netlify builds in ~60s", "trydreamscape.com updated ✓"].map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: i === 6 ? C.green + "33" : C.border, border: `1px solid ${i === 6 ? C.green : C.dim}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: i === 6 ? C.green : C.muted, flexShrink: 0, fontWeight: 700 }}>{i + 1}</div>
                  <div style={{ fontSize: 13, color: i === 6 ? C.green : C.text, paddingTop: 2, fontFamily: i >= 3 && i <= 4 ? "monospace" : "inherit" }}>{step}</div>
                </div>
              ))}
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px" }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 14 }}>Activity Log</div>
              {DEPLOY_LOG.map((log, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderBottom: i < DEPLOY_LOG.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <span style={{ fontSize: 14 }}>{log.type === "deploy" ? "🚀" : log.type === "git" ? "🔗" : log.type === "feature" ? "✦" : "○"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: log.status === "success" ? C.text : C.muted }}>{log.msg}</div>
                    <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{log.time}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: log.status === "success" ? C.green : C.gold, background: (log.status === "success" ? C.green : C.gold) + "18", border: `1px solid ${(log.status === "success" ? C.green : C.gold)}33`, borderRadius: 4, padding: "2px 7px", whiteSpace: "nowrap" }}>{log.status === "success" ? "✓ live" : "pending"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ARES */}
      {view === "ares" && (
        <div style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 24px", borderBottom: `1px solid ${C.border}`, background: C.panel, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚡</div>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: C.text }}>Ares — Engineering Mode</div>
              <div style={{ fontSize: 11, color: C.green, fontFamily: "monospace" }}>● Ready to write code · trydreamscape.com</div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["Write Netlify Function", "Set up Supabase", "Connect Printful API"].map((q, i) => (
                <button key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 10px", color: C.muted, fontSize: 11, cursor: "pointer" }}>{q}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <AresChat />
          </div>
        </div>
      )}
    </div>
  );
}
