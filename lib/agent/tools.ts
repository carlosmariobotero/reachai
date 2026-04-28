import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { Resend } from "resend";
import type { AgentToolResult } from "../types";
import {
  createLead,
  saveLeadResearch,
  saveLeadScript,
  saveLeadVideo,
  updateLeadStatus,
  updateCampaignStatus,
} from "../integrations/supabase";

const resend = new Resend(process.env.RESEND_API_KEY!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const agentTools: Anthropic.Tool[] = [
  {
    name: "scrape_leads",
    description:
      "Search Apollo.io for leads matching the ICP criteria and persist them to Supabase.",
    input_schema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string", description: "Campaign ID to attach leads to" },
        job_titles: {
          type: "array",
          items: { type: "string" },
          description: "Target job titles",
        },
        company_size: {
          type: "string",
          description: "Apollo employee range string, e.g. '11,50'",
        },
        geography: {
          type: "array",
          items: { type: "string" },
          description: "Target locations",
        },
        lead_count: { type: "number", description: "Number of leads to fetch" },
      },
      required: ["campaign_id", "job_titles", "company_size", "geography", "lead_count"],
    },
  },
  {
    name: "research_lead",
    description:
      "Research a lead via Perplexity and save the summary to Supabase.",
    input_schema: {
      type: "object" as const,
      properties: {
        lead_id: { type: "string" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        company: { type: "string" },
        title: { type: "string" },
        linkedin_url: { type: "string" },
      },
      required: ["lead_id", "first_name", "last_name", "company"],
    },
  },
  {
    name: "generate_script",
    description:
      "Use Claude to generate a personalized video script and outreach email, then save to Supabase.",
    input_schema: {
      type: "object" as const,
      properties: {
        lead_id: { type: "string" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        company: { type: "string" },
        title: { type: "string" },
        research_summary: { type: "string" },
        pain_point: { type: "string" },
        client_name: { type: "string" },
        website_url: { type: "string" },
      },
      required: [
        "lead_id",
        "first_name",
        "last_name",
        "company",
        "research_summary",
        "pain_point",
        "client_name",
      ],
    },
  },
  {
    name: "generate_video",
    description:
      "Submit a HeyGen video generation job and poll until complete, then save the URL to Supabase.",
    input_schema: {
      type: "object" as const,
      properties: {
        lead_id: { type: "string" },
        video_script: { type: "string" },
      },
      required: ["lead_id", "video_script"],
    },
  },
  {
    name: "deliver_lead",
    description:
      "Send the personalized outreach email with video link to the lead via Resend.",
    input_schema: {
      type: "object" as const,
      properties: {
        lead_id: { type: "string" },
        first_name: { type: "string" },
        email: { type: "string" },
        outreach_message: { type: "string" },
        video_url: { type: "string" },
        client_name: { type: "string" },
      },
      required: [
        "lead_id",
        "first_name",
        "email",
        "outreach_message",
        "video_url",
        "client_name",
      ],
    },
  },
  {
    name: "update_campaign_progress",
    description: "Update campaign status and counters in Supabase.",
    input_schema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        status: {
          type: "string",
          enum: ["draft", "scraping", "active", "paused", "completed"],
        },
        total_leads: { type: "number" },
        researched: { type: "number" },
        scripts_done: { type: "number" },
        videos_generated: { type: "number" },
        emails_sent: { type: "number" },
        responses: { type: "number" },
      },
      required: ["campaign_id", "status"],
    },
  },
];

// ─── Tool implementations ─────────────────────────────────────────────────────

async function scrapeLeads(input: Record<string, unknown>): Promise<AgentToolResult> {
  const campaignId = input.campaign_id as string;
  const jobTitles = input.job_titles as string[];
  const companySize = input.company_size as string;
  const geography = input.geography as string[];
  const leadCount = input.lead_count as number;

  const response = await axios.post(
    "https://api.apollo.io/v1/mixed_people/search",
    {
      person_titles: jobTitles,
      organization_num_employees_ranges: [companySize],
      person_locations: geography,
      per_page: leadCount,
    },
    {
      headers: {
        "X-Api-Key": process.env.APOLLO_API_KEY!,
        "Content-Type": "application/json",
      },
    }
  );

  const people: Record<string, unknown>[] = response.data?.people ?? [];
  const created: string[] = [];

  for (const person of people) {
    const org = person.organization as Record<string, unknown> | null;
    const lead = await createLead({
      campaignId,
      firstName: (person.first_name as string) ?? "",
      lastName: (person.last_name as string) ?? "",
      email: (person.email as string) ?? "",
      company: (org?.name as string) ?? undefined,
      title: (person.title as string) ?? undefined,
      linkedinUrl: (person.linkedin_url as string) ?? undefined,
      location: (person.city as string) ?? undefined,
    });
    created.push(lead.id);
  }

  return { success: true, data: { leads_created: created.length, lead_ids: created } };
}

