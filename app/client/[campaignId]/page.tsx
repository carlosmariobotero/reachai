"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

const G = "#BEFF00";
const BORDER = "#141414";
const TEXT2 = "#555";
const S1 = "#080808";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garant:ital,wght@0,300;0,400;1,300;1,400&family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #000; min-height: 100%; }
  #client-root { min-height: 100vh; background: #000; font-family: 'Syne', sans-serif; color: #fff; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: #111; }
  :focus { outline: none; }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .fu  { animation: fadeUp 0.35s ease forwards; }
  .fu1 { animation: fadeUp 0.35s ease 0.08s forwards; opacity: 0; }
  .fu2 { animation: fadeUp 0.35s ease 0.16s forwards; opacity: 0; }
  .fu3 { animation: fadeUp 0.35s ease 0.24s forwards; opacity: 0; }
  .fu4 { animation: fadeUp 0.35s ease 0.32s forwards; opacity: 0; }

  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
  .pulse { animation: pulse 2s ease-in-out infinite; }

  @keyframes fillBar { from { width: 0; } to { width: var(--w); } }
  .fill-bar { animation: fillBar 1.2s cubic-bezier(0.4,0,0.2,1) 0.5s forwards; width: 0; }

  .tab-btn {
    padding: 8px 20px; background: transparent;
    border: 1px solid #141414; border-radius: 2px;
    font-size: 12px; color: #444; font-family: 'Syne', sans-serif;
    font-weight: 500; cursor: pointer; transition: all 0.12s; letter-spacing: 0.05em;
  }
  .tab-btn:hover { border-color: #2A2A2A; color: #888; }
  .tab-btn.active { border-color: ${G}; color: ${G}; background: ${G}08; }

  .lead-row {
    display: grid; grid-template-columns: 2fr 1.5fr 1fr 0.8fr 1fr;
    align-items: center; gap: 12px;
    padding: 14px 24px; border-bottom: 1px solid #0D0D0D;
    transition: background 0.1s;
  }
  .lead-row:hover { background: #060606; }

  .status-dot-wrap {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 11px; font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.06em; text-transform: uppercase;
  }

  .video-card {
    background: #080808; border: 1px solid #141414; border-radius: 4px;
    overflow: hidden; cursor: pointer; transition: border-color 0.15s;
  }
  .video-card:hover { border-color: #2A2A2A; }
  .video-thumb {
    width: 100%; aspect-ratio: 16/9; background: #0D0D0D;
    display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
  }
  .play-btn {
    width: 44px; height: 44px; border-radius: 50%;
    border: 1px solid ${G}66; background: ${G}10;
    display: flex; align-items: center; justify-content: center; transition: all 0.15s;
  }
  .video-card:hover .play-btn { background: ${G}22; border-color: ${G}; }

  .activity-item {
    display: flex; align-items: flex-start; gap: 14px;
    padding: 14px 0; border-bottom: 1px solid #0A0A0A;
  }
  .activity-dot { width: 7px; height: 7px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiLead {
  id: string;
  firstName: string;
  lastName: string;
  title?: string;
  company?: string;
  linkedinUrl?: string;
  location?: string;
  status: string;
  videoUrl?: string;
}

interface StatusResponse {
  campaign: {
    id: string;
    clientName: string;
    name: string;
    status: string;
    industries: string[];
    jobTitles: string[];
    geography: string[];
    websiteUrl: string;
    leadCount: number;
    createdAt: string;
    stats: {
      totalLeads: number;
      researched: number;
      scriptsDone: number;
      videosGenerated: number;
      emailsSent: number;
      responses: number;
    };
  };
  pipeline: {
    scraped: number;
    researched: number;
    scripts_done: number;
    videos_done: number;
    delivered: number;
  };
  leads: ApiLead[];
}

interface DashLead {
  name: string;
  title: string;
  company: string;
  linkedinUrl: string;
  location: string;
  status: string;
  video: boolean;
}

interface DashVideo {
  lead: string;
  company: string;
  title: string;
  approved: boolean;
  videoUrl: string;
}

interface DashData {
  client: string;
  industry: string;
  website: string;
  targetTitles: string[];
  targetGeo: string;
  leadCount: number;
  started: string;
  status: string;
  pipeline: Record<string, { val: number; total: number }>;
  delivery: { sent: number; opened: number; replied: number; meetings: number };
  leads: DashLead[];
  videos: DashVideo[];
  activity: { time: string; text: string; color: string }[];
}

// ─── Lead status mapping ──────────────────────────────────────────────────────

const LEAD_STATUS_MAP: Record<string, string> = {
  new: "scraped",
  researching: "researched",
  scripted: "script_done",
  photo_needed: "scraped",
  photo_ready: "researched",
  prompt_ready: "script_done",
  video_generating: "video_ready",
  video_ready: "video_ready",
  approved: "video_ready",
  emailed: "delivered",
  responded: "delivered",
  failed: "scraped",
};

const LEAD_STATUS: Record<string, { color: string; label: string }> = {
  delivered:   { color: G,        label: "Delivered"   },
  video_ready: { color: "#7B6EF6", label: "Video Ready" },
  script_done: { color: "#5DCAA5", label: "Script Done" },
  researched:  { color: "#F07B5D", label: "Researched"  },
  scraped:     { color: "#333",    label: "Scraped"     },
};

function buildDashData(data: StatusResponse): DashData {
  const { campaign, pipeline, leads } = data;
  const total = campaign.leadCount || 1;

  const mappedLeads: DashLead[] = leads.map((l) => ({
    name: `${l.firstName} ${l.lastName}`,
    title: l.title ?? "",
    company: l.company ?? "",
    linkedinUrl: l.linkedinUrl ?? "",
    location: l.location ?? "",
    status: LEAD_STATUS_MAP[l.status] ?? "scraped",
    video: !!l.videoUrl,
  }));

  const videoLeads = leads.filter((l) => l.videoUrl);
  const videos: DashVideo[] = videoLeads.map((l) => ({
    lead: `${l.firstName} ${l.lastName}`,
    company: l.company ?? "",
    title: l.title ?? "",
    approved: l.status === "emailed" || l.status === "responded",
    videoUrl: l.videoUrl ?? "",
  }));

  const sent = pipeline.delivered;
  const replied = campaign.stats.responses;

  return {
    client: campaign.clientName,
    industry: campaign.industries[0] ?? "—",
    website: campaign.websiteUrl,
    targetTitles: campaign.jobTitles,
    targetGeo: campaign.geography[0] ?? "—",
    leadCount: campaign.leadCount,
    started: new Date(campaign.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    status: campaign.status,
    pipeline: {
      scraped:    { val: pipeline.scraped,     total },
      researched: { val: pipeline.researched,  total },
      scripts:    { val: pipeline.scripts_done, total },
      videos:     { val: pipeline.videos_done,  total },
      delivered:  { val: pipeline.delivered,    total },
    },
    delivery: {
      sent,
      opened: 0,
      replied,
      meetings: 0,
    },
    leads: mappedLeads,
    videos,
    activity: [],
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PipeStage({ label, val, total, delay }: { label: string; val: number; total: number; delay: number }) {
  const pct = total > 0 ? Math.round((val / total) * 100) : 0;
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "10px" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#333", letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: pct === 100 ? G : "#555" }}>{pct}%</span>
      </div>
      <div style={{ height: "2px", background: "#111", borderRadius: "2px", overflow: "hidden" }}>
        <div
          className="fill-bar"
          style={{
            "--w": `${pct}%`,
            height: "100%",
            background: pct === 100 ? G : `${G}88`,
            borderRadius: "2px",
            animationDelay: `${delay}s`,
          } as React.CSSProperties}
        />
      </div>
      <div style={{ marginTop: "8px", display: "flex", alignItems: "baseline", gap: "4px" }}>
        <span style={{ fontSize: "20px", fontWeight: "700", letterSpacing: "-0.02em" }}>{val}</span>
        <span style={{ fontSize: "11px", color: "#333" }}>/ {total}</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const EMPTY_DATA: DashData = {
  client: "—", industry: "—", website: "—", targetTitles: [], targetGeo: "—",
  leadCount: 0, started: "—", status: "—",
  pipeline: {
    scraped:    { val: 0, total: 1 },
    researched: { val: 0, total: 1 },
    scripts:    { val: 0, total: 1 },
    videos:     { val: 0, total: 1 },
    delivered:  { val: 0, total: 1 },
  },
  delivery: { sent: 0, opened: 0, replied: 0, meetings: 0 },
  leads: [], videos: [], activity: [],
};

export default function ClientDashboard() {
  const params = useParams() as { campaignId: string };
  const campaignId = params.campaignId;

  const [tab, setTab] = useState("overview");
  const [d, setD] = useState<DashData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/status`);
      const payload = await res.json() as StatusResponse | { error?: string };
      if (!res.ok) {
        setError((payload as { error?: string }).error ?? "Could not load campaign status");
        setLoading(false);
        return;
      }
      const data = payload as StatusResponse;
      setD(buildDashData(data));
      setError(null);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load campaign status");
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void fetchStatus();
    const id = setInterval(() => { void fetchStatus(); }, 10_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const tabs = [
    { id: "overview",  label: "Overview"  },
    { id: "leads",     label: "Leads"     },
    { id: "videos",    label: "Videos"    },
    { id: "activity",  label: "Activity"  },
  ];

  if (loading) {
    return (
      <div id="client-root">
        <style>{css}</style>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#222", letterSpacing: "0.2em" }}>LOADING…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div id="client-root">
        <style>{css}</style>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px" }}>
          <div style={{ maxWidth: "560px", background: S1, border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "28px" }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", color: "#F07B5D", fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "14px" }}>Campaign status error</p>
            <h1 style={{ fontSize: "28px", lineHeight: 1.15, marginBottom: "12px" }}>This campaign page could not load yet.</h1>
            <p style={{ color: "#666", fontSize: "13px", lineHeight: 1.6, marginBottom: "18px" }}>{error}</p>
            <button className="tab-btn active" onClick={() => { setLoading(true); setError(null); void fetchStatus(); }}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  const openRate = d.delivery.sent > 0 ? Math.round((d.delivery.opened / d.delivery.sent) * 100) : 0;
  const replyRate = d.delivery.sent > 0 ? Math.round((d.delivery.replied / d.delivery.sent) * 100) : 0;

  return (
    <div id="client-root">
      <style>{css}</style>

      {/* ── TOP HEADER ── */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "0 clamp(20px, 5vw, 60px)", display: "flex", flexDirection: "column" }}>
        {/* Brand bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: G, letterSpacing: "0.22em", textTransform: "uppercase" }}>ReachAI</p>
            <span style={{ color: "#1A1A1A" }}>×</span>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#333", letterSpacing: "0.12em", textTransform: "uppercase" }}>{d.client}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="pulse" style={{ width: "6px", height: "6px", borderRadius: "50%", background: G, display: "inline-block" }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: G, letterSpacing: "0.1em" }}>LIVE</span>
          </div>
        </div>

        {/* Campaign hero */}
        <div style={{ padding: "32px 0 28px" }}>
          <div className="fu" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "24px" }}>
            <div>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#333", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "10px" }}>Campaign Dashboard</p>
              <h1 style={{ fontFamily: "'Cormorant Garant', serif", fontSize: "clamp(32px, 5vw, 56px)", fontWeight: "300", lineHeight: 1.05, letterSpacing: "-0.01em" }}>
                {d.client}{" "}
                <span style={{ fontStyle: "italic", color: G }}>Outreach Campaign</span>
              </h1>
              <p style={{ marginTop: "12px", fontSize: "13px", color: TEXT2, letterSpacing: "0.01em" }}>
                {d.targetGeo} · {d.industry} · Started {d.started}
              </p>
            </div>

            <div style={{ textAlign: "right" }}>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#333", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "8px" }}>Outreach Sent</p>
              <p style={{ fontFamily: "'Cormorant Garant', serif", fontSize: "clamp(48px, 7vw, 72px)", fontWeight: "300", lineHeight: 1, color: G, letterSpacing: "-0.02em" }}>
                {d.delivery.sent}
                <span style={{ fontSize: "22px", color: "#333", marginLeft: "6px" }}>/ {d.leadCount}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="fu1" style={{ display: "flex", gap: "8px", paddingBottom: "0", position: "relative" }}>
          {tabs.map((t) => (
            <button key={t.id} className={`tab-btn${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: "32px clamp(20px, 5vw, 60px)", maxWidth: "1100px" }}>

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div>
            {/* Pipeline stages */}
            <div className="fu2" style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "28px 32px", marginBottom: "20px" }}>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#2A2A2A", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "28px" }}>Pipeline Progress</p>
              <div style={{ display: "flex", gap: "clamp(16px, 3vw, 40px)", flexWrap: "wrap" }}>
                {Object.entries(d.pipeline).map(([key, v], i) => (
                  <PipeStage key={key} label={key} val={v.val} total={v.total} delay={0.5 + i * 0.1} />
                ))}
              </div>
            </div>

            {/* Delivery stats */}
            <div className="fu3" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
              {[
                { label: "Sent",     val: d.delivery.sent,     note: "videos delivered"          },
                { label: "Opened",   val: d.delivery.opened,   note: `${openRate}% open rate`    },
                { label: "Replied",  val: d.delivery.replied,  note: `${replyRate}% reply rate`  },
                { label: "Meetings", val: d.delivery.meetings, note: "booked so far"             },
              ].map((s, i) => (
                <div key={i} style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "20px 22px" }}>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#2A2A2A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "12px" }}>{s.label}</p>
                  <p style={{ fontFamily: "'Cormorant Garant', serif", fontSize: "42px", fontWeight: "300", color: i === 3 ? G : "#fff", lineHeight: 1, letterSpacing: "-0.02em" }}>{s.val}</p>
                  <p style={{ fontSize: "11px", color: "#2A2A2A", marginTop: "8px" }}>{s.note}</p>
                </div>
              ))}
            </div>

            {/* Campaign details */}
            <div className="fu4" style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "24px 28px" }}>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#2A2A2A", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "20px" }}>Campaign Details</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0" }}>
                {[
                  { label: "Target Titles",  val: d.targetTitles.join(", ") || "—" },
                  { label: "Geography",      val: d.targetGeo                       },
                  { label: "Total Leads",    val: `${d.leadCount} contacts`         },
                  { label: "Website",        val: d.website                         },
                  { label: "Started",        val: d.started                         },
                  { label: "Status",         val: d.status                          },
                ].map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "12px 0", borderBottom: "1px solid #0D0D0D", gap: "20px", gridColumn: i % 2 === 0 ? "1" : "2" }}>
                    <span style={{ fontSize: "12px", color: "#333" }}>{r.label}</span>
                    <span style={{ fontSize: "12px", color: "#888" }}>{r.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── LEADS ── */}
        {tab === "leads" && (
          <div className="fu" style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "4px", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 0.8fr 1fr", gap: "12px", padding: "12px 24px", borderBottom: "1px solid #0D0D0D" }}>
              {["Contact","Company","Location","LinkedIn","Status"].map((h) => (
                <span key={h} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#222", letterSpacing: "0.12em", textTransform: "uppercase" }}>{h}</span>
              ))}
            </div>

            {d.leads.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center" }}>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#1A1A1A", letterSpacing: "0.1em" }}>No leads yet.</p>
              </div>
            ) : (
              d.leads.map((l, i) => {
                const st = LEAD_STATUS[l.status] ?? LEAD_STATUS.scraped;
                return (
                  <div key={i} className="lead-row">
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#0D0D0D", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#444", fontWeight: "700", flexShrink: 0 }}>
                        {l.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: "500" }}>{l.name}</p>
                        <p style={{ fontSize: "11px", color: "#444" }}>{l.title}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: "13px", color: "#666" }}>{l.company}</span>
                    <span style={{ fontSize: "12px", color: "#444" }}>{l.location}</span>
                    {l.linkedinUrl ? (
                      <a href={l.linkedinUrl} target="_blank" rel="noreferrer" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: G, textDecoration: "none", letterSpacing: "0.08em" }}>
                        OPEN
                      </a>
                    ) : (
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#222", letterSpacing: "0.08em" }}>N/A</span>
                    )}
                    <span className="status-dot-wrap" style={{ color: st.color }}>
                      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: st.color, display: "inline-block", flexShrink: 0 }} />
                      {st.label}
                    </span>
                  </div>
                );
              })
            )}

            <div style={{ padding: "14px 24px", borderTop: "1px solid #0D0D0D" }}>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#222", letterSpacing: "0.1em" }}>
                Showing {d.leads.length} of {d.leadCount} leads
              </p>
            </div>
          </div>
        )}

        {/* ── VIDEOS ── */}
        {tab === "videos" && (
          <div className="fu">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#333", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                {d.pipeline.videos.val} videos generated
              </p>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#222", letterSpacing: "0.1em" }}>
                Showing latest {d.videos.length}
              </p>
            </div>

            {d.videos.length === 0 ? (
              <div style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "48px", textAlign: "center" }}>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#1A1A1A", letterSpacing: "0.1em" }}>No videos generated yet.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                {d.videos.map((v, i) => (
                  <div key={i} className="video-card" onClick={() => v.videoUrl && window.open(v.videoUrl, "_blank")}>
                    <div className="video-thumb">
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "3px", opacity: 0.08 }}>
                        {Array.from({ length: 28 }).map((_, j) => (
                          <div key={j} style={{ width: "3px", background: G, borderRadius: "2px", height: `${20 + Math.sin(j * 0.7 + i) * 18}px` }} />
                        ))}
                      </div>
                      <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "#111", border: "1px solid #1A1A1A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "700", color: "#444", position: "absolute", top: "16px", left: "16px" }}>
                        {v.lead.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div className="play-btn">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M4 2.5l8 4.5-8 4.5V2.5z" fill={G} />
                        </svg>
                      </div>
                    </div>
                    <div style={{ padding: "16px 18px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                        <div>
                          <p style={{ fontSize: "13px", fontWeight: "600", marginBottom: "3px" }}>{v.lead}</p>
                          <p style={{ fontSize: "11px", color: "#444" }}>{v.title} · {v.company}</p>
                        </div>
                        {v.approved ? (
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: G, border: `1px solid ${G}44`, padding: "3px 8px", borderRadius: "2px", letterSpacing: "0.1em", flexShrink: 0 }}>SENT</span>
                        ) : (
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#333", border: "1px solid #1A1A1A", padding: "3px 8px", borderRadius: "2px", letterSpacing: "0.1em", flexShrink: 0 }}>PENDING</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {d.pipeline.videos.val > d.videos.length && (
              <div style={{ marginTop: "24px", background: S1, border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.6 }}>
                  <span style={{ color: "#fff", fontWeight: "600" }}>{d.pipeline.videos.val - d.videos.length} more videos</span> are being generated. You&apos;ll be notified when each batch is ready.
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <span className="pulse" style={{ width: "6px", height: "6px", borderRadius: "50%", background: G, display: "inline-block" }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: G, letterSpacing: "0.1em" }}>GENERATING</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVITY ── */}
        {tab === "activity" && (
          <div className="fu" style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "0 28px" }}>
            <div style={{ padding: "20px 0 0" }}>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#2A2A2A", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "4px" }}>Live Activity Feed</p>
              <p style={{ fontSize: "12px", color: "#333", marginBottom: "20px" }}>Everything happening on your campaign in real time.</p>
            </div>
            {d.activity.length === 0 ? (
              <div style={{ padding: "32px 0 28px" }}>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#1A1A1A", letterSpacing: "0.1em" }}>— Activity will appear as the campaign runs —</p>
              </div>
            ) : (
              <>
                {d.activity.map((a, i) => (
                  <div key={i} className="activity-item">
                    <div className="activity-dot" style={{ background: a.color }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: "13px", color: "#888", lineHeight: 1.5 }}>{a.text}</p>
                      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#2A2A2A", marginTop: "4px", letterSpacing: "0.06em" }}>{a.time}</p>
                    </div>
                  </div>
                ))}
                <div style={{ padding: "20px 0" }}>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#1A1A1A", letterSpacing: "0.1em" }}>— End of recent activity —</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
