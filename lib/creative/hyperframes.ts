import type { Campaign, CreativeVideoJob, CreativeVideoScene, Lead } from "../types";

export interface HyperframesSceneTrack {
  sceneId: string;
  sceneNumber: number;
  objective: string;
  captionText: string;
  start: number;
  duration: number;
  videoUrl: string;
  stillImageUrl?: string;
}

export interface HyperframesRenderManifest {
  compositionId: string;
  leadId: string;
  leadName: string;
  campaignId: string;
  clientName: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  voiceoverUrl: string;
  scenes: HyperframesSceneTrack[];
  output: {
    format: "mp4";
    fileName: string;
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sceneDuration(scene: CreativeVideoScene): number {
  return scene.durationSeconds <= 7 ? 5 : 10;
}

function buildSceneTracks(scenes: CreativeVideoScene[]): HyperframesSceneTrack[] {
  let start = 0;
  return scenes
    .filter((scene) => scene.videoUrl)
    .sort((a, b) => a.sceneNumber - b.sceneNumber)
    .map((scene) => {
      const duration = sceneDuration(scene);
      const track: HyperframesSceneTrack = {
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        objective: scene.objective,
        captionText: scene.captionText,
        start,
        duration,
        videoUrl: scene.videoUrl!,
        stillImageUrl: scene.stillImageUrl,
      };
      start += duration;
      return track;
    });
}

export function createHyperframesManifest(input: {
  campaign: Campaign;
  lead: Lead;
  job: CreativeVideoJob;
  scenes: CreativeVideoScene[];
}): HyperframesRenderManifest {
  const { campaign, lead, job } = input;
  if (!job.voiceoverUrl) {
    throw new Error("Voiceover URL is required for HyperFrames assembly");
  }

  const scenes = buildSceneTracks(input.scenes);
  const duration = Math.min(
    Math.max(
      scenes.reduce((total, scene) => total + scene.duration, 0),
      1
    ),
    29
  );

  return {
    compositionId: `reachai-${lead.id}`,
    leadId: lead.id,
    leadName: `${lead.firstName} ${lead.lastName}`,
    campaignId: campaign.id,
    clientName: campaign.clientName,
    width: 1920,
    height: 1080,
    fps: 30,
    duration,
    voiceoverUrl: job.voiceoverUrl,
    scenes,
    output: {
      format: "mp4",
      fileName: `reachai-${lead.firstName}-${lead.lastName}.mp4`
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, "-"),
    },
  };
}

export function createHyperframesComposition(input: {
  campaign: Campaign;
  lead: Lead;
  job: CreativeVideoJob;
  scenes: CreativeVideoScene[];
}): string {
  const manifest = createHyperframesManifest(input);
  const { campaign, lead, job } = input;
  const sceneMarkup = manifest.scenes
    .map((scene) => {
      const captionDuration = Math.max(scene.duration - 0.8, 1);
      return `<video id="scene-${scene.sceneNumber}" data-start="${scene.start}" data-duration="${scene.duration}" data-track-index="0" src="${escapeHtml(scene.videoUrl)}" muted playsinline></video>
  <div id="caption-${scene.sceneNumber}" class="clip caption" data-start="${scene.start + 0.4}" data-duration="${captionDuration}" data-track-index="2">${escapeHtml(scene.captionText)}</div>`;
    })
    .join("\n  ");

  const audio = `<audio id="voiceover" data-start="0" data-duration="${manifest.duration}" data-track-index="3" src="${escapeHtml(job.voiceoverUrl ?? "")}"></audio>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <script>
    window.__timelines = window.__timelines || {};
    window.__timelines["${manifest.compositionId}"] = {
      id: "${manifest.compositionId}",
      duration: ${manifest.duration},
      width: ${manifest.width},
      height: ${manifest.height},
      fps: ${manifest.fps}
    };
  </script>
  <style>
    html, body { margin: 0; width: ${manifest.width}px; height: ${manifest.height}px; background: #050505; font-family: Inter, Arial, sans-serif; }
    #root { position: relative; width: ${manifest.width}px; height: ${manifest.height}px; overflow: hidden; background: #050505; color: white; }
    video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.42)); z-index: 1; }
    .brand { position: absolute; top: 54px; left: 64px; z-index: 4; font-size: 24px; letter-spacing: .18em; font-weight: 800; color: #BEFF00; }
    .caption { position: absolute; left: 64px; bottom: 88px; z-index: 5; max-width: 1180px; font-size: 72px; line-height: 1.02; font-weight: 850; letter-spacing: 0; text-shadow: 0 12px 40px rgba(0,0,0,.55); }
    .cta { position: absolute; right: 64px; bottom: 72px; z-index: 5; padding: 20px 28px; border: 2px solid #BEFF00; color: #BEFF00; font-size: 26px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .meta { position: absolute; top: 56px; right: 64px; z-index: 4; font-size: 20px; color: rgba(255,255,255,.72); }
  </style>
</head>
<body>
<div id="root" data-composition-id="${manifest.compositionId}" data-start="0" data-duration="${manifest.duration}" data-width="${manifest.width}" data-height="${manifest.height}" data-fps="${manifest.fps}">
  ${sceneMarkup}
  ${audio}
  <div id="shade" class="clip shade" data-start="0" data-duration="${manifest.duration}" data-track-index="1"></div>
  <div id="brand" class="clip brand" data-start="0" data-duration="${manifest.duration}" data-track-index="4">REACHAI</div>
  <div id="meta" class="clip meta" data-start="0" data-duration="${manifest.duration}" data-track-index="5">${escapeHtml(`${lead.firstName} ${lead.lastName}`)} x ${escapeHtml(campaign.clientName)}</div>
  <div id="cta" class="clip cta" data-start="${Math.max(manifest.duration - 5, 0)}" data-duration="5" data-track-index="6">Built for you</div>
</div>
</body>
</html>`;
}
