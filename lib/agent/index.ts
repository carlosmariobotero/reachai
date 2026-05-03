import { executeTool } from "./tools";
import {
  getCampaign,
  getLeadsByCampaign,
  updateCampaignStatus,
} from "../integrations/supabase";

export async function runCampaign(campaignId: string): Promise<void> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  await updateCampaignStatus(campaignId, "scraping");

  const scrapeResult = await executeTool("scrape_leads", {
    campaign_id: campaignId,
    job_titles: campaign.jobTitles,
    company_size: campaign.companySize,
    geography: campaign.geography,
    lead_count: campaign.leadCount,
  });

  if (!scrapeResult.success) {
    await updateCampaignStatus(campaignId, "paused");
    throw new Error(scrapeResult.error ?? "Apollo lead scraping failed");
  }

  const leads = await getLeadsByCampaign(campaignId);
  await updateCampaignStatus(campaignId, "active", { totalLeads: leads.length });
}
