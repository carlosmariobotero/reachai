import Anthropic from "@anthropic-ai/sdk";
import type { Campaign, CreativeBrief, CreativeScenePlan, Lead } from "../types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const DEFAULT_CREATIVE_MODEL = "claude-sonnet-4-20250514";
const CREATIVE_MODEL = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_CREATIVE_MODEL;

function parseJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1] ?? text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Creative agent returned no JSON object");
  }

  const json = source
    .slice(start, end + 1)
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

  return JSON.parse(json);
}

function fallbackBrief(campaign: Campaign, lead: Lead): {
  clientResearchSummary: string;
  leadResearchSummary: string;
  creativeBrief: CreativeBrief;
} {
  const leadName = `${lead.firstName} ${lead.lastName}`.trim();
  const company = lead.company ?? "their company";
  const title = lead.title ?? "leader";
  const salesAngle = `${leadName} is treated like the protagonist of a short cinematic story: a ${title} who turns operational noise into visible control.`;
  const world = `${company}'s scattered responsibilities, evidence, risks, and process loops become a physical world that ${leadName} can enter, confront, and reorganize.`;
  const scenePlan: CreativeScenePlan[] = [
    {
      sceneNumber: 1,
      durationSeconds: 10,
      objective: "Cold open: the hidden system reveals itself",
      higgsfieldPrompt: `GPT IMAGE 2 STILL / STORYBOARD PANEL:
Big idea: ${leadName} discovers that the invisible operating system behind ${company} has become a real place.
Medium/format: photoreal cinematic cold-open keyframe, 16:9, premium film look, dramatic but believable.
Subject/action: using the uploaded lead photo as the actual identity reference, ${leadName} opens an elevator door into ${world}; loose papers, audit trails, and process paths float in a vast architectural space beyond the door.
Technical specs: over-the-shoulder reveal, 28mm lens, deep perspective, strong foreground doorway frame, one clear focal subject, no clutter.
Lighting/color: practical elevator light behind the lead, cool blue-green operational glow ahead, controlled contrast, natural skin tone.
Texture/detail: brushed metal elevator doors, paper fibers, glass rails, subtle dust in the beam, realistic wardrobe and skin.
Text/typography: no readable text, no logos, no captions inside image.
Negative constraints: no generic office, no dashboard wall, no fake words, no distorted face, no watermark.

KLING 3.0 MOTION DIRECTION:
0-3s: elevator doors slide open and a gust lifts the papers. 3-7s: camera pushes past ${leadName}'s shoulder into the impossible operations space as light paths activate. 7-10s: ${leadName} steps forward with calm focus, ending on a strong hero frame. Preserve face identity, natural movement, realistic physics, no audio, no text.`,
      captionText: `${lead.firstName}, your operations have a hidden shape.`,
    },
    {
      sceneNumber: 2,
      durationSeconds: 10,
      objective: "Conflict: scattered work becomes a physical obstacle",
      higgsfieldPrompt: `GPT IMAGE 2 STILL / STORYBOARD PANEL:
Big idea: the cost of disconnected tools becomes a dramatic obstacle ${leadName} must control.
Medium/format: cinematic action still from a grounded business-thriller sequence, 16:9, photoreal.
Subject/action: ${leadName} stands on a narrow glass bridge as folders, inboxes, spreadsheet grids, risk cards, and approval stamps move like a storm around him; he reaches for one glowing process thread that can connect them.
Technical specs: 35mm lens, diagonal composition, strong sense of motion frozen mid-action, negative space around the face, realistic perspective.
Lighting/color: high-contrast pressure scene, cool storm light, warm rim light on the lead, atmospheric depth.
Texture/detail: glass bridge, paper edges, metal cables, dust, reflections, realistic hands and clothing.
Text/typography: no readable text, no logos, no captions inside image.
Negative constraints: no cluttered collage, no cheesy neon, no fake UI copy, no extra fingers, no distorted likeness, no watermark.

KLING 3.0 MOTION DIRECTION:
0-3s: the paper-and-process storm accelerates around ${leadName}. 3-7s: he grabs the glowing thread and pulls, causing several fragments to snap into alignment. 7-10s: camera arcs left as the storm slows and the bridge stabilizes under him. Preserve identity, make the action readable, no audio, no text.`,
      captionText: "Scattered systems slow the people trying to scale.",
    },
    {
      sceneNumber: 3,
      durationSeconds: 10,
      objective: "Payoff: one system locks into place",
      higgsfieldPrompt: `GPT IMAGE 2 STILL / STORYBOARD PANEL:
Big idea: ${leadName} turns the chaos into one visible operating system.
Medium/format: aspirational cinematic finale keyframe, 16:9, photoreal, premium commercial craft.
Subject/action: ${leadName} places the glowing process thread into a central glass console; the storm of evidence, risk, audits, and responsibilities forms a clean luminous architecture around the team.
Technical specs: heroic wide shot, 50mm anamorphic look, foreground console detail, clean silhouettes, elegant depth layers.
Lighting/color: sunrise-grade payoff light, controlled green-gold clarity accents, polished reflections, natural skin tones.
Texture/detail: glass console, metal, fabric, soft background team silhouettes, abstract dashboard shapes with no words.
Text/typography: no readable text, no logos, no captions inside image.
Negative constraints: no generic dashboard, no fake text, no cartoon glow, no distorted body, no watermark.

KLING 3.0 MOTION DIRECTION:
0-3s: ${leadName} places the thread into the console. 3-7s: the scattered fragments assemble into clean process pathways around the room, with subtle team reactions in soft focus. 7-10s: camera cranes upward into a polished final hero frame. Preserve likeness, realistic physics, no audio, no text.`,
      captionText: `${campaign.clientName} gives the whole system one place to live.`,
    },
  ];

  return {
    clientResearchSummary: `${campaign.clientName} helps prospects solve: ${campaign.painPoint}`,
    leadResearchSummary: `${leadName} is a ${title} at ${company}.`,
    creativeBrief: {
      salesAngle,
      voiceoverScript: `${lead.firstName}, every growing operation has a hidden shape: scattered work, missed context, and decisions spread across tools. ${campaign.clientName} turns that noise into one visible system, so leaders can see what is happening, fix what is stuck, and scale with control.`,
      outreachMessage: `${lead.firstName}, I made a short personalized video concept around you and ${company}. It shows how ReachAI can turn cold outreach into high-quality moments that feel impossible to ignore. Worth a quick look?`,
      scenePlan,
    },
  };
}

