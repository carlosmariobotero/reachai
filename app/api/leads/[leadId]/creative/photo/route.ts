import { NextRequest, NextResponse } from "next/server";
import {
  saveLeadProfilePhoto,
  uploadAsset,
} from "../../../../../../lib/integrations/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const formData = await request.formData();
    const file = formData.get("photo");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Photo file is required" }, { status: 400 });
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension)
      ? extension
      : "jpg";
    const path = `lead-photos/${leadId}/profile.${safeExtension}`;
    const photoUrl = await uploadAsset({
      bucket: "creative-assets",
      path,
      body: await file.arrayBuffer(),
      contentType: file.type || "image/jpeg",
    });
    const lead = await saveLeadProfilePhoto(leadId, photoUrl);

    return NextResponse.json({ lead, photoUrl });
  } catch (error) {
    console.error("Error uploading lead photo:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload photo" },
      { status: 500 }
    );
  }
}
