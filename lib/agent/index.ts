import Anthropic from "@anthropic-ai/sdk";
import { agentTools, executeTool } from "./tools";
import {
  getCampaign,
  getLeadsByCampaign,
  updateCampaignStatus,
} from "../integrations/supabase";
import type { Campaign, Lead } from "../types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function processLead(lead: Lead, campaign: Campaign): Promise<void> {
  const systemPrompt = `You are ReachAI's outreach agent. For each lead you receive, call tools in this exact order:
1. research_lead — gather intel on the lead
2. generate_script — write a personalized video script and email
3. generate_video — create the HeyGen video
4. deliver_lead — send the email with video link

Always complete all four steps. Be specific and reference concrete details from research.`;

  const userMessage = `Process this lead for campaign "${campaign.name}":
- Lead ID: ${lead.id}
- Name: ${lead.firstName} ${lead.lastName}
- Title: ${lead.title ?? "Unknown"}
- Company: ${lead.company ?? "Unknown"}
- Email: ${lead.email}
- LinkedIn: ${lead.linkedinUrl ?? "N/A"}
- Client: ${campaign.clientName}
- Website: ${campaign.websiteUrl}
- Pain point we solve: ${campaign.painPoint}`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  while (true) {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 8096,
      system: systemPrompt,
      tools: agentTools,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") break;
    if (response.stop_reason !== "tool_use") break;

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (tool) => {
        const result = await executeTool(
          tool.name,
          tool.input as Record<string, unknown>
        );
        return {
          type: "tool_result" as const,
          tool_use_id: tool.id,
          content: JSON.stringify(result),
          is_error: !result.success,
        };
      })
    );

    messages.push({ role: "user", content: toolResults });
  }
}

export async function runCampaign(campaignId: string): Promise<void> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  await updateCampaignStatus(campaignId, "scraping");

  // Use the orchestrator Claude call to scrape leads via Apollo
  const scrapeMessages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Call scrape_leads with these parameters:
- campaign_id: ${campaignId}
- job_titles: ${JSON.stringify(campaign.jobTitles)}
- company_size: ${campaign.companySize}
- geography: ${JSON.stringify(campaign.geography)}
- lead_count: ${campaign.leadCount}`,
    },
  ];

  const scrapeResponse = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    tools: agentTools,
    messages: scrapeMessages,
  });

  if (scrapeResponse.stop_reason === "tool_use") {
    const toolBlocks = scrapeResponse.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    await Promise.all(
      toolBlocks.map((tool) =>
        executeTool(tool.name, tool.input as Record<string, unknown>)
      )
    );
  }

  const leads = await getLeadsByCampaign(campaignId);
  await updateCampaignStatus(campaignId, "active", { totalLeads: leads.length });

  const batches = chunkArray(leads, 3);
  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map((lead) => processLead(lead, campaign))
    );
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        console.error(
          `Lead ${batch[i].firstName} ${batch[i].lastName} (${batch[i].id}) failed:`,
          result.reason
        );
      }
    });
  }

  const finalLeads = await getLeadsByCampaign(campaignId);
  const emailsSent = finalLeads.filter(
    (l) => l.status === "emailed" || l.status === "responded"
  ).length;
  const videosGenerated = finalLeads.filter(
    (l) =>
      l.status === "video_ready" ||
      l.status === "emailed" ||
      l.status === "responded"
  ).length;
  const researched = finalLeads.filter(
    (l) => l.status !== "new" && l.status !== "failed"
  ).length;
  const scriptsDone = finalLeads.filter(
    (l) =>
      l.status === "scripted" ||
      l.status === "video_generating" ||
      l.status === "video_ready" ||
      l.status === "emailed" ||
      l.status === "responded"
  ).length;

  await updateCampaignStatus(campaignId, "completed", {
    totalLeads: finalLeads.length,
    researched,
    scriptsDone,
    videosGenerated,
    emailsSent,
  });
}
