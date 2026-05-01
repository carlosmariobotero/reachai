import { NextRequest, NextResponse } from "next/server";
import {
  createOrUpdateCreativeVideoJob,
  getCreativeVideoScenes,
  getLead,
  updateCreativeVideoScene,
} from "../../../../../../../lib/integrations/supabase";
import type { CreativeSceneStatus } from "../../../../../../../lib/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string; sceneId: string }> }
) {
  try {
    const { leadId, sceneId } = await params;
    const body = (await request.json()) as {
      status?: CreativeSceneStatus;
      higgsfieldRequestId?: string;
      videoUrl?: string;
      thumbnailUrl?: string;
      errorMessage?: string | null;
    };

    const scene = await updateCreativeVideoScene(sceneId, body);
    const [lead, scenes] = await Promise.all([
      getLead(leadId),
      getCreativeVideoScenes(leadId),
    ]);

    if (lead && scenes.length > 0 && scenes.every((item) => item.status === "ready")) {
      await createOrUpdateCreativeVideoJob({
        leadId,
        campaignId: lead.campaignId,
        status: "scenes_ready",
      });
    }

    return NextResponse.json({ scene });
  } catch (error) {
    console.error("Error updating creative scene:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update scene" },
      { status: 500 }
    );
  }
}
