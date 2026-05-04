"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  title?: string;
  company?: string;
  linkedinUrl?: string;
  profilePhotoUrl?: string;
  videoUrl?: string;
};

type Campaign = {
  id: string;
  clientName: string;
  painPoint: string;
  websiteUrl: string;
};

type Job = {
  id: string;
  status: string;
  clientResearchSummary?: string;
  leadResearchSummary?: string;
  salesAngle?: string;
  voiceoverScript?: string;
  outreachMessage?: string;
  voiceoverUrl?: string;
  hyperframesCompositionUrl?: string;
  finalVideoUrl?: string;
};

type Scene = {
  id: string;
  sceneNumber: number;
  durationSeconds: number;
  objective: string;
  higgsfieldPrompt: string;
  captionText: string;
  status: string;
  higgsfieldMediaId?: string;
  stillImageJobId?: string;
  stillImageUrl?: string;
  videoJobId?: string;
  higgsfieldRequestId?: string;
  videoUrl?: string;
};

type CreativeResponse = {
  lead: Lead;
  campaign: Campaign;
  job: Job | null;
  scenes: Scene[];
};

type SceneInput = {
  higgsfieldMediaId: string;
  stillImageJobId: string;
  stillImageUrl: string;
  videoJobId: string;
  videoUrl: string;
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  html, body { background: #000; }
  #creative-root { min-height: 100vh; background: #000; color: #fff; font-family: 'Syne', sans-serif; padding: 28px; }
  .mono { font-family: 'JetBrains Mono', monospace; }
  .panel { background: #080808; border: 1px solid #141414; border-radius: 4px; padding: 20px; }
  .button { border: 1px solid #BEFF00; color: #BEFF00; background: transparent; border-radius: 2px; padding: 10px 14px; font: 700 11px 'Syne', sans-serif; letter-spacing: .1em; text-transform: uppercase; cursor: pointer; }
  .button:hover:not(:disabled) { background: #BEFF00; color: #000; }
  .button:disabled { border-color: #242424; color: #333; cursor: not-allowed; }
  .muted { color: #555; }
  .input { width: 100%; background: #050505; border: 1px solid #181818; color: #ddd; padding: 10px 12px; border-radius: 2px; font: 12px 'JetBrains Mono', monospace; }
  .textarea { width: 100%; min-height: 88px; resize: vertical; background: #050505; border: 1px solid #181818; color: #ddd; padding: 12px; border-radius: 2px; font: 12px/1.5 'JetBrains Mono', monospace; }
`;

function getSceneStatusTone(status: string) {
  switch (status) {
    case "ready":
      return "#BEFF00";
    case "generating":
      return "#F7C948";
    case "queued":
      return "#6EE7F9";
    case "failed":
      return "#F07B5D";
    default:
      return "#555";
  }
}

export default function CreativeLeadPage() {
  const params = useParams() as { leadId: string };
  const leadId = params.leadId;
  const [data, setData] = useState<CreativeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sceneInputs, setSceneInputs] = useState<Record<string, SceneInput>>({});
  const [finalVideoUrl, setFinalVideoUrl] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}/creative`);
    const next = (await res.json()) as CreativeResponse;
    if (!res.ok) throw new Error((next as { error?: string }).error ?? "Failed to load");
    setData(next);
    setFinalVideoUrl(next.job?.finalVideoUrl ?? next.lead.videoUrl ?? "");
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    void load().catch((err) => {
      setMessage(err instanceof Error ? err.message : "Could not load creative package");
      setLoading(false);
    });
  }, [load]);

  useEffect(() => {
    if (!data) return;

    const shouldPoll = data.scenes.some(
      (scene) => scene.status === "queued" || scene.status === "generating"
    );

    if (!shouldPoll) return;

    const interval = window.setInterval(() => {
      void load().catch(() => {
        // Keep the current screen stable if one refresh fails.
      });
    }, 7000);

    return () => window.clearInterval(interval);
  }, [data, load]);

  const post = async (path: string, label: string, body?: BodyInit, headers?: HeadersInit) => {
    setBusy(label);
    setMessage(null);
    try {
      const res = await fetch(path, { method: "POST", body, headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      if (json.automationMessage) {
        setMessage(json.automationMessage);
      } else if (json.mcpTasks) {
        setMessage(
          `${json.mcpTasks.length} scene jobs are ready. This page will update automatically as the stills and videos come back.`
        );
      } else if (json.renderInstructions) {
        setMessage(json.renderInstructions);
      } else {
        setMessage("Done.");
      }
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something failed");
    } finally {
      setBusy(null);
    }
  };

  const uploadPhotoAndQueue = async (formData: FormData) => {
    setBusy("photo");
    setMessage(null);
    try {
      const photoRes = await fetch(`/api/leads/${leadId}/creative/photo`, {
        method: "POST",
        body: formData,
      });
      const photoJson = await photoRes.json();
      if (!photoRes.ok) throw new Error(photoJson.error ?? "Photo upload failed");

      setMessage("Photo uploaded. Starting lead automation...");

      const automationRes = await fetch(`/api/leads/${leadId}/creative/automate`, {
        method: "POST",
      });
      const automationJson = await automationRes.json();
      if (!automationRes.ok) {
        throw new Error(automationJson.error ?? "Lead automation failed");
      }

      setMessage(
        automationJson.automationMessage ??
          "Photo uploaded and Higgsfield scene automation queued."
      );
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setBusy(null);
    }
  };

  const readyScenes = useMemo(
    () => data?.scenes.filter((scene) => scene.videoUrl).length ?? 0,
    [data?.scenes]
  );

  const getSceneInput = (scene: Scene): SceneInput => (
    sceneInputs[scene.id] ?? {
      higgsfieldMediaId: scene.higgsfieldMediaId ?? "",
      stillImageJobId: scene.stillImageJobId ?? "",
      stillImageUrl: scene.stillImageUrl ?? "",
      videoJobId: scene.videoJobId ?? scene.higgsfieldRequestId ?? "",
      videoUrl: scene.videoUrl ?? "",
    }
  );

  const setSceneInputValue = (scene: Scene, key: keyof SceneInput, value: string) => {
    setSceneInputs((prev) => ({
      ...prev,
      [scene.id]: {
        ...getSceneInput(scene),
        ...prev[scene.id],
        [key]: value,
      },
    }));
  };

  const saveScene = async (scene: Scene) => {
    const values = getSceneInput(scene);
    await fetch(`/api/leads/${leadId}/creative/scenes/${scene.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: values.videoUrl ? "ready" : values.stillImageUrl ? "generating" : "queued",
        higgsfieldMediaId: values.higgsfieldMediaId || undefined,
        stillImageJobId: values.stillImageJobId || undefined,
        stillImageUrl: values.stillImageUrl || undefined,
        videoJobId: values.videoJobId || undefined,
        higgsfieldRequestId: values.videoJobId || undefined,
        videoUrl: values.videoUrl || undefined,
      }),
    });
    await load();
  };

  if (loading) {
    return (
      <div id="creative-root">
        <style>{css}</style>
        <p className="mono muted">Loading creative studio...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div id="creative-root">
        <style>{css}</style>
        <p className="mono muted">{message ?? "Creative package not found."}</p>
      </div>
    );
  }

  const leadName = `${data.lead.firstName} ${data.lead.lastName}`;
  const queuedScenes = data.scenes.filter((scene) => scene.status === "queued").length;
  const generatingScenes = data.scenes.filter(
    (scene) => scene.status === "generating"
  ).length;
  const failedScenes = data.scenes.filter((scene) => scene.status === "failed").length;
  const hasQueuedScenes = queuedScenes > 0;
  const hasGeneratingScenes = generatingScenes > 0;
  const hasActiveSceneRun = hasQueuedScenes || hasGeneratingScenes;
  const hasScenePlan = data.scenes.length > 0;

  const friendlyStatus = hasGeneratingScenes
    ? "Creating scene images and videos"
    : hasQueuedScenes
      ? "Waiting for Higgsfield generation"
      : data.job?.status === "scenes_ready"
        ? "Scenes finished"
        : data.job?.status === "voiceover_ready"
          ? "Voiceover ready"
          : data.job?.status === "render_ready"
            ? "Final edit ready"
            : data.job?.status === "approved"
              ? "Approved"
              : data.job?.status === "prompt_ready"
                ? "Scene prompts ready"
                : data.job?.status === "research_ready"
                  ? "Research ready"
                  : data.job?.status ?? "No creative job yet";

  const statusDetail = hasGeneratingScenes
    ? "A Higgsfield worker has already picked this lead up. This page refreshes automatically while the scene stills and videos are being created."
    : hasQueuedScenes
      ? "This lead is fully prepared and waiting for the Higgsfield worker to start generating the scene stills and videos."
      : data.job?.status === "scenes_ready"
        ? "All three scene videos are back. Voiceover and final assembly can continue."
        : data.job?.status === "prompt_ready"
          ? "Research and prompts are ready. The next real step is starting scene generation."
          : "Upload a photo, generate the brief, then start the scene run.";

  return (
    <div id="creative-root">
      <style>{css}</style>

      <header style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <p className="mono" style={{ color: "#BEFF00", fontSize: "11px", letterSpacing: ".18em", textTransform: "uppercase", marginBottom: "10px" }}>ReachAI Creative Agent</p>
          <h1 style={{ fontSize: "34px", lineHeight: 1.05, margin: 0 }}>{leadName}</h1>
          <p className="muted" style={{ marginTop: "8px", fontSize: "13px" }}>{data.lead.title ?? "Lead"} · {data.lead.company ?? "Unknown company"}</p>
        </div>
        <div className="panel" style={{ minWidth: "240px" }}>
          <p className="mono muted" style={{ fontSize: "10px", letterSpacing: ".12em", textTransform: "uppercase", marginBottom: "8px" }}>Status</p>
          <p style={{ margin: 0, color: "#BEFF00", fontWeight: 800 }}>{friendlyStatus}</p>
          <p className="muted" style={{ margin: "10px 0 0", fontSize: "12px", lineHeight: 1.5 }}>{statusDetail}</p>
          <p className="mono muted" style={{ margin: "12px 0 0", fontSize: "11px" }}>
            {readyScenes} ready · {generatingScenes} generating · {queuedScenes} waiting · {failedScenes} failed
          </p>
        </div>
      </header>

      {message && (
        <div className="panel" style={{ borderColor: "#27330A", color: "#BEFF00", marginBottom: "18px", fontSize: "13px", lineHeight: 1.5 }}>{message}</div>
      )}

      {hasGeneratingScenes && (
        <div className="panel" style={{ borderColor: "#4F3F08", color: "#F7C948", marginBottom: "18px", fontSize: "13px", lineHeight: 1.5 }}>
          Higgsfield generation is running now. The screen refreshes automatically every few seconds, and each scene will fill in as soon as its still image and video are saved back.
        </div>
      )}

      <main style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "18px", alignItems: "start" }}>
        <section className="panel">
          <p className="mono muted" style={{ fontSize: "10px", letterSpacing: ".12em", textTransform: "uppercase" }}>Lead Photo</p>
          {data.lead.profilePhotoUrl ? (
            <img src={data.lead.profilePhotoUrl} alt={leadName} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: "4px", border: "1px solid #181818", margin: "14px 0" }} />
          ) : (
            <div style={{ width: "100%", aspectRatio: "1 / 1", border: "1px solid #181818", display: "flex", alignItems: "center", justifyContent: "center", margin: "14px 0", color: "#333" }}>No photo yet</div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              void uploadPhotoAndQueue(formData);
            }}
          >
            <input className="input" type="file" name="photo" accept="image/png,image/jpeg,image/webp" required />
            <button className="button" style={{ marginTop: "12px", width: "100%" }} disabled={!!busy || hasActiveSceneRun}>
              {busy === "photo" ? "Starting..." : hasActiveSceneRun ? "Generation Already Running" : "Upload Photo + Queue"}
            </button>
          </form>
        </section>

        <section style={{ display: "grid", gap: "18px" }}>
          <div className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center" }}>
              <div>
                <p className="mono muted" style={{ fontSize: "10px", letterSpacing: ".12em", textTransform: "uppercase" }}>Creative Brief</p>
                <p className="muted" style={{ fontSize: "13px", marginBottom: 0 }}>{data.campaign.clientName} · {data.campaign.websiteUrl}</p>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button className="button" disabled={!!busy || hasActiveSceneRun} onClick={() => post(`/api/leads/${leadId}/creative/research`, "brief")}>
                  {busy === "brief" ? "Working..." : hasActiveSceneRun ? "Brief Locked During Generation" : "Generate Brief"}
                </button>
                <button className="button" disabled={!!busy || !data.lead.profilePhotoUrl || hasActiveSceneRun} onClick={() => post(`/api/leads/${leadId}/creative/automate`, "automate")}>
                  {busy === "automate" ? "Starting..." : hasActiveSceneRun ? "Lead Automation Already Running" : "Run Lead Automation"}
                </button>
              </div>
            </div>
            {data.job && (
              <div style={{ marginTop: "18px", display: "grid", gap: "12px" }}>
                <div className="panel" style={{ padding: "14px", background: "#050505" }}>
                  <p className="mono" style={{ color: "#BEFF00", fontSize: "10px", letterSpacing: ".12em", textTransform: "uppercase", marginTop: 0 }}>AI Research</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <label style={{ display: "grid", gap: "8px" }}>
                      <span className="mono muted" style={{ fontSize: "10px", letterSpacing: ".1em", textTransform: "uppercase" }}>Client Research</span>
                      <textarea className="textarea" readOnly value={data.job.clientResearchSummary ?? "No client research saved yet."} />
                    </label>
                    <label style={{ display: "grid", gap: "8px" }}>
                      <span className="mono muted" style={{ fontSize: "10px", letterSpacing: ".1em", textTransform: "uppercase" }}>Lead Research</span>
                      <textarea className="textarea" readOnly value={data.job.leadResearchSummary ?? "No lead research saved yet."} />
                    </label>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: 800 }}>{data.job.salesAngle}</p>
                <textarea className="textarea" readOnly value={data.job.voiceoverScript ?? ""} />
                <textarea className="textarea" readOnly value={data.job.outreachMessage ?? ""} />
              </div>
            )}
          </div>

          <div className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", marginBottom: "14px" }}>
              <div>
                <p className="mono muted" style={{ fontSize: "10px", letterSpacing: ".12em", textTransform: "uppercase" }}>Higgsfield Scenes</p>
                <p className="muted" style={{ fontSize: "13px", margin: 0 }}>
                  {readyScenes} / 3 animated scene videos ready · {generatingScenes} generating · {queuedScenes} waiting
                </p>
              </div>
              <button className="button" disabled={!!busy || !data.lead.profilePhotoUrl || !data.job || !hasScenePlan || hasActiveSceneRun} onClick={() => post(`/api/leads/${leadId}/creative/scenes/queue`, "scenes")}>
                {busy === "scenes" ? "Queueing..." : hasGeneratingScenes ? "Higgsfield Is Generating" : hasQueuedScenes ? "Already Waiting For Higgsfield" : "Queue Higgsfield Automation"}
              </button>
            </div>

            <div style={{ display: "grid", gap: "12px" }}>
              {data.scenes.map((scene) => (
                <div key={scene.id} style={{ border: "1px solid #141414", padding: "14px", borderRadius: "4px", background: "#050505" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                    <p style={{ margin: 0, fontWeight: 800 }}>Scene {scene.sceneNumber}: {scene.objective}</p>
                    <span className="mono" style={{ color: getSceneStatusTone(scene.status), fontSize: "11px" }}>{scene.status}</span>
                  </div>
                  <p className="muted" style={{ fontSize: "12px", lineHeight: 1.5 }}>{scene.higgsfieldPrompt}</p>
                  <p style={{ fontSize: "13px", color: "#BEFF00" }}>{scene.captionText}</p>
                  {scene.status === "queued" && (
                    <p className="muted" style={{ fontSize: "12px", marginTop: 0 }}>
                      This scene is ready and waiting for Higgsfield to start.
                    </p>
                  )}
                  {scene.status === "generating" && (
                    <p style={{ fontSize: "12px", color: "#F7C948", marginTop: 0 }}>
                      Higgsfield is currently creating this still and video.
                    </p>
                  )}
                  {scene.stillImageUrl && (
                    <img src={scene.stillImageUrl} alt={`Scene ${scene.sceneNumber} still`} style={{ width: "100%", borderRadius: "4px", marginBottom: "10px", border: "1px solid #181818" }} />
                  )}
                  {scene.videoUrl && <video src={scene.videoUrl} muted controls style={{ width: "100%", borderRadius: "4px", marginBottom: "10px" }} />}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr)) auto", gap: "8px" }}>
                    <input className="input" placeholder="Higgsfield media ID" value={getSceneInput(scene).higgsfieldMediaId} onChange={(e) => setSceneInputValue(scene, "higgsfieldMediaId", e.target.value)} />
                    <input className="input" placeholder="GPT Image 2 still job ID" value={getSceneInput(scene).stillImageJobId} onChange={(e) => setSceneInputValue(scene, "stillImageJobId", e.target.value)} />
                    <span />
                    <input className="input" placeholder="Approved still image URL" value={getSceneInput(scene).stillImageUrl} onChange={(e) => setSceneInputValue(scene, "stillImageUrl", e.target.value)} />
                    <input className="input" placeholder="Animation video job ID" value={getSceneInput(scene).videoJobId} onChange={(e) => setSceneInputValue(scene, "videoJobId", e.target.value)} />
                    <span />
                    <input className="input" style={{ gridColumn: "1 / span 2" }} placeholder="Final animated scene video URL" value={getSceneInput(scene).videoUrl} onChange={(e) => setSceneInputValue(scene, "videoUrl", e.target.value)} />
                    <button
                      className="button"
                      disabled={!!busy}
                      onClick={() => void saveScene(scene)}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <p className="mono muted" style={{ fontSize: "10px", letterSpacing: ".12em", textTransform: "uppercase" }}>Voiceover + HyperFrames</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "12px" }}>
              <button className="button" disabled={!!busy || !data.job} onClick={() => post(`/api/leads/${leadId}/creative/voiceover`, "voiceover")}>{busy === "voiceover" ? "Generating..." : "Generate Voiceover"}</button>
              <button className="button" disabled={!!busy || readyScenes !== 3 || !data.job?.voiceoverUrl} onClick={() => post(`/api/leads/${leadId}/creative/render`, "render")}>{busy === "render" ? "Preparing..." : "Create HyperFrames Edit"}</button>
            </div>
            {data.job?.voiceoverUrl && <audio controls src={data.job.voiceoverUrl} style={{ width: "100%", marginTop: "14px" }} />}
            {data.job?.hyperframesCompositionUrl && (
              <p style={{ fontSize: "13px", marginTop: "14px" }}>
                Composition: <a href={data.job.hyperframesCompositionUrl} target="_blank" style={{ color: "#BEFF00" }}>Open HyperFrames HTML</a>
              </p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", marginTop: "14px" }}>
              <input className="input" placeholder="Final MP4 URL after HyperFrames render" value={finalVideoUrl} onChange={(e) => setFinalVideoUrl(e.target.value)} />
              <button className="button" disabled={!!busy || !finalVideoUrl} onClick={() => post(`/api/leads/${leadId}/creative/approve`, "approve", JSON.stringify({ finalVideoUrl }), { "Content-Type": "application/json" })}>{busy === "approve" ? "Approving..." : "Approve"}</button>
            </div>
            {finalVideoUrl && <video src={finalVideoUrl} controls style={{ width: "100%", marginTop: "14px", borderRadius: "4px" }} />}
          </div>
        </section>
      </main>
    </div>
  );
}
