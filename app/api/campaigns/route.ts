import { NextResponse } from "next/server";
import { getAllCampaigns } from "../../../lib/integrations/supabase";

export async function GET() {
  try {
    const campaigns = await getAllCampaigns();
    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}
