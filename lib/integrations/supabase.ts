import { createClient } from "@supabase/supabase-js";
import type {
  Campaign,
  CampaignRow,
  CampaignStats,
  CampaignStatus,
  CreativeBrief,
  CreativeScenePlan,
  CreativeVideoJob,
  CreativeVideoJobRow,
  CreativeVideoScene,
  CreativeVideoSceneRow,
  CreativeVideoStatus,
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
    profilePhotoUrl: row.profile_photo_url ?? undefined,
    status: row.status,
    researchSummary: row.research_summary ?? undefined,
    videoScript: row.video_script ?? undefined,
    outreachMessage: row.outreach_message ?? undefined,
    videoUrl: row.video_url ?? undefined,
    videoJobId: row.video_job_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToCreativeJob(row: CreativeVideoJobRow): CreativeVideoJob {
  return {
    id: row.id,
    leadId: row.lead_id,
    campaignId: row.campaign_id,
    status: row.status,
    clientResearchSummary: row.client_research_summary ?? undefined,
    leadResearchSummary: row.lead_research_summary ?? undefined,
    salesAngle: row.sales_angle ?? undefined,
    voiceoverScript: row.voiceover_script ?? undefined,
    outreachMessage: row.outreach_message ?? undefined,
    creativeBrief: row.creative_brief ?? undefined,
    voiceoverUrl: row.voiceover_url ?? undefined,
    hyperframesCompositionUrl: row.hyperframes_composition_url ?? undefined,
    finalVideoUrl: row.final_video_url ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToCreativeScene(row: CreativeVideoSceneRow): CreativeVideoScene {
  return {
    id: row.id,
    creativeVideoJobId: row.creative_video_job_id,
    leadId: row.lead_id,
    sceneNumber: row.scene_number,
    durationSeconds: row.duration_seconds,
    objective: row.objective,
    higgsfieldPrompt: row.higgsfield_prompt,
    captionText: row.caption_text,
    status: row.status,
    higgsfieldMediaId: row.higgsfield_media_id ?? undefined,
    stillImageJobId: row.still_image_job_id ?? undefined,
    stillImageUrl: row.still_image_url ?? undefined,
    videoJobId: row.video_job_id ?? undefined,
    higgsfieldRequestId: row.higgsfield_request_id ?? undefined,
    videoUrl: row.video_url ?? undefined,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    errorMessage: row.error_message ?? undefined,
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

export async function getLead(id: string): Promise<Lead | null> {
  const { data: row, error } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", id)
    .single<LeadRow>();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`getLead: ${error.message}`);
  }
  return rowToLead(row);
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

export async function saveLeadProfilePhoto(
  id: string,
  profilePhotoUrl: string
): Promise<Lead> {
  const { data: row, error } = await supabaseAdmin
    .from("leads")
    .update({
      profile_photo_url: profilePhotoUrl,
      status: "photo_ready" as LeadStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single<LeadRow>();

  if (error) throw new Error(`saveLeadProfilePhoto: ${error.message}`);
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
  videoJobId: string
): Promise<Lead> {
  const { data: row, error } = await supabaseAdmin
    .from("leads")
    .update({
      video_url: videoUrl,
      video_job_id: videoJobId,
      status: "video_ready" as LeadStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single<LeadRow>();

  if (error) throw new Error(`saveLeadVideo: ${error.message}`);
  return rowToLead(row);
}

// ─── Creative video jobs ─────────────────────────────────────────────────────

export async function getCreativeVideoJob(
  leadId: string
): Promise<CreativeVideoJob | null> {
  const { data: row, error } = await supabaseAdmin
    .from("creative_video_jobs")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<CreativeVideoJobRow>();

  if (error) throw new Error(`getCreativeVideoJob: ${error.message}`);
  return row ? rowToCreativeJob(row) : null;
}

export async function getCreativeVideoScenes(
  leadId: string
): Promise<CreativeVideoScene[]> {
  const { data: rows, error } = await supabaseAdmin
    .from("creative_video_scenes")
    .select("*")
    .eq("lead_id", leadId)
    .order("scene_number", { ascending: true })
    .returns<CreativeVideoSceneRow[]>();

  if (error) throw new Error(`getCreativeVideoScenes: ${error.message}`);
  return (rows ?? []).map(rowToCreativeScene);
}

export async function getQueuedCreativeVideoJobs(
  limit = 5
): Promise<CreativeVideoJob[]> {
  const { data: rows, error } = await supabaseAdmin
    .from("creative_video_jobs")
    .select("*")
    .eq("status", "scenes_queued" as CreativeVideoStatus)
    .order("updated_at", { ascending: true })
    .limit(limit)
    .returns<CreativeVideoJobRow[]>();

  if (error) throw new Error(`getQueuedCreativeVideoJobs: ${error.message}`);
  return (rows ?? []).map(rowToCreativeJob);
}

export async function createOrUpdateCreativeVideoJob(input: {
  leadId: string;
  campaignId: string;
  status: CreativeVideoStatus;
  clientResearchSummary?: string;
  leadResearchSummary?: string;
  salesAngle?: string;
  voiceoverScript?: string;
  outreachMessage?: string;
  creativeBrief?: CreativeBrief;
  voiceoverUrl?: string;
  hyperframesCompositionUrl?: string;
  finalVideoUrl?: string;
  approvedAt?: string | null;
}): Promise<CreativeVideoJob> {
  const existing = await getCreativeVideoJob(input.leadId);
  const values: Partial<CreativeVideoJobRow> = {
    lead_id: input.leadId,
    campaign_id: input.campaignId,
    status: input.status,
    updated_at: new Date().toISOString(),
  };

  if (input.clientResearchSummary !== undefined) {
    values.client_research_summary = input.clientResearchSummary;
  }
  if (input.leadResearchSummary !== undefined) {
    values.lead_research_summary = input.leadResearchSummary;
  }
  if (input.salesAngle !== undefined) values.sales_angle = input.salesAngle;
  if (input.voiceoverScript !== undefined) {
    values.voiceover_script = input.voiceoverScript;
  }
  if (input.outreachMessage !== undefined) {
    values.outreach_message = input.outreachMessage;
  }
  if (input.creativeBrief !== undefined) values.creative_brief = input.creativeBrief;
  if (input.voiceoverUrl !== undefined) values.voiceover_url = input.voiceoverUrl;
  if (input.hyperframesCompositionUrl !== undefined) {
    values.hyperframes_composition_url = input.hyperframesCompositionUrl;
  }
  if (input.finalVideoUrl !== undefined) values.final_video_url = input.finalVideoUrl;
  if (input.approvedAt !== undefined) values.approved_at = input.approvedAt;

  const query = existing
    ? supabaseAdmin
        .from("creative_video_jobs")
        .update(values)
        .eq("id", existing.id)
        .select()
        .single<CreativeVideoJobRow>()
    : supabaseAdmin
        .from("creative_video_jobs")
        .insert(values)
        .select()
        .single<CreativeVideoJobRow>();

  const { data: row, error } = await query;
  if (error) throw new Error(`createOrUpdateCreativeVideoJob: ${error.message}`);
  return rowToCreativeJob(row);
}

export async function replaceCreativeVideoScenes(
  jobId: string,
  leadId: string,
  scenePlan: CreativeScenePlan[]
): Promise<CreativeVideoScene[]> {
  const { error: deleteError } = await supabaseAdmin
    .from("creative_video_scenes")
    .delete()
    .eq("creative_video_job_id", jobId);

  if (deleteError) {
    throw new Error(`replaceCreativeVideoScenes delete: ${deleteError.message}`);
  }

  const rows = scenePlan.map((scene) => ({
    creative_video_job_id: jobId,
    lead_id: leadId,
    scene_number: scene.sceneNumber,
    duration_seconds: scene.durationSeconds,
    objective: scene.objective,
    higgsfield_prompt: scene.higgsfieldPrompt,
    caption_text: scene.captionText,
    status: "draft" as const,
  }));

  const { data, error } = await supabaseAdmin
    .from("creative_video_scenes")
    .insert(rows)
    .select()
    .returns<CreativeVideoSceneRow[]>();

  if (error) throw new Error(`replaceCreativeVideoScenes insert: ${error.message}`);
  return (data ?? []).map(rowToCreativeScene);
}

export async function queueCreativeVideoScenes(
  leadId: string
): Promise<CreativeVideoScene[]> {
  const { data, error } = await supabaseAdmin
    .from("creative_video_scenes")
    .update({ status: "queued", updated_at: new Date().toISOString() })
    .eq("lead_id", leadId)
    .in("status", ["draft", "failed"])
    .select()
    .returns<CreativeVideoSceneRow[]>();

  if (error) throw new Error(`queueCreativeVideoScenes: ${error.message}`);
  return (data ?? []).map(rowToCreativeScene);
}

export async function claimQueuedCreativeVideoScenes(
  leadId: string
): Promise<CreativeVideoScene[]> {
  const { data, error } = await supabaseAdmin
    .from("creative_video_scenes")
    .update({ status: "generating", updated_at: new Date().toISOString() })
    .eq("lead_id", leadId)
    .eq("status", "queued")
    .select()
    .order("scene_number", { ascending: true })
    .returns<CreativeVideoSceneRow[]>();

  if (error) throw new Error(`claimQueuedCreativeVideoScenes: ${error.message}`);
  return (data ?? []).map(rowToCreativeScene);
}

export async function updateCreativeVideoScene(
  sceneId: string,
  updates: {
    status?: CreativeVideoScene["status"];
    higgsfieldMediaId?: string;
    stillImageJobId?: string;
    stillImageUrl?: string;
    videoJobId?: string;
    higgsfieldRequestId?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    errorMessage?: string | null;
  }
): Promise<CreativeVideoScene> {
  const values: Partial<CreativeVideoSceneRow> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.status !== undefined) values.status = updates.status;
  if (updates.higgsfieldMediaId !== undefined) {
    values.higgsfield_media_id = updates.higgsfieldMediaId;
  }
  if (updates.stillImageJobId !== undefined) {
    values.still_image_job_id = updates.stillImageJobId;
  }
  if (updates.stillImageUrl !== undefined) {
    values.still_image_url = updates.stillImageUrl;
  }
  if (updates.videoJobId !== undefined) values.video_job_id = updates.videoJobId;
  if (updates.higgsfieldRequestId !== undefined) {
    values.higgsfield_request_id = updates.higgsfieldRequestId;
  }
  if (updates.videoUrl !== undefined) values.video_url = updates.videoUrl;
  if (updates.thumbnailUrl !== undefined) values.thumbnail_url = updates.thumbnailUrl;
  if (updates.errorMessage !== undefined) values.error_message = updates.errorMessage;

  const { data: row, error } = await supabaseAdmin
    .from("creative_video_scenes")
    .update(values)
    .eq("id", sceneId)
    .select()
    .single<CreativeVideoSceneRow>();

  if (error) throw new Error(`updateCreativeVideoScene: ${error.message}`);
  return rowToCreativeScene(row);
}

export async function uploadAsset(input: {
  bucket: string;
  path: string;
  body: ArrayBuffer | Blob | Buffer | string;
  contentType: string;
}): Promise<string> {
  const { error } = await supabaseAdmin.storage
    .from(input.bucket)
    .upload(input.path, input.body, {
      contentType: input.contentType,
      upsert: true,
    });

  if (error) throw new Error(`uploadAsset: ${error.message}`);

  const { data } = supabaseAdmin.storage.from(input.bucket).getPublicUrl(input.path);
  return data.publicUrl;
}
