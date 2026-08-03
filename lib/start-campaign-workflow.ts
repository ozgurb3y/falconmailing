import { start } from "workflow/api";
import { campaignDeliveryWorkflow } from "@/workflows/campaign-delivery";

export async function startCampaignDelivery(
  campaignId: string,
  workerToken: string,
) {
  const run = await start(campaignDeliveryWorkflow, [campaignId, workerToken]);
  return run.runId;
}
