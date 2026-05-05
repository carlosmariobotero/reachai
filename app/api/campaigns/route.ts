import { NextResponse } from "next/server";
import {
  getAllCampaigns,
  getLeadsByCampaign,
} from "../../../lib/integrations/supabase";
import type { Lead } from "../../../lib/types";

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

export async function GET() {
  try {
    const campaigns = await getAllCampaigns();
    const campaignsWithFreshStats = await Promise.all(
      campaigns.map(async (campaign) => {
        const leads = await getLeadsByCampaign(campaign.id);
        return {
          ...campaign,
          stats: getFreshStats(leads),
        };
      })
    );

    return NextResponse.json({ campaigns: campaignsWithFreshStats });
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}
