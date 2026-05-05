import { NextRequest, NextResponse } from "next/server";
import {
  getCampaign,
  getLeadsByCampaign,
  updateCampaignStatus,
} from "../../../../../lib/integrations/supabase";
import type { CampaignStatus, Lead } from "../../../../../lib/types";

function getFreshStats(leads: Lead[]) {
  const researchedStatuses = new Set([
    "researching",
    "scripted",
    "photo_ready",
    "prompt_ready",
    "video_generating",
    "video_ready",
    "approved",
    "emailed",
    "responded",
  ]);
  const scriptStatuses = new Set([
    "scripted",
    "prompt_ready",
    "video_generating",
    "video_ready",
    "approved",
    "emailed",
    "responded",
  ]);
  const videoStatuses = new Set([
    "video_generating",
    "video_ready",
    "approved",
    "emailed",
    "responded",
  ]);

  return {
    totalLeads: leads.length,
    researched: leads.filter((lead) => lead.researchSummary || researchedStatuses.has(lead.status)).length,
    scriptsDone: leads.filter((lead) => lead.videoScript || scriptStatuses.has(lead.status)).length,
    videosGenerated: leads.filter((lead) => lead.videoUrl || videoStatuses.has(lead.status)).length,
    emailsSent: leads.filter((lead) => lead.status === "emailed" || lead.status === "responded").length,
    responses: leads.filter((lead) => lead.status === "responded").length,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [campaign, leads] = await Promise.all([
      getCampaign(id),
      getLeadsByCampaign(id),
    ]);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const freshStats = getFreshStats(leads);
    const pipeline = {
      scraped: freshStats.totalLeads,
      researched: freshStats.researched,
      scripts_done: freshStats.scriptsDone,
      videos_done: freshStats.videosGenerated,
      delivered: freshStats.emailsSent,
    };

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        clientName: campaign.clientName,
        name: campaign.name,
        status: campaign.status,
        industries: campaign.industries,
        jobTitles: campaign.jobTitles,
        companySize: campaign.companySize,
        geography: campaign.geography,
        websiteUrl: campaign.websiteUrl,
        leadCount: campaign.leadCount,
        createdAt: campaign.createdAt,
        stats: freshStats,
      },
      pipeline,
      leads: leads.map((l) => ({
        id: l.id,
        firstName: l.firstName,
        lastName: l.lastName,
        title: l.title,
        company: l.company,
        linkedinUrl: l.linkedinUrl,
        location: l.location,
        profilePhotoUrl: l.profilePhotoUrl,
        status: l.status,
        videoUrl: l.videoUrl,
      })),
      updated_at: campaign.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching campaign status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch campaign status" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body as { status: CampaignStatus };

    const validStatuses: CampaignStatus[] = [
      "draft",
      "scraping",
      "active",
      "paused",
      "completed",
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updated = await updateCampaignStatus(id, status);

    return NextResponse.json({
      campaign_id: updated.id,
      status: updated.status,
      updated_at: updated.updatedAt,
    });
  } catch (error) {
    console.error("Error updating campaign status:", error);
    return NextResponse.json(
      { error: "Failed to update campaign status" },
      { status: 500 }
    );
  }
}
