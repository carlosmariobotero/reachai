import type { CreativeVideoJob, CreativeVideoScene, Lead } from "../types";

export interface HiggsfieldMcpSceneTask {
  sceneId: string;
  leadId: string;
  creativeVideoJobId: string;
  sceneNumber: number;
  durationSeconds: number;
  leadPhotoUrl: string;
  imageModel: "gpt_image_2";
  stillPrompt: string;
  videoModel: "cinematic_studio_video";
  videoPrompt: string;
  steps: string[];
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
    leadPhotoUrl: lead.profilePhotoUrl!,
    imageModel: "gpt_image_2",
    stillPrompt: `Use the uploaded lead image as the actual identity reference for the main character. Preserve the exact face identity and likeness from the reference image: facial structure, eyes, beard or facial hair, hairline, skin tone, expression, and professional presence. Do not create a generic similar person.

Scene ${scene.sceneNumber}: ${scene.higgsfieldPrompt}

Create a premium cinematic still frame for a cold outreach ad. No text, captions, subtitles, logos, watermarks, or source-image graphic elements.`,
    videoModel: "cinematic_studio_video",
    videoPrompt: `Animate the approved GPT Image 2 still for scene ${scene.sceneNumber}. Preserve the person's face identity and appearance from the start frame exactly. Use subtle natural motion only: slight confident head movement, gentle breathing, small cinematic camera movement, and premium commercial lighting. No spoken audio, music, captions, text, logos, subtitles, or watermark.`,
    steps: [
      "Upload the lead photo to Higgsfield media and copy the media_id.",
      "Generate a still with model gpt_image_2 using the media_id as role=image.",
      "Review the still for likeness before animation.",
      "Generate video with model cinematic_studio_video using the still image job id as role=start_image.",
      "Save media_id, still job/url, and video job/url back to this scene.",
    ],
  }));
}
