"use client";
import { useState, useEffect, useCallback } from "react";

const G = "#BEFF00";
const S1 = "#080808";
const BORDER = "#141414";
const MUTED = "#3A3A3A";
const TEXT2 = "#666";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #000; height: 100%; overflow: hidden; }
  #dash-root { height: 100vh; background: #000; font-family: 'Syne', sans-serif; color: #fff; display: flex; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: #1A1A1A; }
  ::placeholder { color: #2A2A2A; }
  :focus { outline: none; }

  .nav-item {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 16px; border-radius: 4px;
    font-size: 13px; color: #444; font-weight: 500;
    cursor: pointer; transition: all 0.12s; user-select: none;
  }
  .nav-item:hover { background: #0D0D0D; color: #888; }
  .nav-item.active { background: ${G}10; color: ${G}; }
  .nav-icon { width: 16px; height: 16px; opacity: 0.6; }
  .nav-item.active .nav-icon { opacity: 1; }

  .status-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px; border-radius: 2px;
    font-size: 11px; font-family: 'JetBrains Mono', monospace;
    font-weight: 400; letter-spacing: 0.05em; text-transform: uppercase;
  }
  .status-dot { width: 5px; height: 5px; border-radius: 50%; }

  .campaign-row {
    display: grid; grid-template-columns: 1fr 100px 90px 90px 90px 36px;
    align-items: center; gap: 16px;
    padding: 16px 20px; border-bottom: 1px solid ${BORDER};
    cursor: pointer; transition: background 0.1s;
  }
  .campaign-row:hover { background: #080808; }
  .campaign-row.header { cursor: default; }
  .campaign-row.header:hover { background: transparent; }

  .lead-row {
    display: grid; grid-template-columns: 1.6fr 1.3fr 1fr 0.8fr 0.8fr 1.6fr;
    align-items: center; gap: 12px;
    padding: 14px 20px; border-bottom: 1px solid ${BORDER};
    transition: background 0.1s; cursor: pointer;
  }
  .lead-row:hover { background: #060606; }
  .lead-row.header { cursor: default; pointer-events: none; }

  .pill-btn {
    padding: 6px 14px; background: transparent;
    border: 1px solid #1A1A1A; border-radius: 2px;
    font-size: 11px; color: #555; font-family: 'Syne', sans-serif;
    cursor: pointer; transition: all 0.12s; white-space: nowrap;
  }
  .pill-btn:hover { border-color: ${G}44; color: ${G}; }
  .pill-btn.primary { border-color: ${G}; color: ${G}; }
  .pill-btn.primary:hover { background: ${G}; color: #000; }

  .search-input {
    background: #080808; border: 1px solid #141414; border-radius: 2px;
    padding: 8px 14px 8px 36px; font-size: 13px; color: #888;
    font-family: 'Syne', sans-serif; width: 220px;
    transition: border-color 0.15s; caret-color: ${G};
  }
  .search-input:focus { border-color: #2A2A2A; color: #fff; }

  .pipe-line { flex: 1; height: 1px; background: #141414; margin-top: 10px; }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .fade-in { animation: fadeIn 0.25s ease forwards; }

  .avatar {
    width: 32px; height: 32px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; flex-shrink: 0;
  }

  .stat-card {
    background: #080808; border: 1px solid #141414; border-radius: 4px;
    padding: 20px 24px;
  }
`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiCampaign {
  id: string;
  clientName: string;
  name: string;
  status: string;
  industries?: string[] | null;
  stats: {
    totalLeads: number;
    researched: number;
    scriptsDone: number;
    videosGenerated: number;
    emailsSent: number;
    responses: number;
  } | null;
  createdAt: string;
}

interface ApiLead {
  id: string;
  firstName: string;
  lastName: string;
  title?: string;
  company?: string;
  linkedinUrl?: string;
  location?: string;
  profilePhotoUrl?: string;
  status: string;
  videoUrl?: string;
}

interface DashCampaign {
  id: string;
  client: string;
  avatar: string;
  color: string;
  industry: string;
  leads: number;
  status: string;
  scraped: number;
  researched: number;
  videos: number;
  delivered: number;
  created: string;
}

interface DashLead {
  id: string;
  name: string;
  title: string;
  company: string;
  linkedinUrl: string;
  location: string;
  profilePhotoUrl: string;
  status: string;
  video: boolean;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

const COLORS = [G, "#7B6EF6", "#F07B5D", "#5DCAA5"];

const CAMPAIGN_STATUS_MAP: Record<string, string> = {
  draft: "pending",
  scraping: "processing",
  active: "active",
  paused: "pending",
  completed: "complete",
};

const LEAD_STATUS_MAP: Record<string, string> = {
  new: "scraped",
  researching: "researched",
  scripted: "researched",
  photo_needed: "scraped",
  photo_ready: "researched",
  prompt_ready: "researched",
  video_generating: "video_ready",
  video_ready: "video_ready",
  approved: "video_ready",
  emailed: "delivered",
  responded: "delivered",
  failed: "scraped",
};

function mapCampaign(c: ApiCampaign, index: number): DashCampaign {
  const stats = c.stats ?? {
    totalLeads: 0,
    researched: 0,
    scriptsDone: 0,
    videosGenerated: 0,
    emailsSent: 0,
    responses: 0,
  };
  const words = (c.clientName || c.name || "Campaign").split(" ");
  const avatar = words.map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return {
    id: c.id,
    client: c.clientName || c.name || "Untitled Campaign",
    avatar,
    color: COLORS[index % COLORS.length],
    industry: c.industries?.[0] ?? "—",
    leads: stats.totalLeads,
    status: CAMPAIGN_STATUS_MAP[c.status] ?? "pending",
    scraped: stats.totalLeads,
    researched: stats.researched,
    videos: stats.videosGenerated,
    delivered: stats.emailsSent,
    created: new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

function mapLead(l: ApiLead): DashLead {
  return {
    id: l.id,
    name: `${l.firstName} ${l.lastName}`,
    title: l.title ?? "",
    company: l.company ?? "",
    linkedinUrl: l.linkedinUrl ?? "",
    location: l.location ?? "",
    profilePhotoUrl: l.profilePhotoUrl ?? "",
    status: LEAD_STATUS_MAP[l.status] ?? "scraped",
    video: !!l.videoUrl,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  active:     { bg: `${G}12`, color: G, dot: G, label: "Active" },
  processing: { bg: "#7B6EF620", color: "#7B6EF6", dot: "#7B6EF6", label: "Processing" },
  pending:    { bg: "#F07B5D20", color: "#F07B5D", dot: "#F07B5D", label: "Pending" },
  complete:   { bg: "#5DCAA520", color: "#5DCAA5", dot: "#5DCAA5", label: "Complete" },
};

const LEAD_STATUS: Record<string, { color: string; label: string }> = {
  delivered:   { color: G, label: "Delivered" },
  video_ready: { color: "#7B6EF6", label: "Video Ready" },
  researched:  { color: "#F07B5D", label: "Researched" },
  scraped:     { color: "#444", label: "Scraped" },
};

const PIPE_STAGES = ["Scraped", "Researched", "Script", "Video", "Delivered"];

function NavIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    campaigns: <svg width="16" height="16" fill="none" viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/></svg>,
    activity:  <svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M1 8h2.5l2-5 3 9 2-6 1.5 2H15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    review:    <svg width="16" height="16" fill="none" viewBox="0 0 16 16"><rect x="1" y="3" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M11 6.5l4-2v7l-4-2V6.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>,
    outbox:    <svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M2 4h12M2 8h8M2 12h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
    settings:  <svg width="16" height="16" fill="none" viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  };
  return <>{icons[type] ?? null}</>;
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span className="status-badge" style={{ background: s.bg, color: s.color }}>
      <span className="status-dot" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

function PipelineBar({ campaign }: { campaign: DashCampaign }) {
  const total = campaign.leads;
  const stages = [
    { label: "Scraped",    val: campaign.scraped },
    { label: "Researched", val: campaign.researched },
    { label: "Videos",     val: campaign.videos },
    { label: "Delivered",  val: campaign.delivered },
  ];
  return (
    <div style={{ display: "flex", gap: "2px", alignItems: "center", width: "100%" }}>
      {stages.map((st, i) => {
        const pct = total > 0 ? Math.round((st.val / total) * 100) : 0;
        return (
          <div key={i} title={`${st.label}: ${st.val}`} style={{
            flex: 1, height: "3px", borderRadius: "1px",
            background: pct > 0
              ? `${G}${Math.round(40 + (pct / 100) * 215).toString(16).padStart(2, "0")}`
              : BORDER,
          }} />
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [nav, setNav] = useState("campaigns");
  const [campaigns, setCampaigns] = useState<DashCampaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<DashCampaign | null>(null);
  const [activeLeads, setActiveLeads] = useState<DashLead[]>([]);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardNotice, setDashboardNotice] = useState<string | null>(null);
  const [uploadingLeadId, setUploadingLeadId] = useState<string | null>(null);
  const [addingLeads, setAddingLeads] = useState(false);
  const [addLeadCount, setAddLeadCount] = useState(5);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns");
      const data = await res.json() as { campaigns?: ApiCampaign[]; error?: string };
      if (!res.ok) {
        setDashboardError(data.error ?? "Could not load campaigns");
        return;
      }
      setCampaigns((data.campaigns ?? []).map((c, i) => mapCampaign(c, i)));
      setDashboardError(null);
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Could not load campaigns");
    }
  }, []);

  const fetchLeads = useCallback(async (campaignId: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/status`);
      const data = await res.json() as { leads?: ApiLead[]; error?: string };
      if (!res.ok) {
        setDashboardError(data.error ?? "Could not load leads");
        return;
      }
      setActiveLeads((data.leads ?? []).map(mapLead));
      setDashboardError(null);
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Could not load leads");
    }
  }, []);

  const addLeadsToCampaign = useCallback(async () => {
    if (!activeCampaign) return;
    setAddingLeads(true);
    setDashboardNotice(null);
    try {
      const res = await fetch(`/api/campaigns/${activeCampaign.id}/leads/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadCount: addLeadCount }),
      });
      const data = await res.json() as { added?: number; totalLeads?: number; error?: string; message?: string };
      if (!res.ok) {
        setDashboardError(data.error ?? "Could not add more leads");
        return;
      }
      setDashboardNotice(`${data.added ?? 0} LinkedIn-ready leads added. Campaign now has ${data.totalLeads ?? "updated"} leads.`);
      setActiveCampaign((current) => current
        ? {
            ...current,
            leads: data.totalLeads ?? current.leads,
            scraped: data.totalLeads ?? current.scraped,
          }
        : current
      );
      await Promise.all([fetchCampaigns(), fetchLeads(activeCampaign.id)]);
      setDashboardError(null);
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Could not add more leads");
    } finally {
      setAddingLeads(false);
    }
  }, [activeCampaign, addLeadCount, fetchCampaigns, fetchLeads]);

  const uploadLeadPhoto = useCallback(async (leadId: string, file: File) => {
    const formData = new FormData();
    formData.append("photo", file);
    setUploadingLeadId(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}/creative/photo`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setDashboardError(data.error ?? "Could not upload profile photo");
        return;
      }
      if (activeCampaign) void fetchLeads(activeCampaign.id);
      setDashboardError(null);
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Could not upload profile photo");
    } finally {
      setUploadingLeadId(null);
    }
  }, [activeCampaign, fetchLeads]);

  // Initial load + polling for campaign list
  useEffect(() => {
    void fetchCampaigns();
    const id = setInterval(() => { void fetchCampaigns(); }, 10_000);
    return () => clearInterval(id);
  }, [fetchCampaigns]);

  // Fetch + poll leads when a campaign is active
  useEffect(() => {
    if (!activeCampaign) { setActiveLeads([]); return; }
    void fetchLeads(activeCampaign.id);
    const id = setInterval(() => { void fetchLeads(activeCampaign.id); }, 10_000);
    return () => clearInterval(id);
  }, [activeCampaign?.id, fetchLeads]);

  const navItems = [
    { id: "campaigns", label: "Campaigns" },
    { id: "activity",  label: "Activity" },
    { id: "review",    label: "Review" },
    { id: "outbox",    label: "Outbox" },
    { id: "settings",  label: "Settings" },
  ];

  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);
  const totalVideos = campaigns.reduce((s, c) => s + c.videos, 0);
  const totalDelivered = campaigns.reduce((s, c) => s + c.delivered, 0);

  return (
    <div id="dash-root">
      <style>{css}</style>

      {/* ── SIDEBAR ── */}
      <div style={{ width: "220px", flexShrink: 0, height: "100vh", borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", padding: "0 12px", position: "relative" }}>
        <div style={{ padding: "24px 4px 32px", borderBottom: `1px solid ${BORDER}` }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: G, letterSpacing: "0.2em", textTransform: "uppercase" }}>ReachAI</p>
          <p style={{ fontSize: "11px", color: "#2A2A2A", marginTop: "4px" }}>Operator Console</p>
        </div>

        <nav style={{ padding: "16px 0", flex: 1 }}>
          {navItems.map((item) => (
            <div
              key={item.id}
              className={`nav-item${nav === item.id ? " active" : ""}`}
              onClick={() => { setNav(item.id); setActiveCampaign(null); }}
            >
              <span className="nav-icon"><NavIcon type={item.id} /></span>
              {item.label}
              {item.id === "campaigns" && (
                <span style={{ marginLeft: "auto", fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: nav === "campaigns" ? G : "#2A2A2A", background: nav === "campaigns" ? `${G}15` : "#0D0D0D", padding: "1px 7px", borderRadius: "2px" }}>
                  {campaigns.length}
                </span>
              )}
            </div>
          ))}
        </nav>

        <div style={{ padding: "16px 4px", borderTop: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="avatar" style={{ background: `${G}18`, color: G, fontSize: "10px" }}>CB</div>
            <div>
              <p style={{ fontSize: "12px", fontWeight: "600" }}>Carlos Botero</p>
              <p style={{ fontSize: "10px", color: "#333" }}>Operator</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar */}
        <div style={{ height: "56px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1 style={{ fontSize: "15px", fontWeight: "600" }}>
              {activeCampaign ? activeCampaign.client : navItems.find((n) => n.id === nav)?.label}
            </h1>
            {activeCampaign && (
              <>
                <span style={{ color: MUTED }}>/</span>
                <button onClick={() => setActiveCampaign(null)} style={{ background: "none", border: "none", fontSize: "13px", color: TEXT2, cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
                  Campaigns
                </button>
              </>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ position: "relative" }}>
              <svg style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} width="13" height="13" fill="none" viewBox="0 0 13 13">
                <circle cx="5.5" cy="5.5" r="4" stroke="#2A2A2A" strokeWidth="1.2"/>
                <path d="M9 9l2.5 2.5" stroke="#2A2A2A" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <input className="search-input" placeholder="Search..." />
            </div>
            <button className="pill-btn primary" onClick={() => alert("Opens client intake link generator")}>
              + New Campaign
            </button>
          </div>
        </div>

        {dashboardError && (
          <div style={{ margin: "16px 24px 0", border: "1px solid #3A1D12", background: "#120804", borderRadius: "4px", padding: "12px 14px", color: "#F07B5D", fontSize: "12px", lineHeight: 1.5 }}>
            {dashboardError}
          </div>
        )}

        {dashboardNotice && (
          <div style={{ margin: "16px 24px 0", border: `1px solid ${G}44`, background: `${G}08`, borderRadius: "4px", padding: "12px 14px", color: G, fontSize: "12px", lineHeight: 1.5 }}>
            {dashboardNotice}
          </div>
        )}

        {/* ── CAMPAIGNS VIEW ── */}
        {nav === "campaigns" && !activeCampaign && (
          <div className="fade-in" style={{ flex: 1, overflow: "auto", padding: "24px" }}>

            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "28px" }}>
              {[
                { label: "Total Campaigns", val: String(campaigns.length) },
                { label: "Total Leads",     val: String(totalLeads) },
                { label: "Videos Generated", val: String(totalVideos) },
                { label: "Delivered",        val: String(totalDelivered) },
              ].map((s, i) => (
                <div key={i} className="stat-card">
                  <p style={{ fontSize: "11px", color: TEXT2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>{s.label}</p>
                  <p style={{ fontSize: "28px", fontWeight: "700", color: "#fff", letterSpacing: "-0.02em" }}>{s.val}</p>
                </div>
              ))}
            </div>

            {/* Table */}
            <div style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "4px", overflow: "hidden" }}>
              <div className="campaign-row header" style={{ borderBottom: `1px solid ${BORDER}` }}>
                {["Client","Status","Leads","Pipeline","Created",""].map((h, i) => (
                  <span key={i} style={{ fontSize: "11px", color: "#2A2A2A", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</span>
                ))}
              </div>

              {campaigns.length === 0 ? (
                <div style={{ padding: "48px 20px", textAlign: "center" }}>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#1A1A1A", letterSpacing: "0.1em" }}>No campaigns yet.</p>
                </div>
              ) : (
                campaigns.map((c) => (
                  <div key={c.id} className="campaign-row" onClick={() => setActiveCampaign(c)}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div className="avatar" style={{ background: `${c.color}18`, color: c.color, fontSize: "10px" }}>{c.avatar}</div>
                      <div>
                        <p style={{ fontSize: "14px", fontWeight: "600" }}>{c.client}</p>
                        <p style={{ fontSize: "11px", color: TEXT2 }}>{c.industry}</p>
                      </div>
                    </div>
                    <StatusBadge status={c.status} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "14px" }}>{c.leads}</span>
                    <div><PipelineBar campaign={c} /></div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: TEXT2 }}>{c.created}</span>
                    <svg width="14" height="14" fill="none" viewBox="0 0 14 14" style={{ color: "#2A2A2A" }}>
                      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── CAMPAIGN DETAIL ── */}
        {activeCampaign && (
          <div className="fade-in" style={{ flex: 1, overflow: "auto", padding: "24px" }}>

            {/* Pipeline progress */}
            <div style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "24px 28px", marginBottom: "20px" }}>
              <p style={{ fontSize: "11px", color: TEXT2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "20px" }}>Campaign Pipeline</p>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0" }}>
                {PIPE_STAGES.map((stage, i) => {
                  const vals = [
                    activeCampaign.scraped,
                    activeCampaign.researched,
                    activeCampaign.researched,
                    activeCampaign.videos,
                    activeCampaign.delivered,
                  ];
                  const total = activeCampaign.leads;
                  const pct = total > 0 ? Math.round((vals[i] / total) * 100) : 0;
                  const isLast = i === PIPE_STAGES.length - 1;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", flex: 1 }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "18px", fontWeight: "500", color: pct === 100 ? G : pct > 0 ? "#fff" : "#222" }}>{vals[i]}</span>
                        <div style={{ height: "3px", width: "100%", borderRadius: "2px", background: pct > 0 ? G : BORDER, opacity: pct > 0 ? Math.max(0.3, pct / 100) : 1 }} />
                        <span style={{ fontSize: "10px", color: TEXT2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>{stage}</span>
                      </div>
                      {!isLast && <div className="pipe-line" style={{ flexShrink: 0, width: "24px" }} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lead table */}
            <div style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "4px", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: "13px", fontWeight: "600" }}>
                  Leads <span style={{ fontFamily: "'JetBrains Mono', monospace", color: TEXT2, fontSize: "12px", marginLeft: "8px" }}>{activeLeads.length}</span>
                </p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="number"
                    min="1"
                    max="25"
                    value={addLeadCount}
                    onChange={(e) => setAddLeadCount(Math.min(Math.max(Number(e.target.value) || 1, 1), 25))}
                    title="How many more Apollo leads to add"
                    style={{
                      width: "58px",
                      background: "#050505",
                      border: `1px solid ${BORDER}`,
                      borderRadius: "2px",
                      color: "#888",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "11px",
                      padding: "6px 8px",
                    }}
                  />
                  <button className="pill-btn primary" disabled={addingLeads} onClick={addLeadsToCampaign}>
                    {addingLeads ? "Adding..." : "Add Leads"}
                  </button>
                  <button className="pill-btn">Export CSV</button>
                  <button className="pill-btn primary">Run All Videos</button>
                </div>
              </div>
              <div className="lead-row header">
                {["Name","Company","Title","LinkedIn","Status","Actions"].map((h, i) => (
                  <span key={i} style={{ fontSize: "10px", color: "#2A2A2A", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</span>
                ))}
              </div>
              {activeLeads.length === 0 ? (
                <div style={{ padding: "32px 20px", textAlign: "center" }}>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#1A1A1A", letterSpacing: "0.1em" }}>No leads yet.</p>
                </div>
              ) : (
                activeLeads.map((lead, i) => {
                  const st = LEAD_STATUS[lead.status] ?? LEAD_STATUS.scraped;
                  return (
                    <div key={i} className="lead-row">
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div className="avatar" style={{ background: "#0D0D0D", color: TEXT2, width: "28px", height: "28px", fontSize: "9px" }}>
                          {lead.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: "500" }}>{lead.name}</span>
                      </div>
                      <span style={{ fontSize: "13px", color: "#888" }}>{lead.company}</span>
                      <span style={{ fontSize: "12px", color: TEXT2 }}>{lead.title}</span>
                      {lead.linkedinUrl ? (
                        <button className="pill-btn" style={{ padding: "4px 10px", fontSize: "10px", width: "fit-content" }} onClick={(e) => { e.stopPropagation(); window.open(lead.linkedinUrl, "_blank", "noopener,noreferrer"); }}>
                          LinkedIn
                        </button>
                      ) : (
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#2A2A2A", letterSpacing: "0.08em" }}>Missing</span>
                      )}
                      <span className="status-badge" style={{ background: `${st.color}12`, color: st.color, fontSize: "10px", width: "fit-content" }}>
                        {st.label}
                      </span>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <label className="pill-btn" style={{ padding: "4px 10px", fontSize: "10px", borderColor: lead.profilePhotoUrl ? `${G}44` : "#1A1A1A", color: lead.profilePhotoUrl ? G : "#555" }} onClick={(e) => e.stopPropagation()}>
                          {uploadingLeadId === lead.id ? "Uploading..." : lead.profilePhotoUrl ? "Photo Ready" : "Upload Photo"}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            style={{ display: "none" }}
                            disabled={uploadingLeadId === lead.id}
                            onChange={(e) => {
                              e.stopPropagation();
                              const file = e.currentTarget.files?.[0];
                              if (file) void uploadLeadPhoto(lead.id, file);
                              e.currentTarget.value = "";
                            }}
                          />
                        </label>
                        {lead.video ? (
                          <button className="pill-btn" style={{ padding: "4px 10px", fontSize: "10px", borderColor: `${G}44`, color: G }}>▶ View</button>
                        ) : (
                          <button className="pill-btn" style={{ padding: "4px 10px", fontSize: "10px" }} onClick={(e) => { e.stopPropagation(); window.location.href = `/creative/${lead.id}`; }}>Creative</button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── PLACEHOLDER VIEWS ── */}
        {nav !== "campaigns" && !activeCampaign && (() => {
          const descriptions: Record<string, { title: string; sub: string }> = {
            activity: { title: "Activity", sub: "Live feed of what the AI agent is doing — scraping leads, running research, generating scripts and videos across all campaigns." },
            review:   { title: "Review", sub: "Videos queued for your approval. Preview each one, approve to send, or trigger a regeneration before anything goes out." },
            outbox:   { title: "Outbox", sub: "Everything that's been sent — platform, timestamp, open status, and replies. Your real-time ROI view." },
            settings: { title: "Settings", sub: "API keys, Higgsfield MCP worker config, ElevenLabs voice setup, email sender setup, and outreach templates." },
          };
          const d = descriptions[nav];
          return (
            <div className="fade-in" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "14px", padding: "40px" }}>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#222", letterSpacing: "0.2em", textTransform: "uppercase" }}>{d?.title}</p>
              <p style={{ fontSize: "13px", color: "#2A2A2A", textAlign: "center", maxWidth: "380px", lineHeight: 1.7 }}>{d?.sub}</p>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#1A1A1A", marginTop: "8px", letterSpacing: "0.1em" }}>Phase 2</p>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
