import { sleep } from "workflow";
import { processCampaignBatch } from "../lib/campaign-worker";

type BatchResult = {
  active: boolean;
  remaining: number;
  progressed: boolean;
};

async function deliverCampaignBatch(campaignId: string, token: string) {
  "use step";

  return processCampaignBatch(campaignId, token) as Promise<BatchResult>;
}

deliverCampaignBatch.maxRetries = 2;

export async function campaignDeliveryWorkflow(
  campaignId: string,
  token: string,
) {
  "use workflow";

  let result: BatchResult = {
    active: true,
    remaining: 1,
    progressed: true,
  };

  while (result.active && result.remaining > 0) {
    result = await deliverCampaignBatch(campaignId, token);

    if (result.active && result.remaining > 0 && !result.progressed) {
      await sleep("2m");
    }
  }

  return {
    campaignId,
    status: result.active ? "completed" : "stopped",
    remaining: result.remaining,
  };
}
