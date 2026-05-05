import Anthropic from "@anthropic-ai/sdk";
import type { Campaign, CreativeBrief, CreativeScenePlan, Lead } from "../types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const DEFAULT_CREATIVE_MODEL = "claude-sonnet-4-20250514";
const CREATIVE_MODEL = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_CREATIVE_MODEL;

function parseJsonObject(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Creative agent returned no JSON object");
  return JSON.parse(match[0]);
}

function fallbackBrief(campaign: Campaign, lead: Lead): {
  clientResearchSummary: string;
  leadResearchSummary: string;
  creativeBrief: CreativeBrief;
} {
  const leadName = `${lead.firstName} ${lead.lastName}`.trim();
  const company = lead.company ?? "their company";
  const title = lead.title ?? "leader";
  const salesAngle = `${leadName} is treated like the protagonist of a premium short film: a leader who sees an invisible growth system before the market does.`;
  const world = `${company} becomes a cinematic command-center world inspired by ${campaign.clientName}'s core promise: ${campaign.painPoint}`;
  const scenePlan: CreativeScenePlan[] = [
    {
      sceneNumber: 1,
      durationSeconds: 7,
      objective: "Storyboard panel 1: mythic personalized hook",
      higgsfieldPrompt: `GPT IMAGE 2 STILL / STORYBOARD PANEL:
Medium/format: ultra-real cinematic keyframe from a prestige technology thriller, 16:9, photoreal, 4K detail.
Subject/action: using the uploaded lead photo as identity reference, ${leadName}, ${title} at ${company}, stands as the protagonist inside ${world}; subtle company-relevant symbols appear as physical set pieces, not text.
Technical specs: anamorphic lens, low-angle hero framing, shallow depth of field, layered foreground reflections, precise spatial composition.
Lighting/color: dramatic mixed lighting, warm edge light against cool environmental glow, premium film color science, tasteful grain.
Texture/detail: glass, metal, paper, screens, atmospheric depth, realistic skin texture, natural wardrobe, editorial production design.
Text/typography: no readable text, no logos, no captions inside the generated image.
Negative constraints: no cartoon look, no generic office stock photo, no distorted face, no extra fingers, no watermark.

KLING 3.0 MOTION DIRECTION:
The camera slowly dollies in from a low angle as environmental lights wake up around the lead. The lead holds a calm confident expression, natural breathing, tiny eye movement, jacket fabric moving subtly. Motion is elegant and restrained, like a film trailer opening shot.`,
      captionText: `${lead.firstName}, this was built around you.`,
    },
    {
      sceneNumber: 2,
      durationSeconds: 7,
      objective: "Storyboard panel 2: impossible-to-ignore market tension",
      higgsfieldPrompt: `GPT IMAGE 2 STILL / STORYBOARD PANEL:
Medium/format: cinematic still from a high-concept business sci-fi film, 16:9, photoreal, dense but readable composition.
Subject/action: ${leadName} studies a surreal physical map of buyer attention: fragmented inboxes, LinkedIn signals, missed meetings, and opportunity paths orbiting the room like holographic architecture. ${company}'s business context should influence the set design without using logos.
Technical specs: wide establishing shot with strong depth layers, 35mm lens, leading lines toward the lead, realistic perspective.
Lighting/color: tense contrast, practical office light colliding with cinematic neon accents, volumetric atmosphere.
Texture/detail: tactile dashboards, glass reflections, believable papers, premium surfaces, realistic human posture.
Text/typography: no readable text in the image, no fake interface copy.
Negative constraints: no messy collage, no cheesy AI glow, no stock-photo boardroom, no distorted likeness.

KLING 3.0 MOTION DIRECTION:
Slow tracking move around the lead as the floating opportunity map rearranges itself. Holographic paths shift softly, reflections glide across glass, the lead turns their gaze with natural weight and focus. No fast cuts, no chaotic motion.`,
      captionText: "Your market is already moving.",
    },
    {
      sceneNumber: 3,
      durationSeconds: 8,
      objective: "Storyboard panel 3: transformation and invitation",
      higgsfieldPrompt: `GPT IMAGE 2 STILL / STORYBOARD PANEL:
Medium/format: final hero frame from an aspirational commercial film, 16:9, photoreal, cinematic production design.
Subject/action: ${leadName} watches a cinematic outreach engine come alive: personalized video frames, qualified conversations, and meeting signals forming a luminous path from cold attention to real conversations for ${company}.
Technical specs: balanced heroic wide shot, elegant foreground depth, clean composition, premium lens rendering.
Lighting/color: optimistic sunrise-grade light, polished reflections, controlled highlights, rich but natural colors.
Texture/detail: precise glass, metal, fabric, skin texture, realistic screens with abstract non-readable UI shapes.
Text/typography: no readable text, no logos, no captions inside image.
Negative constraints: no generic startup dashboard, no fake words, no watermark, no distorted person.

KLING 3.0 MOTION DIRECTION:
Camera cranes slightly upward and pushes forward as the light path forms. The lead relaxes into a confident posture; background elements move with realistic physics and subtle parallax. End on a composed, premium final frame.`,
      captionText: "ReachAI turns attention into meetings.",
    },
  ];

  return {
    clientResearchSummary: `${campaign.clientName} helps prospects solve: ${campaign.painPoint}`,
    leadResearchSummary: `${leadName} is a ${title} at ${company}.`,
    creativeBrief: {
      salesAngle,
      voiceoverScript: `${lead.firstName}, imagine opening a video that actually looks like it was made for you. That is the point. ReachAI helps teams turn cold outreach into cinematic, personal moments that earn attention and start real conversations.`,
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
    durationSeconds: Math.min(Math.max(scene.duration_seconds ?? 7, 5), 8),
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

  const prompt = `You are ReachAI's chief film director, AI cinematographer, and cold-outreach creative strategist.

Create a 24-30 second hyper-personalized AI video where the lead is the main character. This cannot feel like a generic B2B video. It must feel like a miniature film trailer, luxury commercial, or viral cinematic concept made specifically around the lead and their company.

New creative workflow:
1. Think in one storyboard first: GPT Image 2 can create dense cinematic compositions, photoreal scenes, precise spatial relationships, and rich layout. Design the whole video as a 3-panel movie storyboard.
2. Then turn each panel into a GPT Image 2 still prompt.
3. Then turn each still into a Kling 3.0-style image-to-video motion prompt.

Use this GPT Image 2 still prompt structure inside every scene:
- Medium/format: the world and visual form of the image.
- Subject/action: the lead as protagonist, using the uploaded photo as actual identity reference.
- Technical specs: lens, framing, perspective, composition, depth.
- Lighting/color: atmosphere, mood, color science, practical/mixed lighting.
- Texture/detail: micro-specific production details.
- Text/typography: usually no readable text, unless explicitly useful.
- Negative constraints: cleanup rules.

Use this Kling 3.0 motion structure inside every scene:
- What moves.
- Camera behavior.
- Pacing and motion quality.
- Environmental changes.
- Realistic physics / human motion details.

The result must be artful, cinematic, and highly personalized. Think: a major theatrical film's sense of wonder, premium commercial craft, and a sharp sales strategy underneath. Do not copy or name a living director in the output; use professional cinematic language instead.

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
  "sales_angle": "one clear persuasive angle",
  "voiceover_script": "45-70 words, narrator talks to the lead, no greeting, no fake claim that the lead said anything",
  "outreach_message": "2-3 sentence cold email body referencing the video",
  "scene_plan": [
    {
      "scene_number": 1,
      "duration_seconds": 7,
      "objective": "storyboard panel 1: personalized cinematic hook",
      "higgsfield_prompt": "Include two labeled sections: GPT IMAGE 2 STILL / STORYBOARD PANEL and KLING 3.0 MOTION DIRECTION. Make the still wildly cinematic, personalized, photoreal, dense with meaningful production design, and no watermark. Make the motion direction specific, realistic, and camera-aware.",
      "caption_text": "short on-screen caption"
    },
    {
      "scene_number": 2,
      "duration_seconds": 7,
      "objective": "storyboard panel 2: tension, pain, or missed opportunity",
      "higgsfield_prompt": "Include the same two labeled sections. Visualize the business pain as a cinematic metaphor tied to the lead/company. Avoid generic office scenes.",
      "caption_text": "short on-screen caption"
    },
    {
      "scene_number": 3,
      "duration_seconds": 8,
      "objective": "storyboard panel 3: transformation and CTA",
      "higgsfield_prompt": "Include the same two labeled sections. Show the future outcome as a premium cinematic reveal.",
      "caption_text": "short on-screen caption"
    }
  ]
}

Rules:
- Keep the video under 30 seconds.
- Make every scene useful for selling.
- Do not mention fake facts.
- Do not make the lead speak. The narrator speaks to the lead.
- Every image prompt must say the uploaded lead photo is the actual identity reference.
- Make every scene feel impossible to get from a stock template.
- Prefer photoreal cinematic scenes over plain offices.
- Strong personalization should come from the lead's role, company, industry, geography, client offer, and business pain.
- Avoid readable text inside generated images unless absolutely necessary; captions are handled separately.
- No logos, watermarks, subtitles, fake UI copy, distorted faces, or generic stock-photo business scenes.
- Kling motion directions should not re-describe every visible object; focus on motion, camera, pacing, and environmental changes.`;

  const response = await anthropic.messages.create({
    model: CREATIVE_MODEL,
    max_tokens: 2200,
    temperature: 0.7,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content.find((block) => block.type === "text")?.text ?? "";
  return normalizeBrief(parseJsonObject(text));
}
