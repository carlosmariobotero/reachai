import { createClient } from "@supabase/supabase-js";
import type {
  Campaign,
  CampaignRow,
  CampaignStats,
  CampaignStatus,
  CreateCampaignInput,
  CreateLeadInput,
  Lead,
  LeadRow,
  LeadStatus,
} from "../types";

// ─── Clients ─────────────────────────────────────────────────────────────────

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// ─── Row → domain mappers ────────────────────────────────────────────────────

function rowToCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    clientEmail: row.client_email,
    websiteUrl: row.website_url,
    painPoint: row.pain_point,
    industries: row.industries,
    jobTitles: row.job_titles,
    companySize: row.company_size,
    geography: row.geography,
    leadCount: row.lead_count,
    name: row.name,
    status: row.status,
    stats: {
      totalLeads: row.total_leads,
      researched: row.researched,
      scriptsDone: row.scripts_done,
      videosGenerated: row.videos_generated,
      emailsSent: row.emails_sent,
      responses: row.responses,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToLead(row: LeadRow): Lead {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    company: row.company ?? undefined,
    title: row.title ?? undefined,
    linkedinUrl: row.linkedin_url ?? undefined,
    location: row.location ?? undefined,
    status: row.status,
    researchSummary: row.research_summary ?? undefined,
    videoScript: row.video_script ?? undefined,
    outreachMessage: row.outreach_message ?? undefined,
    videoUrl: row.video_url ?? undefined,
    heygenVideoId: row.heygen_video_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

export async function createCampaign(data: CreateCampaignInput): Promise<Campaign> {
  const { data: row, error } = await supabaseAdmin
    .from("campaigns")
    .insert({
      client_id: data.clientId,
      client_name: data.clientName,
      client_email: data.clientEmail,
      website_url: data.websiteUrl,
      pain_point: data.painPoint,
      industries: data.industries,
      job_titles: data.jobTitles,
      company_size: data.companySize,
      geography: data.geography,
      lead_count: data.leadCount,
      name: data.name,
      status: data.status ?? "draft",
      total_leads: 0,
      researched: 0,
      scripts_done: 0,
      videos_generated: 0,
      emails_sent: 0,
      responses: 0,
    })
    .select()
    .single<CampaignRow>();

  if (error) throw new Error(`createCampaign: ${error.message}`);
  return rowToCampaign(row);
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const { data: row, error } = await supabaseAdmin
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single<CampaignRow>();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`getCampaign: ${error.message}`);
  }
  return rowToCampaign(row);
}

export async function getAllCampaigns(): Promise<Campaign[]> {
  const { data: rows, error } = await supabaseAdmin
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<CampaignRow[]>();

  if (error) throw new Error(`getAllCampaigns: ${error.message}`);
  return (rows ?? []).map(rowToCampaign);
}

export async function updateCampaignStatus(
  id: string,
  status: CampaignStatus,
  stats?: Partial<CampaignStats>
): Promise<Campaign> {
  const updates: Partial<CampaignRow> & { updated_at: string } = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (stats) {
    if (stats.totalLeads !== undefined) updates.total_leads = stats.totalLeads;
    if (stats.researched !== undefined) updates.researched = stats.researched;
    if (stats.scriptsDone !== undefined) updates.scripts_done = stats.scriptsDone;
    if (stats.videosGenerated !== undefined) updates.videos_generated = stats.videosGenerated;
    if (stats.emailsSent !== undefined) updates.emails_sent = stats.emailsSent;
    if (stats.responses !== undefined) updates.responses = stats.responses;
  }

  const { data: row, error } = await supabaseAdmin
    .from("campaigns")
    .update(updates)
    .eq("id", id)
    .select()
    .single<CampaignRow>();

  if (error) throw new Error(`updateCampaignStatus: ${error.message}`);
  return rowToCampaign(row);
}

// ─── Leads ───────────────────────────────────────────────────────────────────

export async function createLead(data: CreateLeadInput): Promise<Lead> {
  const { data: row, error } = await supabaseAdmin
    .from("leads")
    .insert({
      campaign_id: data.campaignId,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      company: data.company ?? null,
      title: data.title ?? null,
      linkedin_url: data.linkedinUrl ?? null,
      location: data.location ?? null,
      status: "new" as LeadStatus,
    })
    .select()
    .single<LeadRow>();

  if (error) throw new Error(`createLead: ${error.message}`);
  return rowToLead(row);
}

export async function getLeadsByCampaign(campaignId: string): Promise<Lead[]> {
  const { data: rows, error } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true })
    .returns<LeadRow[]>();

  if (error) throw new Error(`getLeadsByCampaign: ${error.message}`);
  return (rows ?? []).map(rowToLead);
}

export async function updateLeadStatus(
  id: string,
  status: LeadStatus
): Promise<Lead> {
  const { data: row, error } = await supabaseAdmin
    .from("leads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single<LeadRow>();

  if (error) throw new Error(`updateLeadStatus: ${error.message}`);
  return rowToLead(row);
}

export async function saveLeadResearch(
  id: string,
  researchSummary: string
): Promise<Lead> {
  const { data: row, error } = await supabaseAdmin
    .from("leads")
    .update({
      research_summary: researchSummary,
      status: "researching" as LeadStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single<LeadRow>();

  if (error) throw new Error(`saveLeadResearch: ${error.message}`);
  return rowToLead(row);
}

export async function saveLeadScript(
  id: string,
  videoScript: string,
  outreachMessage: string
): Promise<Lead> {
  const { data: row, error } = await supabaseAdmin
    .from("leads")
    .update({
      video_script: videoScript,
      outreach_message: outreachMessage,
      status: "scripted" as LeadStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single<LeadRow>();

  if (error) throw new Error(`saveLeadScript: ${error.message}`);
  return rowToLead(row);
}

export async function saveLeadVideo(
  id: string,
  videoUrl: string,
  heygenVideoId: string
): Promise<Lead> {
  const { data: row, error } = await supabaseAdmin
    .from("leads")
    .update({
      video_url: videoUrl,
      heygen_video_id: heygenVideoId,
      status: "video_ready" as LeadStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single<LeadRow>();

  if (error) throw new Error(`saveLeadVideo: ${error.message}`);
  return rowToLead(row);
}
