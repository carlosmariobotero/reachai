import { NextRequest, NextResponse } from "next/server";
import {
  createOrUpdateCreativeVideoJob,
  getCreativeVideoJob,
  getLead,
  saveLeadVideo,
  updateLeadStatus,
} from "../../../../../../lib/integrations/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      finalVideoUrl?: string;
    };
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

    const finalVideoUrl = body.finalVideoUrl ?? job.finalVideoUrl;
    if (!finalVideoUrl) {
      return NextResponse.json(
        { error: "Final MP4 URL is required before approval" },
        { status: 400 }
      );
    }

    const approvedAt = new Date().toISOString();
    const updatedJob = await createOrUpdateCreativeVideoJob({
      leadId,
      campaignId: lead.campaignId,
      status: "approved",
      finalVideoUrl,
      approvedAt,
    });
    await saveLeadVideo(leadId, finalVideoUrl, job.id);
    await updateLeadStatus(leadId, "approved");

    return NextResponse.json({ job: updatedJob });
  } catch (error) {
    console.error("Error approving creative video:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to approve video" },
      { status: 500 }
    );
  }
}
