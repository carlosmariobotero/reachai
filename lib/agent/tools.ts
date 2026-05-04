import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { Resend } from "resend";
import type { AgentToolResult } from "../types";
import {
  createLead,
  getLeadsByCampaign,
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

function normalizeApolloCompanySize(companySize: string): string[] {
  const normalized = companySize.replace(/[–—-]/g, ",").replace(/\s+/g, "");
  const ranges: Record<string, string[]> = {
    "1,10": ["11,50", "51,200"],
    "11,50": ["11,50", "51,200", "201,1000"],
    "51,200": ["51,200", "201,1000", "1000,5000"],
    "201,1K": ["201,1000", "1000,5000"],
    "1K,5K": ["1000,5000", "5000,1000000"],
    "5K+": ["5000,1000000"],
  };
  return ranges[normalized] ?? [normalized];
}

function normalizeApolloLocations(geography: string[]): string[] | undefined {
  const locations = geography.filter((location) => !location.toLowerCase().includes("global"));
  return locations.length > 0 ? locations : undefined;
}

function appendApolloFilters(
  params: URLSearchParams,
  input: {
    jobTitles: string[];
    companySizes?: string[];
    locations?: string[];
    leadCount: number;
    seniorities?: string[];
    marketKeywords?: string[];
    strictTitles?: boolean;
  }
) {
  input.jobTitles.forEach((title) => params.append("person_titles[]", title));
  input.seniorities?.forEach((seniority) => params.append("person_seniorities[]", seniority));
  input.locations?.forEach((location) => params.append("organization_locations[]", location));
  input.companySizes?.forEach((range) => params.append("organization_num_employees_ranges[]", range));
  if (input.marketKeywords?.length) params.set("q_keywords", input.marketKeywords.join(" "));
  if (input.strictTitles) params.set("include_similar_titles", "false");
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

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.replace(/[^0-9.]/g, "")) || 0;
  return 0;
}

function normalizedWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function inferSeniorities(jobTitles: string[]): string[] {
  const seniorities = new Set<string>();
  const titleText = jobTitles.join(" ").toLowerCase();
  if (/\b(owner|principal)\b/.test(titleText)) seniorities.add("owner");
  if (/\b(founder|co founder|co-founder)\b/.test(titleText)) seniorities.add("founder");
  if (/\b(ceo|cto|coo|cmo|cfo|cio|cro|chief|president)\b/.test(titleText)) seniorities.add("c_suite");
  if (/\b(partner)\b/.test(titleText)) seniorities.add("partner");
  if (/\b(vp|vice president)\b/.test(titleText)) seniorities.add("vp");
  if (/\b(head|lead)\b/.test(titleText)) seniorities.add("head");
  if (/\b(director)\b/.test(titleText)) seniorities.add("director");
  return Array.from(seniorities.size ? seniorities : new Set(["founder", "c_suite", "owner", "partner", "vp"]));
}

function titleMatchesAnyRequested(title: string, requestedTitles: string[]): boolean {
  const normalizedTitle = ` ${normalizedWords(title).join(" ")} `;
  return requestedTitles.some((requested) => {
    const normalizedRequested = normalizedWords(requested).join(" ");
    if (!normalizedRequested) return false;
    const acronym = requested.trim().toLowerCase();
    return normalizedTitle.includes(` ${normalizedRequested} `) || normalizedTitle.includes(` ${acronym} `);
  });
}

function isWeakCompanyName(company?: string): boolean {
  if (!company) return true;
  const value = company.toLowerCase();
  return /\b(self employed|freelance|independent|consultant|student|stealth|personal|n\/a)\b/.test(value);
}

function hasHighIntentOrganization(person: Record<string, unknown>): boolean {
  const org = organizationFor(person);
  if (!org) return false;
  const employees = asNumber(org.estimated_num_employees ?? org.num_employees);
  const revenue = asNumber(org.annual_revenue ?? org.revenue);
  const openJobs = asNumber(org.num_jobs ?? org.active_job_postings_count);
  const domain = asString(org.primary_domain) || asString(org.website_url);

  return Boolean(domain) && (employees >= 11 || revenue >= 1_000_000 || openJobs >= 3);
}

