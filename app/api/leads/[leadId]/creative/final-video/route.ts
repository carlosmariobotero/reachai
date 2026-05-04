import { NextRequest, NextResponse } from "next/server";
import {
  createOrUpdateCreativeVideoJob,
  getCreativeVideoJob,
  getLead,
  saveLeadVideo,
  updateLeadStatus,
  uploadAsset,
} from "../../../../../../lib/integrations/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const [lead, job] = await Promise.all([
      getLead(leadId),
      getCreativeVideoJob(leadId),
    ]);

    if (!lead || !job) {
      return NextResponse.json(
        { error: "Creative package not found" },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("video");
    const shouldApprove = formData.get("approve") !== "false";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Final MP4 file is required" }, { status: 400 });
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
    const safeExtension = ["mp4", "mov", "webm"].includes(extension)
      ? extension
      : "mp4";
    const finalVideoUrl = await uploadAsset({
      bucket: "creative-assets",
      path: `final-videos/${leadId}/final.${safeExtension}`,
      body: await file.arrayBuffer(),
      contentType: file.type || "video/mp4",
    });

    const approvedAt = shouldApprove ? new Date().toISOString() : undefined;
    const updatedJob = await createOrUpdateCreativeVideoJob({
      leadId,
      campaignId: lead.campaignId,
      status: shouldApprove ? "approved" : "render_ready",
      finalVideoUrl,
      approvedAt,
    });

    await saveLeadVideo(leadId, finalVideoUrl, job.id);
    if (shouldApprove) {
      await updateLeadStatus(leadId, "approved");
    }

    return NextResponse.json({ job: updatedJob, finalVideoUrl });
  } catch (error) {
    console.error("Error uploading final creative video:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to upload final video",
      },
      { status: 500 }
    );
  }
}
