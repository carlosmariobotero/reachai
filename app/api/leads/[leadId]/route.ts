import { NextResponse } from "next/server";
import {
  deleteLead,
  getCampaign,
  getLead,
  getLeadsByCampaign,
  updateCampaignLeadTarget,
  updateCampaignStatus,
} from "@/lib/integrations/supabase";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const lead = await getLead(leadId);

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const campaign = await getCampaign(lead.campaignId);
    await deleteLead(leadId);

    const remainingLeads = await getLeadsByCampaign(lead.campaignId);
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
      "video_ready",
      "approved",
      "emailed",
      "responded",
    ]);

    const stats = {
      totalLeads: remainingLeads.length,
      researched: remainingLeads.filter((item) => researchedStatuses.has(item.status)).length,
      scriptsDone: remainingLeads.filter((item) => scriptStatuses.has(item.status)).length,
      videosGenerated: remainingLeads.filter((item) => videoStatuses.has(item.status)).length,
      emailsSent: remainingLeads.filter((item) => item.status === "emailed" || item.status === "responded").length,
      responses: remainingLeads.filter((item) => item.status === "responded").length,
    };

    await updateCampaignLeadTarget(lead.campaignId, remainingLeads.length);
    await updateCampaignStatus(lead.campaignId, campaign?.status ?? "active", stats);

    return NextResponse.json({
      ok: true,
      deletedLeadId: leadId,
      campaignId: lead.campaignId,
      totalLeads: remainingLeads.length,
    });
  } catch (error) {
    console.error("[DELETE /api/leads/[leadId]]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete lead" },
      { status: 500 }
    );
  }
}
