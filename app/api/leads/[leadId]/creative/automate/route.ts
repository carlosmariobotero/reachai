import { NextRequest, NextResponse } from "next/server";
import { generateCreativeBrief } from "../../../../../../lib/creative/agent";
import { buildHiggsfieldMcpTasks } from "../../../../../../lib/creative/higgsfield-mcp";
import {
  createOrUpdateCreativeVideoJob,
  getCampaign,
  getCreativeVideoJob,
  getCreativeVideoScenes,
  getLead,
  queueCreativeVideoScenes,
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
    if (!lead.profilePhotoUrl) {
      return NextResponse.json(
        { error: "Upload the lead LinkedIn profile photo before starting automation" },
        { status: 400 }
      );
    }

    const campaign = await getCampaign(lead.campaignId);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    let job = await getCreativeVideoJob(leadId);
    let scenes = await getCreativeVideoScenes(leadId);

    if (!job || scenes.length === 0) {
      const { clientResearchSummary, leadResearchSummary, creativeBrief } =
        await generateCreativeBrief(campaign, lead);

      await saveLeadResearch(leadId, leadResearchSummary);
      await saveLeadScript(
        leadId,
        creativeBrief.voiceoverScript,
        creativeBrief.outreachMessage
      );

      job = await createOrUpdateCreativeVideoJob({
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

      scenes = await replaceCreativeVideoScenes(job.id, leadId, creativeBrief.scenePlan);
    }

    await queueCreativeVideoScenes(leadId);
    scenes = await getCreativeVideoScenes(leadId);

    job = await createOrUpdateCreativeVideoJob({
      leadId,
      campaignId: campaign.id,
      status: "scenes_queued",
    });

    return NextResponse.json({
      job,
      scenes,
      mcpTasks: buildHiggsfieldMcpTasks(lead, job, scenes),
      automationMessage:
        "Lead automation is queued. The creative brief and scene prompts are ready; an authenticated Higgsfield MCP worker can now create GPT Image 2 stills from the real profile photo, animate the scenes, and save the finished URLs back here.",
      automationMode: "mcp_worker_required",
    });
  } catch (error) {
    console.error("Error starting creative automation:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to start creative automation",
      },
      { status: 500 }
    );
  }
}
