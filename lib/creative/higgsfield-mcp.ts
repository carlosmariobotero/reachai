import type { CreativeVideoJob, CreativeVideoScene, Lead } from "../types";

export interface HiggsfieldMcpSceneTask {
  sceneId: string;
  leadId: string;
  creativeVideoJobId: string;
  sceneNumber: number;
  durationSeconds: number;
  imageUrl: string;
  prompt: string;
  suggestedTool: "generate_video_seedance" | "generate_video_kling" | "generate_video_dop_standard";
}

export function buildHiggsfieldMcpTasks(
  lead: Lead,
  job: CreativeVideoJob,
  scenes: CreativeVideoScene[]
): HiggsfieldMcpSceneTask[] {
  if (!lead.profilePhotoUrl) {
    throw new Error("Lead profile photo is required before Higgsfield generation");
  }

  return scenes.map((scene) => ({
    sceneId: scene.id,
    leadId: lead.id,
    creativeVideoJobId: job.id,
    sceneNumber: scene.sceneNumber,
    durationSeconds: scene.durationSeconds,
    imageUrl: lead.profilePhotoUrl!,
    prompt: `${scene.higgsfieldPrompt}

Motion: premium cinematic camera movement, natural expression, realistic likeness, polished commercial ad quality.
Audio: silent. Do not add music, dialogue, captions, text, subtitles, or watermark.
Duration target: ${scene.durationSeconds} seconds.`,
    suggestedTool: "generate_video_seedance",
  }));
}