function normalizeBrief(value: unknown): {
  clientResearchSummary: string;
  leadResearchSummary: string;
  creativeBrief: CreativeBrief;
} {
  const parsed = value as {
    client_research_summary?: string;
    lead_research_summary?: string;
    sales_angle?: string;
    voiceover_script?: string;
    outreach_message?: string;
    scene_plan?: Array<{
      scene_number?: number;
      duration_seconds?: number;
      objective?: string;
      higgsfield_prompt?: string;
      caption_text?: string;
    }>;
  };

  const scenePlan = (parsed.scene_plan ?? []).slice(0, 3).map((scene, index) => ({
    sceneNumber: scene.scene_number ?? index + 1,
    durationSeconds: Math.min(Math.max(scene.duration_seconds ?? 10, 8), 10),
    objective: scene.objective ?? `Scene ${index + 1}`,
    higgsfieldPrompt: scene.higgsfield_prompt ?? "",
    captionText: scene.caption_text ?? "",
  }));

  if (scenePlan.length !== 3 || scenePlan.some((scene) => !scene.higgsfieldPrompt)) {
    throw new Error("Creative agent must return exactly three populated scenes");
  }

  return {
    clientResearchSummary: parsed.client_research_summary ?? "",
    leadResearchSummary: parsed.lead_research_summary ?? "",
    creativeBrief: {
      salesAngle: parsed.sales_angle ?? "",
      voiceoverScript: parsed.voiceover_script ?? "",
      outreachMessage: parsed.outreach_message ?? "",
      scenePlan,
    },
  };
}

