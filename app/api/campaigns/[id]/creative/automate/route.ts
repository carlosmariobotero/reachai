import { NextRequest, NextResponse } from "next/server";
import { generateCreativeBrief } from "../../../../../../lib/creative/agent";
import {
  createOrUpdateCreativeVideoJob,
  getCampaign,
  getCreativeVideoJob,
  getCreativeVideoScenes,
  getLeadsByCampaign,
  queueCreativeVideoScenes,
  replaceCreativeVideoScenes,
  saveLeadResearch,
  saveLeadScript,
  updateCampaignStatus,
} from "../../../../../../lib/integrations/supabase";

export const dynamic = "force-dynamic";

type AutomationResult = {
  leadId: string;
  name: string;
  status: "queued" | "skipped" | "failed";
  reason?: string;
  sceneCount?: number;
};

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
    const requestedLimit = Number(body.limit ?? 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.round(requestedLimit), 1), 25)
      : 10;

    const leads = await getLeadsByCampaign(id);
    const results: AutomationResult[] = [];
    let processed = 0;

    await updateCampaignStatus(id, "active");

    for (const lead of leads) {
      if (processed >= limit) break;

      const name = `${lead.firstName} ${lead.lastName}`.trim();

      if (!lead.linkedinUrl) {
        results.push({
          leadId: lead.id,
          name,
          status: "skipped",
          reason: "LinkedIn URL is required before creative work.",
        });
        continue;
      }

      if (!lead.profilePhotoUrl) {
        results.push({
          leadId: lead.id,
          name,
          status: "skipped",
          reason: "Upload the LinkedIn profile photo first.",
        });
        continue;
      }

      const existingScenes = await getCreativeVideoScenes(lead.id);
      const hasActiveScenes = existingScenes.some((scene) =>
        ["queued", "generating", "ready"].includes(scene.status)
      );

      if (hasActiveScenes) {
        results.push({
          leadId: lead.id,
          name,
          status: "skipped",
          reason: "Creative scenes are already queued, generating, or ready.",
          sceneCount: existingScenes.length,
        });
        continue;
      }

      processed += 1;

      try {
        let job = await getCreativeVideoJob(lead.id);
        let scenes = existingScenes;

        if (!job || scenes.length === 0) {
          const { clientResearchSummary, leadResearchSummary, creativeBrief } =
            await generateCreativeBrief(campaign, lead);

          await saveLeadResearch(lead.id, leadResearchSummary);
          await saveLeadScript(
            lead.id,
            creativeBrief.voiceoverScript,
            creativeBrief.outreachMessage
          );

          job = await createOrUpdateCreativeVideoJob({
            leadId: lead.id,
            campaignId: campaign.id,
            status: "prompt_ready",
            clientResearchSummary,
            leadResearchSummary,
            salesAngle: creativeBrief.salesAngle,
            voiceoverScript: creativeBrief.voiceoverScript,
            outreachMessage: creativeBrief.outreachMessage,
            creativeBrief,
          });

          scenes = await replaceCreativeVideoScenes(
            job.id,
            lead.id,
            creativeBrief.scenePlan
          );
        }

        const queuedScenes = await queueCreativeVideoScenes(lead.id);
        await createOrUpdateCreativeVideoJob({
          leadId: lead.id,
          campaignId: campaign.id,
          status: "scenes_queued",
        });

        results.push({
          leadId: lead.id,
          name,
          status: "queued",
          sceneCount: queuedScenes.length || scenes.length,
        });
      } catch (error) {
        results.push({
          leadId: lead.id,
          name,
          status: "failed",
          reason: error instanceof Error ? error.message : "Creative automation failed.",
        });
      }
    }

    const queued = results.filter((result) => result.status === "queued").length;
    const skipped = results.filter((result) => result.status === "skipped").length;
    const failed = results.filter((result) => result.status === "failed").length;

    return NextResponse.json({
      ok: true,
      queued,
      skipped,
      failed,
      processed,
      limit,
      results,
      message:
        queued > 0
          ? `${queued} photo-ready lead${queued === 1 ? "" : "s"} queued for the Higgsfield worker.`
          : "No new photo-ready leads were queued.",
    });
  } catch (error) {
    console.error("Error starting campaign creative automation:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to start campaign creative automation",
      },
      { status: 500 }
    );
  }
}
