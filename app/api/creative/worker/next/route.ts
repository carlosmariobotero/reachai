import { NextRequest, NextResponse } from "next/server";
import { buildHiggsfieldMcpTasks } from "../../../../../lib/creative/higgsfield-mcp";
import {
  claimQueuedCreativeVideoScenes,
  createOrUpdateCreativeVideoJob,
  getActiveCreativeVideoJobs,
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

    const hasWorkerSecret = Boolean(process.env.CREATIVE_WORKER_SECRET?.trim());
    const isPeek = request.nextUrl.searchParams.get("peek") === "1";
    const claimRequested = request.nextUrl.searchParams.get("claim") === "1";
    const shouldClaim = !isPeek && (hasWorkerSecret || claimRequested);
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

      let responseJob = job;
      if (shouldClaim) {
        responseJob = await createOrUpdateCreativeVideoJob({
          leadId: job.leadId,
          campaignId: job.campaignId,
          status: "scenes_generating",
        });
      }

      return NextResponse.json({
        ok: true,
        mode: shouldClaim ? "claimed" : "peek",
        lead,
        campaign,
        job: responseJob,
        scenes: workerScenes,
        mcpTasks: buildHiggsfieldMcpTasks(lead, job, workerScenes),
      });
    }

    if (isPeek) {
      const activeJobs = await getActiveCreativeVideoJobs(10);

      for (const job of activeJobs) {
        const [lead, campaign, scenes] = await Promise.all([
          getLead(job.leadId),
          getCampaign(job.campaignId),
          getCreativeVideoScenes(job.leadId),
        ]);

        if (!lead || !campaign) continue;

        const activeScenes = scenes.filter(
          (scene) => scene.status === "generating" || scene.status === "ready"
        );

        if (activeScenes.length === 0) continue;

        return NextResponse.json({
          ok: true,
          mode: "active",
          lead,
          campaign,
          job,
          scenes: activeScenes,
          mcpTasks: buildHiggsfieldMcpTasks(lead, job, activeScenes),
          message:
            "A Higgsfield worker already claimed this lead. These scenes are in progress or already finished.",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      lead: null,
      campaign: null,
      job: null,
      scenes: [],
      mcpTasks: [],
      message: shouldClaim
        ? "No queued creative scenes are waiting to be claimed."
        : "No queued creative scenes are ready for preview.",
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
