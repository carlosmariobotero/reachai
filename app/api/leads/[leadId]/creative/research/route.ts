import { NextRequest, NextResponse } from "next/server";
import { generateCreativeBrief } from "../../../../../../lib/creative/agent";
import {
  createOrUpdateCreativeVideoJob,
  getCampaign,
  getLead,
  replaceCreativeVideoScenes,
  saveLeadResearch,
  saveLeadScript,
} from "../../../../../../lib/integrations/supabase";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const lead = await getLead(leadId);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const campaign = await getCampaign(lead.campaignId);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const { clientResearchSummary, leadResearchSummary, creativeBrief } =
      await generateCreativeBrief(campaign, lead);

    await saveLeadResearch(leadId, leadResearchSummary);
    await saveLeadScript(
      leadId,
      creativeBrief.voiceoverScript,
      creativeBrief.outreachMessage
    );

    const job = await createOrUpdateCreativeVideoJob({
      leadId,
      campaignId: campaign.id,
      status: "prompt_ready",
      clientResearchSummary,
      leadResearchSummary,
      salesAngle: creativeBrief.salesAngle,
      voiceoverScript: creativeBrief.voiceoverScript,
      outreachMessage: creativeBrief.outreachMessage,
      creativeBrief,
    });

    const scenes = await replaceCreativeVideoScenes(
      job.id,
      leadId,
      creativeBrief.scenePlan
    );

    return NextResponse.json({ job, scenes });
  } catch (error) {
    console.error("Error generating creative brief:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate creative brief",
      },
      { status: 500 }
    );
  }
}
