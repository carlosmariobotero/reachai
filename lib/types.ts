// ─── Domain models (camelCase, used throughout the app) ─────────────────────

export interface Client {
  id: string;
  name: string;
  email: string;
  company?: string;
  createdAt: string;
}

export type CampaignStatus =
  | "draft"
  | "scraping"
  | "active"
  | "paused"
  | "completed";

export interface CampaignStats {
  totalLeads: number;
  researched: number;
  scriptsDone: number;
  videosGenerated: number;
  emailsSent: number;
  responses: number;
}

export interface Campaign {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  websiteUrl: string;
  painPoint: string;
  industries: string[];
  jobTitles: string[];
  companySize: string;
  geography: string[];
  leadCount: number;
  name: string;
  status: CampaignStatus;
  stats: CampaignStats;
  createdAt: string;
  updatedAt: string;
}

export type LeadStatus =
  | "new"
  | "researching"
  | "scripted"
  | "photo_needed"
  | "photo_ready"
  | "prompt_ready"
  | "video_generating"
  | "video_ready"
  | "approved"
  | "emailed"
  | "responded"
  | "failed";

export interface Lead {
  id: string;
  campaignId: string;
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  title?: string;
  linkedinUrl?: string;
  location?: string;
  profilePhotoUrl?: string;
  status: LeadStatus;
  researchSummary?: string;
  videoScript?: string;
  outreachMessage?: string;
  videoUrl?: string;
  videoJobId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VideoOutreach {
  id: string;
  leadId: string;
  campaignId: string;
  videoJobId?: string;
  status: "pending" | "generating" | "ready" | "sent" | "failed";
  videoUrl?: string;
  personalizedScript?: string;
  createdAt: string;
}

// ─── Supabase DB row shapes (snake_case, mirrors the actual table columns) ───

export interface CampaignRow {
  id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  website_url: string;
  pain_point: string;
  industries: string[];
  job_titles: string[];
  company_size: string;
  geography: string[];
  lead_count: number;
  name: string;
  status: CampaignStatus;
  total_leads: number;
  researched: number;
  scripts_done: number;
  videos_generated: number;
  emails_sent: number;
  responses: number;
  created_at: string;
  updated_at: string;
}

export interface LeadRow {
  id: string;
  campaign_id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string | null;
  title: string | null;
  linkedin_url: string | null;
  location: string | null;
  profile_photo_url: string | null;
  status: LeadStatus;
  research_summary: string | null;
  video_script: string | null;
  outreach_message: string | null;
  video_url: string | null;
  video_job_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Input types for create / update operations ──────────────────────────────

export interface CreateCampaignInput {
  clientId: string;
  clientName: string;
  clientEmail: string;
  websiteUrl: string;
  painPoint: string;
  industries: string[];
  jobTitles: string[];
  companySize: string;
  geography: string[];
  leadCount: number;
  name: string;
  status?: CampaignStatus;
}

export interface CreateLeadInput {
  campaignId: string;
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  title?: string;
  linkedinUrl?: string;
  location?: string;
}

export type CreativeVideoStatus =
  | "draft"
  | "research_ready"
  | "prompt_ready"
  | "scenes_queued"
  | "scenes_ready"
  | "voiceover_ready"
  | "render_ready"
  | "approved"
  | "failed";

export type CreativeSceneStatus =
  | "draft"
  | "queued"
  | "generating"
  | "ready"
  | "failed";

export interface CreativeScenePlan {
  sceneNumber: number;
  durationSeconds: number;
  objective: string;
  higgsfieldPrompt: string;
  captionText: string;
}

export interface CreativeBrief {
  salesAngle: string;
  voiceoverScript: string;
  outreachMessage: string;
  scenePlan: CreativeScenePlan[];
}

export interface CreativeVideoJob {
  id: string;
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
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreativeVideoScene {
  id: string;
  creativeVideoJobId: string;
  leadId: string;
  sceneNumber: number;
  durationSeconds: number;
  objective: string;
  higgsfieldPrompt: string;
  captionText: string;
  status: CreativeSceneStatus;
  higgsfieldRequestId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreativeVideoJobRow {
  id: string;
  lead_id: string;
  campaign_id: string;
  status: CreativeVideoStatus;
  client_research_summary: string | null;
  lead_research_summary: string | null;
  sales_angle: string | null;
  voiceover_script: string | null;
  outreach_message: string | null;
  creative_brief: CreativeBrief | null;
  voiceover_url: string | null;
  hyperframes_composition_url: string | null;
  final_video_url: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreativeVideoSceneRow {
  id: string;
  creative_video_job_id: string;
  lead_id: string;
  scene_number: number;
  duration_seconds: number;
  objective: string;
  higgsfield_prompt: string;
  caption_text: string;
  status: CreativeSceneStatus;
  higgsfield_request_id: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Agent types ─────────────────────────────────────────────────────────────

export interface AgentToolInput {
  leadId?: string;
  campaignId?: string;
  query?: string;
  [key: string]: unknown;
}

export interface AgentToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
