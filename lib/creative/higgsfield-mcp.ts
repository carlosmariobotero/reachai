import type { CreativeVideoJob, CreativeVideoScene, Lead } from "../types";

export interface HiggsfieldMcpSceneTask {
  sceneId: string;
  leadId: string;
  creativeVideoJobId: string;
  sceneNumber: number;
  durationSeconds: number;
  leadPhotoUrl: string;
  imageModel: "gpt_image_2";
  storyboardPanelPrompt: string;
  stillPrompt: string;
  videoModel: "kling_3_0";
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
    storyboardPanelPrompt: scene.higgsfieldPrompt,
    stillPrompt: `Use the uploaded lead image as the actual identity reference for the main character. Preserve the exact face identity and likeness from the reference image: facial structure, eyes, beard or facial hair, hairline, skin tone, expression, and professional presence. Do not create a generic similar person.

Scene ${scene.sceneNumber}: ${scene.higgsfieldPrompt}

Create a premium GPT Image 2 storyboard panel / cinematic still frame for a cold outreach film. Treat the prompt like a film director's shot note, not a keyword list. Use the GPT IMAGE 2 STILL / STORYBOARD PANEL section as the primary still-image instruction. No captions, subtitles, logos, watermarks, fake readable interface copy, or source-image graphic elements.`,
    videoModel: "kling_3_0",
    videoPrompt: `Animate the approved GPT Image 2 storyboard panel for scene ${scene.sceneNumber}. Preserve the person's face identity and appearance from the start frame exactly.

Use the KLING 3.0 MOTION DIRECTION section from this scene as the primary video instruction:
${scene.higgsfieldPrompt}

Focus on what changes: natural human micro-motion, camera behavior, pacing, realistic physics, parallax, light movement, environmental motion, and a composed final frame. Avoid re-inventing the subject or background. No spoken audio, music, captions, text, logos, subtitles, or watermark.`,
    steps: [
      "Upload the lead photo to Higgsfield media and copy the media_id.",
      "Generate one 3-panel storyboard image when testing a new creative concept, then generate or crop the approved scene panel as the still.",
      "Generate each scene still with model gpt_image_2 using the media_id as role=image and the storyboard panel prompt.",
      "Review the still for likeness, cinematic quality, and personalization before animation.",
      "Generate video with Kling 3.0 image-to-video using the still image job id as role=start_image.",
      "Save media_id, still job/url, and video job/url back to this scene.",
    ],
  }));
}
