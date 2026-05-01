import { NextRequest, NextResponse } from "next/server";
import {
  getCampaign,
  getCreativeVideoJob,
  getCreativeVideoScenes,
  getLead,
} from "../../../../../lib/integrations/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const lead = await getLead(leadId);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const [campaign, job, scenes] = await Promise.all([
      getCampaign(lead.campaignId),
      getCreativeVideoJob(leadId),
      getCreativeVideoScenes(leadId),
    ]);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ lead, campaign, job, scenes });
  } catch (error) {
    console.error("Error loading creative package:", error);
    return NextResponse.json(
      { error: "Failed to load creative package" },
      { status: 500 }
    );
  }
}
