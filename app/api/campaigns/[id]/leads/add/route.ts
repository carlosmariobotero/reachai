import { NextRequest, NextResponse } from "next/server";
import { executeTool } from "../../../../../../lib/agent/tools";
import {
  getCampaign,
  getLeadsByCampaign,
  updateCampaignLeadTarget,
  updateCampaignStatus,
} from "../../../../../../lib/integrations/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const campaign = await getCampaign(id);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedCount = Number(body.leadCount ?? 5);
    const leadCount = Number.isFinite(requestedCount)
      ? Math.min(Math.max(Math.round(requestedCount), 1), 25)
      : 5;

    await updateCampaignStatus(id, "scraping");

    const scrapeResult = await executeTool("scrape_leads", {
      campaign_id: id,
      job_titles: campaign.jobTitles,
      company_size: campaign.companySize,
      geography: campaign.geography,
      lead_count: leadCount,
      industries: campaign.industries,
      pain_point: campaign.painPoint,
      website_url: campaign.websiteUrl,
    });

    if (!scrapeResult.success) {
      await updateCampaignStatus(id, "active");
      return NextResponse.json(
        { error: scrapeResult.error ?? "Could not add leads" },
        { status: 422 }
      );
    }

    const leads = await getLeadsByCampaign(id);
    const existingTarget = campaign.leadCount || 0;
    const nextTarget = Math.max(existingTarget + leadCount, leads.length);
    await updateCampaignLeadTarget(id, nextTarget);
    await updateCampaignStatus(id, "active", { totalLeads: leads.length });
    const resultData = scrapeResult.data as { leads_created?: number } | undefined;

    return NextResponse.json({
      ok: true,
      added: resultData?.leads_created ?? 0,
      totalLeads: leads.length,
      leadTarget: nextTarget,
      linkedinRequired: true,
      message: "New LinkedIn-ready leads were added to this campaign.",
    });
  } catch (error) {
    console.error("Error adding campaign leads:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not add leads" },
      { status: 500 }
    );
  }
}
