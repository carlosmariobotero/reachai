import type { Campaign, CreativeVideoJob, CreativeVideoScene, Lead } from "../types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function createHyperframesComposition(input: {
  campaign: Campaign;
  lead: Lead;
  job: CreativeVideoJob;
  scenes: CreativeVideoScene[];
}): string {
  const { campaign, lead, job } = input;
  const scenes = input.scenes
    .filter((scene) => scene.videoUrl)
    .sort((a, b) => a.sceneNumber - b.sceneNumber);

  let start = 0;
  const sceneMarkup = scenes
    .map((scene) => {
      const markup = `<video data-start="${start}" data-duration="${scene.durationSeconds}" data-track-index="0" src="${escapeHtml(scene.videoUrl ?? "")}" muted playsinline></video>
  <div class="caption" data-start="${start + 0.4}" data-duration="${Math.max(scene.durationSeconds - 0.8, 1)}" data-track-index="2">${escapeHtml(scene.captionText)}</div>`;
      start += scene.durationSeconds;
      return markup;
    })
    .join("\n  ");

  const totalDuration = Math.min(Math.max(start, 1), 30);
  const audio = job.voiceoverUrl
    ? `<audio data-start="0" data-duration="${totalDuration}" data-track-index="3" src="${escapeHtml(job.voiceoverUrl)}"></audio>`
    : "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin: 0; width: 1920px; height: 1080px; background: #050505; font-family: Inter, Arial, sans-serif; }
    #root { position: relative; width: 1920px; height: 1080px; overflow: hidden; background: #050505; color: white; }
    video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.42)); z-index: 1; }
    .brand { position: absolute; top: 54px; left: 64px; z-index: 4; font-size: 24px; letter-spacing: .18em; font-weight: 800; color: #BEFF00; }
    .caption { position: absolute; left: 64px; bottom: 88px; z-index: 5; max-width: 1180px; font-size: 72px; line-height: 1.02; font-weight: 850; letter-spacing: 0; text-shadow: 0 12px 40px rgba(0,0,0,.55); }
    .cta { position: absolute; right: 64px; bottom: 72px; z-index: 5; padding: 20px 28px; border: 2px solid #BEFF00; color: #BEFF00; font-size: 26px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .meta { position: absolute; top: 56px; right: 64px; z-index: 4; font-size: 20px; color: rgba(255,255,255,.72); }
  </style>
</head>
<body>
<div id="root" data-composition-id="reachai-${lead.id}" data-start="0" data-width="1920" data-height="1080">
  ${sceneMarkup}
  ${audio}
  <div class="shade" data-start="0" data-duration="${totalDuration}" data-track-index="1"></div>
  <div class="brand" data-start="0" data-duration="${totalDuration}" data-track-index="4">REACHAI</div>
  <div class="meta" data-start="0" data-duration="${totalDuration}" data-track-index="4">${escapeHtml(`${lead.firstName} ${lead.lastName}`)} x ${escapeHtml(campaign.clientName)}</div>
  <div class="cta" data-start="${Math.max(totalDuration - 5, 0)}" data-duration="5" data-track-index="5">Built for you</div>
</div>
</body>
</html>`;
}