function leadQualityScore(person: Record<string, unknown>, requestedTitles: string[]): number {
  const title = asString(person.title);
  const org = organizationFor(person);
  const company = asString(org?.name);
  const linkedinUrl = linkedinUrlFor(person);
  const employees = asNumber(org?.estimated_num_employees ?? org?.num_employees);
  const revenue = asNumber(org?.annual_revenue ?? org?.revenue);
  const openJobs = asNumber(org?.num_jobs ?? org?.active_job_postings_count);

  let score = 0;
  if (linkedinUrl) score += 35;
  if (titleMatchesAnyRequested(title, requestedTitles)) score += 25;
  if (/\b(owner|founder|co-founder|ceo|chief|cto|coo|cmo|cfo|president|partner|vp|head|director)\b/i.test(title)) score += 15;
  if (employees >= 50) score += 10;
  else if (employees >= 11) score += 6;
  if (revenue >= 5_000_000) score += 10;
  else if (revenue >= 1_000_000) score += 6;
  if (openJobs >= 5) score += 5;
  if (isWeakCompanyName(company)) score -= 30;
  if (/\b(intern|student|assistant|associate|freelance|consultant)\b/i.test(title)) score -= 30;
  return score;
}

function qualifiedApolloLead(person: Record<string, unknown>, requestedTitles: string[]): boolean {
  const title = asString(person.title);
  const org = organizationFor(person);
  return Boolean(linkedinUrlFor(person)) &&
    titleMatchesAnyRequested(title, requestedTitles) &&
    !isWeakCompanyName(asString(org?.name)) &&
    hasHighIntentOrganization(person) &&
    leadQualityScore(person, requestedTitles) >= 60;
}

const MARKET_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "your",
  "our",
  "you",
  "are",
  "from",
  "that",
  "this",
  "into",
  "more",
  "company",
  "business",
  "services",
  "solutions",
  "platform",
  "home",
  "about",
  "contact",
]);

async function websiteMarketKeywords(websiteUrl?: string): Promise<string[]> {
  if (!websiteUrl) return [];
  try {
    const response = await axios.get<string>(websiteUrl, {
      timeout: 6000,
      maxRedirects: 3,
      headers: {
        "User-Agent": "ReachAI lead qualification bot",
        accept: "text/html,application/xhtml+xml",
      },
    });
    const text = response.data
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 12000);
    const counts = new Map<string, number>();
    normalizedWords(text).forEach((word) => {
      if (word.length < 4 || MARKET_STOP_WORDS.has(word)) return;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([word]) => word);
  } catch {
    return [];
  }
}

