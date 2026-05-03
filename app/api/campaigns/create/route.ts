import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createCampaign } from "../../../../lib/integrations/supabase";
import { runCampaign } from "../../../../lib/agent/index";

const resend = new Resend(process.env.RESEND_API_KEY!);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function appUrl(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? request.nextUrl.origin;
}

function confirmationEmailHtml(input: {
  clientName: string;
  name: string;
  leadCount: number;
  trackingUrl: string;
}) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#050505;color:#ffffff;font-family:Arial,sans-serif;">
    <div style="max-width:620px;margin:0 auto;padding:36px 24px;">
      <p style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#BEFF00;margin:0 0 28px;">ReachAI</p>
      <h1 style="font-size:42px;line-height:0.98;margin:0 0 18px;font-weight:800;letter-spacing:-0.04em;">
        Your campaign is<br><span style="color:#BEFF00;">being built.</span>
      </h1>
      <p style="font-size:15px;line-height:1.7;color:#b8b8b8;margin:0 0 28px;">
        Hi ${input.clientName}, your personalized outreach campaign <strong style="color:#fff;">${input.name}</strong> has been created. ReachAI is now preparing up to <strong style="color:#fff;">${input.leadCount} leads</strong> from your targeting answers.
      </p>
      <a href="${input.trackingUrl}" style="display:inline-block;background:#BEFF00;color:#000;text-decoration:none;font-weight:800;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;padding:14px 22px;border-radius:2px;">
        Track Campaign
      </a>
      <div style="height:1px;background:#171717;margin:34px 0 18px;"></div>
      <p style="font-size:12px;line-height:1.6;color:#666;margin:0;">
        Next: we scrape matching leads, create personalized creative briefs, then prepare each lead for review before video generation.
      </p>
    </div>
  </body>
</html>`;
}

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
      clientId: UUID_PATTERN.test(clientId) ? clientId : crypto.randomUUID(),
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

    const trackingUrl = `${appUrl(request)}/client/${campaign.id}`;
    let emailWarning: string | undefined;
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "ReachAI <onboarding@resend.dev>",
        to: clientEmail,
        subject: `Your ReachAI campaign is being built`,
        html: confirmationEmailHtml({ clientName, name, leadCount, trackingUrl }),
      });
    } catch (err) {
      emailWarning = `Email failed: ${err instanceof Error ? err.message : "confirmation email failed"}. If you want real client emails, verify a sending domain in Resend and set RESEND_FROM_EMAIL in Vercel.`;
      console.error("Confirmation email failed:", err);
    }

    let scrapeWarning: string | undefined;
    try {
      await runCampaign(campaign.id);
    } catch (err) {
      scrapeWarning = `Apollo failed: ${err instanceof Error ? err.message : "lead scraping failed"}`;
      console.error(`runCampaign ${campaign.id} failed:`, err);
    }

    return NextResponse.json(
      {
        campaign_id: campaign.id,
        client_url: trackingUrl,
        status: campaign.status,
        email_warning: emailWarning,
        scrape_warning: scrapeWarning,
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
