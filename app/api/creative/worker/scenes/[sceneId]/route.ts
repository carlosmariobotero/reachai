import { NextRequest, NextResponse } from "next/server";
import {
  createOrUpdateCreativeVideoJob,
  getCreativeVideoScenes,
  getLead,
  updateCreativeVideoScene,
} from "../../../../../../lib/integrations/supabase";
import type { CreativeSceneStatus } from "../../../../../../lib/types";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CREATIVE_WORKER_SECRET?.trim();
  if (!secret) return true;

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  return token === secret;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sceneId: string }> }
) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized worker request" },
        { status: 401 }
      );
    }

    const { sceneId } = await params;
    const body = (await request.json()) as {
      status?: CreativeSceneStatus;
      higgsfieldMediaId?: string;
      stillImageJobId?: string;
      stillImageUrl?: string;
      videoJobId?: string;
      higgsfieldRequestId?: string;
      videoUrl?: string;
      thumbnailUrl?: string;
      errorMessage?: string | null;
    };

    const scene = await updateCreativeVideoScene(sceneId, body);
    const [lead, scenes] = await Promise.all([
      getLead(scene.leadId),
      getCreativeVideoScenes(scene.leadId),
    ]);

    if (lead && scenes.length > 0) {
      if (scenes.every((item) => item.status === "ready")) {
        await createOrUpdateCreativeVideoJob({
          leadId: lead.id,
          campaignId: lead.campaignId,
          status: "scenes_ready",
        });
      } else if (body.status === "failed") {
        await createOrUpdateCreativeVideoJob({
          leadId: lead.id,
          campaignId: lead.campaignId,
          status: "failed",
        });
      }
    }

    return NextResponse.json({ ok: true, scene });
  } catch (error) {
    console.error("Error updating worker scene:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to update worker scene",
      },
      { status: 500 }
    );
  }
}
