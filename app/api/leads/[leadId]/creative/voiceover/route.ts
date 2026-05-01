import { NextRequest, NextResponse } from "next/server";
import { generateNarratorVoiceover } from "../../../../../../lib/integrations/elevenlabs";
import {
  createOrUpdateCreativeVideoJob,
  getCreativeVideoJob,
  getLead,
  uploadAsset,
} from "../../../../../../lib/integrations/supabase";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const [lead, job] = await Promise.all([
      getLead(leadId),
      getCreativeVideoJob(leadId),
    ]);

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (!job?.voiceoverScript) {
      return NextResponse.json(
        { error: "Generate the creative brief before voiceover" },
        { status: 400 }
      );
    }

    const voiceover = await generateNarratorVoiceover(job.voiceoverScript);
    const voiceoverUrl = await uploadAsset({
      bucket: "creative-assets",
      path: `voiceovers/${leadId}/narrator.${voiceover.fileExtension}`,
      body: voiceover.buffer,
      contentType: voiceover.contentType,
    });

    const updatedJob = await createOrUpdateCreativeVideoJob({
      leadId,
      campaignId: lead.campaignId,
      status: "voiceover_ready",
      voiceoverUrl,
    });

    return NextResponse.json({ job: updatedJob, voiceoverUrl });
  } catch (error) {
    console.error("Error generating ElevenLabs voiceover:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate ElevenLabs voiceover",
      },
      { status: 500 }
    );
  }
}
