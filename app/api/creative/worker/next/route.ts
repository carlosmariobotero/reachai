import { NextRequest, NextResponse } from "next/server";
import { buildHiggsfieldMcpTasks } from "../../../../../lib/creative/higgsfield-mcp";
import {
  claimQueuedCreativeVideoScenes,
  getCampaign,
  getCreativeVideoScenes,
  getLead,
  getQueuedCreativeVideoJobs,
} from "../../../../../lib/integrations/supabase";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CREATIVE_WORKER_SECRET?.trim();
  if (!secret) return true;

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  return token === secret;
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized worker request" },
        { status: 401 }
      );
    }

    const shouldClaim = request.nextUrl.searchParams.get("peek") !== "1";
    const jobs = await getQueuedCreativeVideoJobs(10);

    for (const job of jobs) {
      const [lead, campaign, scenes] = await Promise.all([
        getLead(job.leadId),
        getCampaign(job.campaignId),
        getCreativeVideoScenes(job.leadId),
      ]);

      if (!lead || !campaign) continue;

      const queuedScenes = scenes.filter(
        (scene) => scene.status === "queued" && !scene.videoUrl
      );

      if (!lead.profilePhotoUrl || queuedScenes.length === 0) {
        continue;
      }

      const workerScenes = shouldClaim
        ? await claimQueuedCreativeVideoScenes(job.leadId)
        : queuedScenes;

      if (workerScenes.length === 0) continue;

      return NextResponse.json({
        ok: true,
        mode: shouldClaim ? "claimed" : "peek",
        lead,
        campaign,
        job,
        scenes: workerScenes,
        mcpTasks: buildHiggsfieldMcpTasks(lead, job, workerScenes),
      });
    }

    return NextResponse.json({
      ok: true,
      lead: null,
      campaign: null,
      job: null,
      scenes: [],
      mcpTasks: [],
      message: "No queued creative scenes are ready for the MCP worker.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown worker error",
      },
      { status: 500 }
    );
  }
}
