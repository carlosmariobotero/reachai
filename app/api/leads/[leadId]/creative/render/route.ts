import { NextRequest, NextResponse } from "next/server";
import { createHyperframesComposition } from "../../../../../../lib/creative/hyperframes";
import {
  createOrUpdateCreativeVideoJob,
  getCampaign,
  getCreativeVideoJob,
  getCreativeVideoScenes,
  getLead,
  uploadAsset,
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

    const [campaign, job, scenes] = await Promise.all([
      getCampaign(lead.campaignId),
      getCreativeVideoJob(leadId),
      getCreativeVideoScenes(leadId),
    ]);

    if (!campaign || !job) {
      return NextResponse.json(
        { error: "Creative package is incomplete" },
        { status: 400 }
      );
    }
    if (!job.voiceoverUrl) {
      return NextResponse.json(
        { error: "Generate ElevenLabs voiceover before rendering" },
        { status: 400 }
      );
    }
    if (scenes.length !== 3 || scenes.some((scene) => !scene.videoUrl)) {
      return NextResponse.json(
        { error: "All three Higgsfield scene videos are required before rendering" },
        { status: 400 }
      );
    }

    const composition = createHyperframesComposition({
      campaign,
      lead,
      job,
      scenes,
    });
    const compositionUrl = await uploadAsset({
      bucket: "creative-assets",
      path: `hyperframes/${leadId}/composition.html`,
      body: composition,
      contentType: "text/html; charset=utf-8",
    });

    const updatedJob = await createOrUpdateCreativeVideoJob({
      leadId,
      campaignId: campaign.id,
      status: "render_ready",
      hyperframesCompositionUrl: compositionUrl,
    });

    return NextResponse.json({
      job: updatedJob,
      compositionUrl,
      renderInstructions:
        "Open this composition with HyperFrames and render it to MP4. Save the final MP4 URL back to finalVideoUrl.",
    });
  } catch (error) {
    console.error("Error creating HyperFrames composition:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create render" },
      { status: 500 }
    );
  }
}
