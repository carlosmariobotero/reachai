import { NextRequest, NextResponse } from "next/server";
import { buildHiggsfieldMcpTasks } from "../../../../../../../lib/creative/higgsfield-mcp";
import {
  createOrUpdateCreativeVideoJob,
  getCreativeVideoJob,
  getCreativeVideoScenes,
  getLead,
  queueCreativeVideoScenes,
} from "../../../../../../../lib/integrations/supabase";

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
        { error: "Upload a lead profile photo before queueing scenes" },
        { status: 400 }
      );
    }

    const job = await getCreativeVideoJob(leadId);
    if (!job) {
      return NextResponse.json(
        { error: "Generate a creative brief before queueing scenes" },
        { status: 400 }
      );
    }

    await queueCreativeVideoScenes(leadId);
    const scenes = await getCreativeVideoScenes(leadId);
    await createOrUpdateCreativeVideoJob({
      leadId,
      campaignId: lead.campaignId,
      status: "scenes_queued",
    });

    return NextResponse.json({
      scenes,
      mcpTasks: buildHiggsfieldMcpTasks(lead, job, scenes),
      automationMessage:
        "Higgsfield scene jobs are queued for the MCP worker. The worker must run in a Codex/Claude session that is signed in to Higgsfield MCP, then write each GPT Image 2 still and animation URL back to these scene records.",
      automationMode: "mcp_worker_required",
    });
  } catch (error) {
    console.error("Error queueing Higgsfield scenes:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to queue scenes" },
      { status: 500 }
    );
  }
}
