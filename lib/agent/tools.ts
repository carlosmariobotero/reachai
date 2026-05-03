import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { Resend } from "resend";
import type { AgentToolResult } from "../types";
import {
  createLead,
  saveLeadResearch,
  saveLeadScript,
  updateLeadStatus,
  updateCampaignStatus,
} from "../integrations/supabase";

const resend = new Resend(process.env.RESEND_API_KEY!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const DEFAULT_AGENT_MODEL = "claude-sonnet-4-20250514";
const AGENT_MODEL = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_AGENT_MODEL;
const APOLLO_PEOPLE_SEARCH_URL = "https://api.apollo.io/api/v1/mixed_people/api_search";
const APOLLO_LEGACY_SEARCH_URL = "https://api.apollo.io/v1/mixed_people/search";
const APOLLO_BULK_MATCH_URL = "https://api.apollo.io/api/v1/people/bulk_match";

function getApolloApiKey(): string {
  return process.env.APOLLO_API_KEY?.trim() ?? "";
}

function normalizeApolloCompanySize(companySize: string): string | undefined {
  const normalized = companySize.replace(/[–—-]/g, ",").replace(/\s+/g, "");
  const ranges: Record<string, string | undefined> = {
    "1,10": "1,10",
    "11,50": "11,50",
    "51,200": "51,200",
    "201,1K": "201,1000",
    "1K,5K": "1000,5000",
    "5K+": "5000,1000000",
  };
  return ranges[normalized] ?? normalized;
}

function normalizeApolloLocations(geography: string[]): string[] | undefined {
  const locations = geography.filter((location) => !location.toLowerCase().includes("global"));
  return locations.length > 0 ? locations : undefined;
}

function appendApolloFilters(
  params: URLSearchParams,
  input: {
    jobTitles: string[];
    companySize?: string;
    locations?: string[];
    leadCount: number;
  }
) {
  input.jobTitles.forEach((title) => params.append("person_titles[]", title));
  input.locations?.forEach((location) => params.append("person_locations[]", location));
  if (input.companySize) params.append("organization_num_employees_ranges[]", input.companySize);
  params.set("page", "1");
  params.set("per_page", String(input.leadCount));
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function linkedinUrlFor(person: Record<string, unknown>): string {
  const direct = asString(person.linkedin_url);
  if (direct) return direct;
  const contact = person.contact as Record<string, unknown> | undefined;
  return contact ? asString(contact.linkedin_url) : "";
}

function organizationFor(person: Record<string, unknown>): Record<string, unknown> | undefined {
  return person.organization as Record<string, unknown> | undefined;
}

function locationFor(person: Record<string, unknown>): string | undefined {
  return asString(person.city) || asString(person.state) || asString(person.country) || undefined;
}

function extractApolloPeople(data: unknown): Record<string, unknown>[] {
  const payload = data as Record<string, unknown> | undefined;
  const matches = payload?.matches;
  const people = payload?.people;
  const contacts = payload?.contacts;

  if (Array.isArray(matches)) return matches as Record<string, unknown>[];
  if (Array.isArray(people)) return people as Record<string, unknown>[];
  if (Array.isArray(contacts)) return contacts as Record<string, unknown>[];
  return [];
}

function mergeApolloPerson(
  original: Record<string, unknown>,
  enriched: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...original,
    ...enriched,
    organization: organizationFor(enriched) ?? organizationFor(original),
    contact: enriched.contact ?? original.contact,
  };
}

function getApolloErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : "Apollo scraping failed";
  }

  const status = error.response?.status;
  const details = error.response?.data;
  const detailText = typeof details === "string" ? details : JSON.stringify(details ?? {});

  if (status === 403) {
    return "Apollo rejected lead scraping with 403. People API Search requires a master API key and a plan with API Search access. Create a master key in Apollo and update APOLLO_API_KEY in Vercel.";
  }

  return `Apollo scraping failed${status ? ` with status ${status}` : ""}: ${detailText}`;
}

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
  const companySize = normalizeApolloCompanySize(input.company_size as string);
  const geography = input.geography as string[];
  const leadCount = input.lead_count as number;

  const people = await searchApolloPeople({ jobTitles, companySize, geography, leadCount });
  const linkedinReadyPeople = people.filter((person) => linkedinUrlFor(person));

  if (linkedinReadyPeople.length === 0) {
    throw new Error(
      "Apollo found people, but none had LinkedIn URLs after enrichment. No leads were saved because LinkedIn is required for profile-photo sourcing."
    );
  }

  const created: string[] = [];

  for (const person of linkedinReadyPeople) {
    const org = organizationFor(person);
    const lead = await createLead({
      campaignId,
      firstName: asString(person.first_name),
      lastName: asString(person.last_name),
      email: asString(person.email),
      company: (org?.name as string) ?? undefined,
      title: asString(person.title) || undefined,
      linkedinUrl: linkedinUrlFor(person),
      location: locationFor(person),
    });
    created.push(lead.id);
  }

  return {
    success: true,
    data: {
      leads_created: created.length,
      lead_ids: created,
      linkedin_required: true,
      candidates_found: people.length,
    },
  };
}

