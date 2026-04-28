import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, video_id, status, video_url } = body;

    if (!event || !video_id) {
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 }
      );
    }

    console.log(`HeyGen webhook: event=${event} video_id=${video_id} status=${status}`);

    if (event === "video.completed" && video_url) {
      // Placeholder: update video record in Supabase and trigger email send
      console.log(`Video ready: ${video_id} -> ${video_url}`);
    }

    if (event === "video.failed") {
      // Placeholder: mark video as failed in Supabase and alert
      console.error(`Video failed: ${video_id}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing HeyGen webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