export async function generateCreativeBrief(
  campaign: Campaign,
  lead: Lead
): Promise<{
  clientResearchSummary: string;
  leadResearchSummary: string;
  creativeBrief: CreativeBrief;
}> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return fallbackBrief(campaign, lead);
  }

  const prompt = `You are ReachAI's research strategist, story architect, film director, AI cinematographer, and cold-outreach creative lead.

Create a 24-30 second hyper-personalized AI video where the lead is the main character. This cannot feel like a generic B2B video, a person in front of dashboards, or a prettier stock office. It must feel like a short film concept made specifically around the lead's role, company, location, and business pressure.

Internal workflow:
1. Research lens: identify what is actually specific about the lead. Role tension, company context, geography, industry, public position, and what they personally have to care about.
2. Story lens: invent one visual metaphor that only makes sense for this lead and client. The metaphor should have a beginning, conflict, and payoff across three scenes.
3. Cinema lens: make every scene a decisive shot with one strong visual idea, one readable action, and one emotional beat. Use cinematic grammar: cold open, reveal, tension, reversal, transformation, visual payoff, motivated camera, foreground/midground/background depth, practical light, and negative space.
4. AI generation lens: write prompts that give GPT Image 2 a clean image hierarchy and give Kling 3.0 a real action beat over time.

The difference between good and bad:
- Bad: "executive in modern office with dashboards."
- Better: "the lead opens an elevator into a physical maze of scattered audit trails."
- Bad: lots of objects.
- Better: one surprising image that makes the business pain instantly understandable.
- Bad video: "subtle camera push, breathing, lights move."
- Better video: the person performs an action that changes the world of the scene.

Use this GPT Image 2 still prompt structure inside every scene:
- Big idea: one sentence explaining the visual metaphor.
- Medium/format: photoreal cinematic still, genre, aspect ratio.
- Subject/action: the lead as protagonist, using uploaded photo as actual identity reference.
- Composition/camera: lens, angle, framing, depth, negative space, what is foreground/midground/background.
- Lighting/color: motivated light, mood, palette, contrast.
- Production detail: only details that support the metaphor; avoid object spam.
- Text/typography: no readable text unless truly necessary.
- Negative constraints.

Use this Kling 3.0 motion structure inside every scene:
- 0-3 seconds: opening action.
- 3-7 seconds: escalation or transformation.
- 7-10 seconds: payoff frame.
- Subject action: the lead must do something meaningful, not just stand still.
- Camera behavior: one motivated move, not random movement.
- Environmental action: the world changes because of the lead's action.
- Realistic physics and identity preservation.

The result must be artful, cinematic, and highly personalized. It should borrow from the craft principles of great cinema and premium commercials: suspense, wonder, kinetic blocking, strong silhouettes, visual cause-and-effect, and emotional payoff. Do not copy or name living directors in the output; use professional cinematic language instead.

Client:
- Name: ${campaign.clientName}
- Website: ${campaign.websiteUrl}
- Offer / pain solved: ${campaign.painPoint}
- Target industries: ${campaign.industries.join(", ")}

Lead:
- Name: ${lead.firstName} ${lead.lastName}
- Title: ${lead.title ?? "Unknown"}
- Company: ${lead.company ?? "Unknown"}
- LinkedIn: ${lead.linkedinUrl ?? "N/A"}
- Location: ${lead.location ?? "Unknown"}

Research the client and the lead/company. Then return ONLY valid JSON with:
{
  "client_research_summary": "2-4 factual sentences",
  "lead_research_summary": "2-4 factual sentences",
  "sales_angle": "one clear persuasive angle that connects the lead's specific role pressure to the client's offer",
  "voiceover_script": "50-62 words, written for a 24-29 second final edit at natural narrator pace; narrator talks to the lead, no greeting, no fake claim that the lead said anything",
  "outreach_message": "2-3 sentence cold email body referencing the video",
  "scene_plan": [
    {
      "scene_number": 1,
      "duration_seconds": 10,
      "objective": "cold open: a surprising personalized hook",
      "higgsfield_prompt": "Include two labeled sections: GPT IMAGE 2 STILL / STORYBOARD PANEL and KLING 3.0 MOTION DIRECTION. The image must have one clear visual metaphor, one cinematic composition, and one action-ready setup. The motion must include 0-3s, 3-7s, and 7-10s beats where the lead does something meaningful. Treat this as a 10-second source clip that the editor can cut shorter.",
      "caption_text": "short on-screen caption"
    },
    {
      "scene_number": 2,
      "duration_seconds": 10,
      "objective": "conflict: business pain becomes a visual obstacle",
      "higgsfield_prompt": "Include the same two labeled sections. Visualize the pain as a physical cinematic event that only fits this lead's role/company. Avoid dashboards, generic offices, and object spam. Treat this as a 10-second source clip that the editor can cut shorter.",
      "caption_text": "short on-screen caption"
    },
    {
      "scene_number": 3,
      "duration_seconds": 10,
      "objective": "payoff: transformation and invitation",
      "higgsfield_prompt": "Include the same two labeled sections. Show the lead taking one decisive action that turns the conflict into the client's promised outcome. End with a premium final frame. Treat this as a 10-second source clip that the editor can cut shorter.",
      "caption_text": "short on-screen caption"
    }
  ]
}

Rules:
- Keep the video under 30 seconds.
- Make every scene useful for selling.
- Make the three scenes feel like one connected mini-story, not three separate stock images.
- Every lead must get a different story concept. Do not reuse the same command-center, boardroom, dashboard, or floating UI idea unless it is uniquely justified.
- Each scene must have one dominant visual idea. Do not make the image "more cinematic" by adding more objects.
- Every Kling direction must include a beginning, middle, and end across a 10-second source clip. The lead should take an action that changes the scene.
- The three generated scene videos are 10-second handles for editing. The final outreach video should still feel like 24-29 seconds, so write the voiceover short enough to fit the cut.
- Do not mention fake facts.
- Do not make the lead speak. The narrator speaks to the lead.
- Every image prompt must say the uploaded lead photo is the actual identity reference.
- Make every scene feel impossible to get from a stock template.
- Prefer photoreal cinematic story events over plain offices.
- Strong personalization should come from the lead's role, company, industry, geography, client offer, and business pain.
- Avoid readable text inside generated images unless absolutely necessary; captions are handled separately.
- No logos, watermarks, subtitles, fake UI copy, distorted faces, or generic stock-photo business scenes.
- Kling motion directions should not re-describe every visible object; focus on action, camera, pacing, and environmental changes.`;

  const response = await anthropic.messages.create({
    model: CREATIVE_MODEL,
    max_tokens: 3200,
    temperature: 0.85,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content.find((block) => block.type === "text")?.text ?? "";
  try {
    return normalizeBrief(parseJsonObject(text));
  } catch (error) {
    console.error("Creative agent JSON parse failed, using cinematic fallback:", error);
    return fallbackBrief(campaign, lead);
  }
}
