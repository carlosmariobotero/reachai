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

function sectionBetween(
  prompt: string,
  startLabel: string,
  nextLabels: string[] = []
): string {
  const lowerPrompt = prompt.toLowerCase();
  const start = lowerPrompt.indexOf(startLabel.toLowerCase());
  if (start === -1) return prompt.trim();

  const contentStart = start + startLabel.length;
  const nextStarts = nextLabels
    .map((label) => lowerPrompt.indexOf(label.toLowerCase(), contentStart))
    .filter((index) => index !== -1);
  const contentEnd = nextStarts.length > 0 ? Math.min(...nextStarts) : prompt.length;

  return prompt.slice(contentStart, contentEnd).replace(/^[:\s]+/, "").trim();
}

export function buildHiggsfieldMcpTasks(
  lead: Lead,
  job: CreativeVideoJob,
  scenes: CreativeVideoScene[]
): HiggsfieldMcpSceneTask[] {
  if (!lead.profilePhotoUrl) {
    throw new Error("Lead profile photo is required before Higgsfield generation");
  }

  return scenes.map((scene) => {
    const stillDirection = sectionBetween(scene.higgsfieldPrompt, "GPT IMAGE 2 STILL / STORYBOARD PANEL", [
      "KLING 3.0 MOTION DIRECTION",
    ]);
    const motionDirection = sectionBetween(scene.higgsfieldPrompt, "KLING 3.0 MOTION DIRECTION");

    return {
      sceneId: scene.id,
      leadId: lead.id,
      creativeVideoJobId: job.id,
      sceneNumber: scene.sceneNumber,
      durationSeconds: scene.durationSeconds,
      leadPhotoUrl: lead.profilePhotoUrl!,
      imageModel: "gpt_image_2",
      storyboardPanelPrompt: scene.higgsfieldPrompt,
      stillPrompt: `Use the uploaded lead image as the actual identity reference for the main character. Preserve the exact face identity and likeness from the reference image: facial structure, eyes, beard or facial hair, hairline, skin tone, expression, and professional presence. Do not create a generic similar person.

Scene ${scene.sceneNumber} still direction:
${stillDirection}

Create one premium cinematic still frame, not a cluttered concept board. Prioritize a clear hook, strong composition, readable action setup, motivated light, and one dominant visual metaphor. No captions, subtitles, logos, watermarks, fake readable interface copy, or source-image graphic elements.`,
      videoModel: "kling_3_0",
      videoPrompt: `Animate the approved GPT Image 2 storyboard panel for scene ${scene.sceneNumber}. Preserve the person's face identity and appearance from the start frame exactly.

Primary Kling 3.0 action direction:
${motionDirection}

Make it feel like a short scene, not an animated photo: use the full ${scene.durationSeconds}-second source clip as editing handle, with clear beginning, escalation, and payoff; one motivated camera move; one meaningful action by the lead; environmental motion caused by that action; realistic physics; composed final frame. The final editor may cut this shorter to match the voiceover. Avoid re-inventing the subject or background. No spoken audio, music, captions, text, logos, subtitles, or watermark.`,
      steps: [
        "Upload the lead photo to Higgsfield media and copy the media_id.",
        "Generate the still with model gpt_image_2 using the media_id as role=image and the still direction.",
        "Review the still for likeness, cinematic hook, composition, and personalization before animation.",
        "Generate video with Kling 3.0 image-to-video using the still image job id as role=start_image.",
        "Save media_id, still job/url, and video job/url back to this scene.",
      ],
    };
  });
}