async function searchApolloPeople(input: {
  jobTitles: string[];
  companySize?: string;
  geography: string[];
  leadCount: number;
}): Promise<Record<string, unknown>[]> {
  const apiKey = getApolloApiKey();
  if (!apiKey) throw new Error("APOLLO_API_KEY is missing in Vercel.");
  const locations = normalizeApolloLocations(input.geography);
  const params = new URLSearchParams();
  appendApolloFilters(params, {
    jobTitles: input.jobTitles,
    companySize: input.companySize,
    locations,
    leadCount: Math.min(Math.max(input.leadCount * 4, input.leadCount), 100),
  });

  let people: Record<string, unknown>[];
  try {
    const response = await axios.post(`${APOLLO_PEOPLE_SEARCH_URL}?${params.toString()}`, undefined, {
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
    });
    people = response.data?.people ?? [];
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 403) throw error;

    const response = await axios.post(
      APOLLO_LEGACY_SEARCH_URL,
      {
        api_key: apiKey,
        person_titles: input.jobTitles,
        organization_num_employees_ranges: input.companySize ? [input.companySize] : undefined,
        person_locations: locations,
        per_page: Math.min(Math.max(input.leadCount * 4, input.leadCount), 100),
      },
      {
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
      }
    );
    people = response.data?.people ?? [];
  }

  const directMatches = people.filter((person) => linkedinUrlFor(person));
  const enriched = await enrichApolloPeopleById(people, input.leadCount);
  return [...directMatches, ...enriched]
    .filter((person, index, all) => {
      const linkedinUrl = linkedinUrlFor(person);
      if (!linkedinUrl) return false;
      return all.findIndex((candidate) => linkedinUrlFor(candidate) === linkedinUrl) === index;
    })
    .slice(0, input.leadCount);
}

async function enrichApolloPeopleById(
  people: Record<string, unknown>[],
  leadCount: number
): Promise<Record<string, unknown>[]> {
  const apiKey = getApolloApiKey();
  const peopleById = new Map<string, Record<string, unknown>>();
  people.forEach((person) => {
    const id = asString(person.id);
    if (id) peopleById.set(id, person);
  });
  const ids = Array.from(peopleById.keys());
  const enriched: Record<string, unknown>[] = [];

  for (let index = 0; index < ids.length && enriched.length < leadCount; index += 10) {
    const chunk = ids.slice(index, index + 10);
    const response = await axios.post(
      `${APOLLO_BULK_MATCH_URL}?reveal_personal_emails=false&reveal_phone_number=false`,
      { details: chunk.map((id) => ({ id })) },
      {
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          accept: "application/json",
        },
      }
    );
    const matches = extractApolloPeople(response.data);
    enriched.push(
      ...matches
        .map((person) => {
          const original = peopleById.get(asString(person.id));
          return original ? mergeApolloPerson(original, person) : person;
        })
        .filter((person) => linkedinUrlFor(person))
    );
  }

  return enriched;
}

export async function testApolloSearch(): Promise<{
  ok: boolean;
  count?: number;
  sample?: {
    name: string;
    title?: string;
    company?: string;
    linkedinUrl?: string;
  };
  error?: string;
}> {
  try {
    const people = await searchApolloPeople({
      jobTitles: ["Founder"],
      companySize: "1,10",
      geography: ["United States"],
      leadCount: 1,
    });
    const first = people[0];
    const org = first ? organizationFor(first) : undefined;
    return {
      ok: true,
      count: people.length,
      sample: first
        ? {
            name: `${(first.first_name as string | undefined) ?? ""} ${(first.last_name as string | undefined) ?? ""}`.trim(),
            title: first.title as string | undefined,
            company: org?.name as string | undefined,
            linkedinUrl: linkedinUrlFor(first),
          }
        : undefined,
    };
  } catch (error) {
    return { ok: false, error: getApolloErrorMessage(error) };
  }
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
    model: AGENT_MODEL,
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
      error: toolName === "scrape_leads"
        ? getApolloErrorMessage(error)
        : error instanceof Error ? error.message : "Unknown error",
    };
  }
}
