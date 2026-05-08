import type { Campaign, CreativeVideoJob, CreativeVideoScene, Lead } from "../types";

type MarketingStudioPreset = "UGC" | "Product Review" | "Tutorial";

type MarketingStudioHookName =
  | "Product Hit"
  | "Interview"
  | "Random Object Mic"
  | "Product Dodge"
  | "Epic Fail"
  | "Camera Bump";

type MarketingStudioSettingName =
  | "Office"
  | "Street"
  | "Roofing"
  | "In Car"
  | "Nature";

const MARKETING_STUDIO_HOOKS: Record<MarketingStudioHookName, string> = {
  "Product Hit": "3d45fb46-254f-4c83-9685-8e3d28945a67",
  Interview: "26cac2dd-99cb-4818-a678-509b0dab2c32",
  "Random Object Mic": "d50eb41c-fcfa-4f4d-93aa-473cdc6bc3b2",
  "Product Dodge": "5443eff1-d940-4ad3-9413-957bb048a6b0",
  "Epic Fail": "ec9fdf99-314d-480d-a656-10d9861341e7",
  "Camera Bump": "2db84ed8-7082-4981-9c9c-9d61b3c28668",
};

const MARKETING_STUDIO_SETTINGS: Record<MarketingStudioSettingName, string> = {
  Office: "d39dda10-643c-44e2-bfc8-2451dddde7d9",
  Street: "8c95f9ba-5849-44b1-82d0-9f6b33240758",
  Roofing: "3cf2164e-ffac-4867-9c43-1d673a5cb28a",
  "In Car": "fdfa032c-801f-4602-8dfd-1162b0f8c9c9",
  Nature: "10f47b85-abd7-4899-b6b6-91ff2969d3bf",
};

export interface MarketingStudioUgcTask {
  model: "marketing_studio_video";
  preset: MarketingStudioPreset;
  hookName: MarketingStudioHookName;
  hookId: string;
  settingName: MarketingStudioSettingName;
  settingId: string;
  productType: "webproduct";
  productUrl?: string;
  avatarName: string;
  prompt: string;
  workerSteps: string[];
}

export interface HiggsfieldMcpSceneTask {
  sceneId: string;
  leadId: string;
  creativeVideoJobId: string;
  sceneNumber: number;
  durationSeconds: number;
  leadPhotoUrl: string;
  generationMode: "marketing_studio_ugc" | "cinematic_still_to_video";
  marketingStudio?: MarketingStudioUgcTask;
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

function sectionAfterAny(prompt: string, labels: string[]): string {
  for (const label of labels) {
    const section = sectionBetween(prompt, label);
    if (section && section !== prompt.trim()) return section;
  }
  return "";
}

function chooseNamedOption<T extends string>(
  source: string,
  options: Record<T, string>,
  fallback: T
): T {
  const normalized = source.toLowerCase();
  const match = (Object.keys(options) as T[]).find((option) =>
    normalized.includes(option.toLowerCase())
  );
  return match ?? fallback;
}

function buildMarketingStudioTask(
  lead: Lead,
  campaign: Campaign | undefined,
  scene: CreativeVideoScene
): MarketingStudioUgcTask | undefined {
  const ugcDirection = sectionAfterAny(scene.higgsfieldPrompt, [
    "MARKETING STUDIO UGC DIRECTION",
    "HIGGSFIELD MARKETING STUDIO UGC DIRECTION",
  ]);

  if (!ugcDirection) return undefined;

  const preset: MarketingStudioPreset = ugcDirection.toLowerCase().includes("product review")
    ? "Product Review"
    : ugcDirection.toLowerCase().includes("tutorial")
      ? "Tutorial"
      : "UGC";
  const hookName = chooseNamedOption(
    ugcDirection,
    MARKETING_STUDIO_HOOKS,
    scene.sceneNumber === 1 ? "Product Hit" : scene.sceneNumber === 2 ? "Interview" : "Random Object Mic"
  );
  const settingName = chooseNamedOption(
    ugcDirection,
    MARKETING_STUDIO_SETTINGS,
    scene.sceneNumber === 1 ? "Street" : scene.sceneNumber === 2 ? "Office" : "Roofing"
  );
  const leadName = `${lead.firstName} ${lead.lastName}`.trim();
  const company = lead.company ?? "their company";
  const clientName = campaign?.clientName ?? "the client";
  const productUrl = campaign?.websiteUrl;

  return {
    model: "marketing_studio_video",
    preset,
    hookName,
    hookId: MARKETING_STUDIO_HOOKS[hookName],
    settingName,
    settingId: MARKETING_STUDIO_SETTINGS[settingName],
    productType: "webproduct",
    productUrl,
    avatarName: leadName || `Lead ${lead.id}`,
    prompt: `Create a silent, scroll-stopping ${preset} outreach clip for ${leadName || "the lead"} at ${company}. Use the uploaded lead photo as the avatar identity reference, but do not make the lead speak. The clip sells ${clientName} as the solution through visual action only; the final narrator voiceover will be added later by ReachAI.

Scene ${scene.sceneNumber} objective: ${scene.objective}

Creative direction:
${ugcDirection}

Keep it believable enough for B2B outreach, but use the selected Marketing Studio hook (${hookName}) and setting (${settingName}) to create a fast first-second pattern interrupt. No subtitles, no readable fake UI text, no logos, no watermarks, no spoken audio.`,
    workerSteps: [
      "Upload the lead photo to Higgsfield media_upload and media_confirm so it becomes a Higgsfield media URL.",
      "Create or reuse a Marketing Studio avatar for this lead using show_marketing_studio(action='create', type='avatar').",
      productUrl
        ? "Fetch the campaign website as a Marketing Studio webproduct with show_marketing_studio(action='fetch', type='webproduct', url=productUrl)."
        : "Create a lightweight Marketing Studio webproduct from the campaign summary if no website URL is available.",
      "Generate the clip with generate_video model='marketing_studio_video', preset/mode from this task, hook_id, setting_id, and the task prompt.",
      "Save the returned video job/url back to the scene. If Marketing Studio cannot use the lead avatar cleanly, fall back to the GPT Image 2 + Kling steps in the same task.",
    ],
  };
}

export function buildHiggsfieldMcpTasks(
  lead: Lead,
  job: CreativeVideoJob,
  scenes: CreativeVideoScene[],
  campaign?: Campaign
): HiggsfieldMcpSceneTask[] {
  if (!lead.profilePhotoUrl) {
    throw new Error("Lead profile photo is required before Higgsfield generation");
  }

  return scenes.map((scene) => {
    const stillDirection = sectionBetween(scene.higgsfieldPrompt, "GPT IMAGE 2 STILL / STORYBOARD PANEL", [
      "KLING 3.0 MOTION DIRECTION",
    ]);
    const motionDirection = sectionBetween(scene.higgsfieldPrompt, "KLING 3.0 MOTION DIRECTION");
    const marketingStudio = buildMarketingStudioTask(lead, campaign, scene);

    return {
      sceneId: scene.id,
      leadId: lead.id,
      creativeVideoJobId: job.id,
      sceneNumber: scene.sceneNumber,
      durationSeconds: scene.durationSeconds,
      leadPhotoUrl: lead.profilePhotoUrl!,
      generationMode: marketingStudio ? "marketing_studio_ugc" : "cinematic_still_to_video",
      marketingStudio,
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
