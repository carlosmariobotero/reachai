import Anthropic from "@anthropic-ai/sdk";
import { agentTools, executeTool } from "./tools";
import {
  getCampaign,
  getLeadsByCampaign,
  updateCampaignStatus,
} from "../integrations/supabase";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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
}
