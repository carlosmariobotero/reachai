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
  | "video_generating"
  | "video_ready"
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
  status: LeadStatus;
  researchSummary?: string;
  videoScript?: string;
  outreachMessage?: string;
  videoUrl?: string;
  heygenVideoId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VideoOutreach {
  id: string;
  leadId: string;
  campaignId: string;
  heygenVideoId?: string;
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
  status: LeadStatus;
  research_summary: string | null;
  video_script: string | null;
  outreach_message: string | null;
  video_url: string | null;
  heygen_video_id: string | null;
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
