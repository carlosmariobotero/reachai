import { NextRequest, NextResponse } from "next/server";
import {
  getCampaign,
  getLeadsByCampaign,
  updateCampaignStatus,
} from "../../../../../lib/integrations/supabase";
import type { CampaignStatus } from "../../../../../lib/types";

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

    const pipeline = {
      scraped: leads.length,
      researched: leads.filter((l) => l.researchSummary).length,
      scripts_done: leads.filter((l) => l.videoScript).length,
      videos_done: leads.filter((l) => l.videoUrl).length,
      delivered: leads.filter(
        (l) => l.status === "emailed" || l.status === "responded"
      ).length,
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
        stats: campaign.stats,
      },
      pipeline,
      leads: leads.map((l) => ({
        id: l.id,
        firstName: l.firstName,
        lastName: l.lastName,
        title: l.title,
        company: l.company,
        location: l.location,
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
