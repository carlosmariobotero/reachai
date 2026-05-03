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
  const salesAngle = `${leadName} is shown as the hero who spots a growth bottleneck before competitors do.`;
  const scenePlan: CreativeScenePlan[] = [
    {
      sceneNumber: 1,
      durationSeconds: 7,
      objective: "Personalized cinematic hook",
      higgsfieldPrompt: `${leadName}, ${title} at ${company}, looks confident in a premium cinematic business environment. The scene feels custom-made for them, polished, realistic, high-end commercial lighting, no text, no watermark.`,
      captionText: `${lead.firstName}, this was built around you.`,
    },
    {
      sceneNumber: 2,
      durationSeconds: 7,
      objective: "Visualize the missed opportunity",
      higgsfieldPrompt: `${leadName} studies a sharp visual wall of growth signals, missed opportunities, and buyer attention shifting online. Premium B2B ad style, realistic likeness, cinematic camera movement, no text, no watermark.`,
      captionText: "Your market is already moving.",
    },
    {
      sceneNumber: 3,
      durationSeconds: 8,
      objective: "Show the outcome and CTA",
      higgsfieldPrompt: `${leadName} sees a polished AI-powered outreach engine creating personalized videos and qualified conversations for ${company}. Premium future-of-sales visual, cinematic, realistic, optimistic, no text, no watermark.`,
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

  const prompt = `You are ReachAI's cold-outreach creative director.

Create a 30-second hyper-personalized AI video concept where the lead is the main character. The goal is to impress the lead with quality and likeness, then sell ReachAI's service.

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
      "objective": "personalized hook",
      "higgsfield_prompt": "silent cinematic scene prompt; lead is main character; preserve likeness; premium commercial look; no text/watermark",
      "caption_text": "short on-screen caption"
    },
    {
      "scene_number": 2,
      "duration_seconds": 7,
      "objective": "pain or missed opportunity",
      "higgsfield_prompt": "silent cinematic scene prompt",
      "caption_text": "short on-screen caption"
    },
    {
      "scene_number": 3,
      "duration_seconds": 8,
      "objective": "outcome and CTA",
      "higgsfield_prompt": "silent cinematic scene prompt",
      "caption_text": "short on-screen caption"
    }
  ]
}

Rules:
- Keep the video under 30 seconds.
- Make every scene useful for selling.
- Do not mention fake facts.
- Do not make the lead speak. The narrator speaks to the lead.
- Higgsfield prompts must be visually specific, premium, realistic, and silent.`;

  const response = await anthropic.messages.create({
    model: CREATIVE_MODEL,
    max_tokens: 2200,
    temperature: 0.7,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content.find((block) => block.type === "text")?.text ?? "";
  return normalizeBrief(parseJsonObject(text));
}