async function buildMarketKeywords(input: {
  industries?: string[];
  painPoint?: string;
  websiteUrl?: string;
}): Promise<string[]> {
  const websiteWords = await websiteMarketKeywords(input.websiteUrl);
  const questionnaireWords = normalizedWords(
    [...(input.industries ?? []), input.painPoint ?? ""].join(" ")
  ).filter((word) => word.length >= 4 && !MARKET_STOP_WORDS.has(word));
  return Array.from(new Set([...questionnaireWords, ...websiteWords])).slice(0, 5);
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
        industries: {
          type: "array",
          items: { type: "string" },
          description: "Target industries from the questionnaire",
        },
        pain_point: {
          type: "string",
          description: "Client's positioning or pain point from the questionnaire",
        },
        website_url: {
          type: "string",
          description: "Client website URL used to infer market keywords",
        },
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
  const industries = (input.industries as string[] | undefined) ?? [];
  const painPoint = input.pain_point as string | undefined;
  const websiteUrl = input.website_url as string | undefined;
  const marketKeywords = await buildMarketKeywords({ industries, painPoint, websiteUrl });

  const people = await searchApolloPeople({
    jobTitles,
    companySize,
    geography,
    leadCount,
    marketKeywords,
  });
  const linkedinReadyPeople = people.filter((person) => qualifiedApolloLead(person, jobTitles));
  const existingLeads = await getLeadsByCampaign(campaignId);
  const existingLinkedInUrls = new Set(
    existingLeads
      .map((lead) => lead.linkedinUrl?.trim().toLowerCase())
      .filter(Boolean)
  );
  const newLinkedInReadyPeople = linkedinReadyPeople.filter((person) => {
    const linkedinUrl = linkedinUrlFor(person).trim().toLowerCase();
    return linkedinUrl && !existingLinkedInUrls.has(linkedinUrl);
  });

  if (newLinkedInReadyPeople.length === 0) {
    throw new Error(
      "Apollo found people, but none were new high-quality LinkedIn-ready leads for this campaign. No duplicate or weak leads were saved."
    );
  }

  const created: string[] = [];

  for (const person of newLinkedInReadyPeople) {
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
      quality_gate: "linkedin + exact requested title + real company signal",
      market_keywords: marketKeywords,
      candidates_found: people.length,
      duplicates_skipped: linkedinReadyPeople.length - newLinkedInReadyPeople.length,
    },
  };
}

async function searchApolloPeople(input: {
  jobTitles: string[];
  companySize?: string[];
  geography: string[];
  leadCount: number;
  marketKeywords?: string[];
}): Promise<Record<string, unknown>[]> {
  const apiKey = getApolloApiKey();
  if (!apiKey) throw new Error("APOLLO_API_KEY is missing in Vercel.");
  const locations = normalizeApolloLocations(input.geography);
  const requestedCandidates = Math.min(Math.max(input.leadCount * 8, input.leadCount), 100);
  const attempts = [
    {
      strictTitles: true,
      seniorities: inferSeniorities(input.jobTitles),
      marketKeywords: input.marketKeywords,
    },
    {
      strictTitles: true,
      seniorities: inferSeniorities(input.jobTitles),
    },
  ];

  const qualified = new Map<string, Record<string, unknown>>();

  for (const attempt of attempts) {
    const params = new URLSearchParams();
    appendApolloFilters(params, {
      jobTitles: input.jobTitles,
      companySizes: input.companySize,
      locations,
      leadCount: requestedCandidates,
      ...attempt,
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
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        continue;
      }
      if (!axios.isAxiosError(error) || error.response?.status !== 403) throw error;

      const response = await axios.post(
        APOLLO_LEGACY_SEARCH_URL,
        {
          api_key: apiKey,
          person_titles: input.jobTitles,
          person_seniorities: inferSeniorities(input.jobTitles),
          organization_num_employees_ranges: input.companySize,
          organization_locations: locations,
          q_keywords: attempt.marketKeywords?.join(" "),
          include_similar_titles: false,
          per_page: requestedCandidates,
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

    const directMatches = people.filter((person) => qualifiedApolloLead(person, input.jobTitles));
    const enriched = await enrichApolloPeopleById(people, requestedCandidates);
    [...directMatches, ...enriched]
      .filter((person) => qualifiedApolloLead(person, input.jobTitles))
      .sort((a, b) => leadQualityScore(b, input.jobTitles) - leadQualityScore(a, input.jobTitles))
      .forEach((person) => {
        qualified.set(linkedinUrlFor(person), person);
      });

    if (qualified.size >= input.leadCount) {
      break;
    }
  }

  return Array.from(qualified.values())
    .sort((a, b) => leadQualityScore(b, input.jobTitles) - leadQualityScore(a, input.jobTitles))
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
      jobTitles: ["Founder", "CEO"],
      companySize: normalizeApolloCompanySize("11,50"),
      geography: ["United States"],
      leadCount: 1,
      marketKeywords: ["marketing", "growth"],
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