async function researchLead(input: Record<string, unknown>): Promise<AgentToolResult> {
  const leadId = input.lead_id as string;
  const firstName = input.first_name as string;
  const lastName = input.last_name as string;
  const company = input.company as string;
  const title = (input.title as string | undefined) ?? "";
  const linkedinUrl = (input.linkedin_url as string | undefined) ?? "";

  const prompt = `Research ${firstName} ${lastName}, ${title} at ${company}.${
    linkedinUrl ? ` LinkedIn: ${linkedinUrl}.` : ""
  } Provide a 3–5 sentence summary covering: recent company news or growth, their likely priorities and pain points in their role, and any notable achievements. Be factual and specific.`;

  const response = await axios.post(
    "https://api.perplexity.ai/chat/completions",
    {
      model: "sonar",
      messages: [{ role: "user", content: prompt }],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY!}`,
        "Content-Type": "application/json",
      },
    }
  );

  const summary: string = response.data?.choices?.[0]?.message?.content ?? "";
  await saveLeadResearch(leadId, summary);

  return { success: true, data: { research_summary: summary } };
}

async function generateScript(input: Record<string, unknown>): Promise<AgentToolResult> {
  const leadId = input.lead_id as string;
  const firstName = input.first_name as string;
  const lastName = input.last_name as string;
  const company = input.company as string;
  const title = (input.title as string | undefined) ?? "";
  const researchSummary = input.research_summary as string;
  const painPoint = input.pain_point as string;
  const clientName = input.client_name as string;
  const websiteUrl = (input.website_url as string | undefined) ?? "";

  const response = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are writing personalized outreach for ${clientName}.

Lead: ${firstName} ${lastName}, ${title} at ${company}
Research: ${researchSummary}
Our solution addresses: ${painPoint}
${websiteUrl ? `Website: ${websiteUrl}` : ""}

Return ONLY valid JSON with two keys:
- "video_script": a 150–200 word spoken video script (conversational, first-person, reference a specific detail from the research)
- "outreach_message": a 3–4 sentence email body referencing the video (no subject line, no greeting, no sign-off)`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch?.[0] ?? "{}") as {
    video_script?: string;
    outreach_message?: string;
  };

  const videoScript = parsed.video_script ?? "";
  const outreachMessage = parsed.outreach_message ?? "";

  await saveLeadScript(leadId, videoScript, outreachMessage);

  return { success: true, data: { video_script: videoScript, outreach_message: outreachMessage } };
}

async function generateVideo(input: Record<string, unknown>): Promise<AgentToolResult> {
  const leadId = input.lead_id as string;
  const videoScript = input.video_script as string;
  const avatarId = process.env.HEYGEN_AVATAR_ID!;

  const genResponse = await axios.post(
    "https://api.heygen.com/v2/video/generate",
    {
      video_inputs: [
        {
          character: { type: "avatar", avatar_id: avatarId },
          voice: {
            type: "text",
            input_text: videoScript,
            voice_id: "2d5b0e6cf36f460aa7fc47e3eee4ba54",
          },
        },
      ],
      dimension: { width: 1280, height: 720 },
    },
    {
      headers: {
        "X-Api-Key": process.env.HEYGEN_API_KEY!,
        "Content-Type": "application/json",
      },
    }
  );

  const videoId: string = genResponse.data?.data?.video_id ?? "";
  if (!videoId) throw new Error("HeyGen did not return a video_id");

  await updateLeadStatus(leadId, "video_generating");

  for (let attempt = 0; attempt < 30; attempt++) {
    await sleep(20_000);

    const statusResponse = await axios.get(
      `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
      {
        headers: { "X-Api-Key": process.env.HEYGEN_API_KEY! },
      }
    );

    const videoStatus: string = statusResponse.data?.data?.status ?? "";
    const videoUrl: string = statusResponse.data?.data?.video_url ?? "";

    if (videoStatus === "completed" && videoUrl) {
      await saveLeadVideo(leadId, videoUrl, videoId);
      return { success: true, data: { video_id: videoId, video_url: videoUrl } };
    }

    if (videoStatus === "failed") {
      throw new Error(`HeyGen video ${videoId} failed`);
    }
  }

  throw new Error(`HeyGen video ${videoId} timed out after 10 minutes`);
}

async function deliverLead(input: Record<string, unknown>): Promise<AgentToolResult> {
  const leadId = input.lead_id as string;
  const firstName = input.first_name as string;
  const email = input.email as string;
  const outreachMessage = input.outreach_message as string;
  const videoUrl = input.video_url as string;
  const clientName = input.client_name as string;

  const fromAddress = process.env.RESEND_FROM_EMAIL ?? `outreach@${process.env.NEXT_PUBLIC_APP_URL?.replace("https://", "") ?? "reachai.com"}`;

  await resend.emails.send({
    from: fromAddress,
    to: email,
    subject: `A personal message for you, ${firstName}`,
    html: `<p>${outreachMessage.replace(/\n/g, "<br/>")}</p>
<p><a href="${videoUrl}" style="display:inline-block;padding:12px 24px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:6px;">Watch my personal video for you →</a></p>
<p style="color:#6B7280;font-size:12px;">You're receiving this because ${clientName} identified you as someone who may benefit from a conversation.</p>`,
  });

  await updateLeadStatus(leadId, "emailed");

  return { success: true, data: { delivered: true, email } };
}

async function updateCampaignProgress(
  input: Record<string, unknown>
): Promise<AgentToolResult> {
  const campaignId = input.campaign_id as string;
  const status = input.status as
    | "draft"
    | "scraping"
    | "active"
    | "paused"
    | "completed";

  await updateCampaignStatus(campaignId, status, {
    totalLeads: input.total_leads as number | undefined,
    researched: input.researched as number | undefined,
    scriptsDone: input.scripts_done as number | undefined,
    videosGenerated: input.videos_generated as number | undefined,
    emailsSent: input.emails_sent as number | undefined,
    responses: input.responses as number | undefined,
  });

  return { success: true, data: { updated: true } };
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<AgentToolResult> {
  try {
    switch (toolName) {
      case "scrape_leads":
        return await scrapeLeads(toolInput);
      case "research_lead":
        return await researchLead(toolInput);
      case "generate_script":
        return await generateScript(toolInput);
      case "generate_video":
        return await generateVideo(toolInput);
      case "deliver_lead":
        return await deliverLead(toolInput);
      case "update_campaign_progress":
        return await updateCampaignProgress(toolInput);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
