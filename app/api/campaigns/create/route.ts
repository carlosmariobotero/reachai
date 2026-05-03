import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createCampaign } from "../../../../lib/integrations/supabase";
import { runCampaign } from "../../../../lib/agent/index";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      clientId,
      clientName,
      clientEmail,
      websiteUrl,
      painPoint,
      industries,
      jobTitles,
      companySize,
      geography,
      leadCount,
      name,
    } = body as {
      clientId: string;
      clientName: string;
      clientEmail: string;
      websiteUrl: string;
      painPoint: string;
      industries: string[];
      jobTitles: string[];
      companySize: string;
      geography: string[];
      leadCount: number;
      name: string;
    };

    if (
      !clientId ||
      !clientName ||
      !clientEmail ||
      !websiteUrl ||
      !painPoint ||
      !name ||
      !Array.isArray(industries) ||
      !Array.isArray(jobTitles) ||
      !companySize ||
      !Array.isArray(geography) ||
      !leadCount
    ) {
      return NextResponse.json(
        { error: "Missing required campaign fields" },
        { status: 400 }
      );
    }

    const campaign = await createCampaign({
      clientId,
      clientName,
      clientEmail,
      websiteUrl,
      painPoint,
      industries,
      jobTitles,
      companySize,
      geography,
      leadCount,
      name,
    });

    // Send confirmation email to client — fire and forget
    resend.emails
      .send({
        from:
          process.env.RESEND_FROM_EMAIL ??
          `outreach@${
            process.env.NEXT_PUBLIC_APP_URL?.replace("https://", "") ??
            "reachai.com"
          }`,
        to: clientEmail,
        subject: `Your ReachAI campaign "${name}" is being set up`,
        html: `<p>Hi ${clientName},</p>
<p>Your personalized outreach campaign <strong>${name}</strong> has been created and is now being processed.</p>
<p>We'll scrape up to <strong>${leadCount} leads</strong> matching your ICP and start personalizing videos automatically.</p>
<p>Track progress at: <a href="${process.env.NEXT_PUBLIC_APP_URL}/client/${campaign.id}">${process.env.NEXT_PUBLIC_APP_URL}/client/${campaign.id}</a></p>
<p>— The ReachAI Team</p>`,
      })
      .catch((err: unknown) => console.error("Confirmation email failed:", err));

    // Kick off agent pipeline without blocking the response
    runCampaign(campaign.id).catch((err: unknown) =>
      console.error(`runCampaign ${campaign.id} failed:`, err)
    );

    return NextResponse.json(
      {
        campaign_id: campaign.id,
        client_url: `${process.env.NEXT_PUBLIC_APP_URL}/client/${campaign.id}`,
        status: campaign.status,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating campaign:", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
