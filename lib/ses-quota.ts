import { GetAccountCommand, SESv2Client } from "@aws-sdk/client-sesv2";

let client: SESv2Client | undefined;

function sesRegion() {
  return (
    process.env.AWS_REGION ||
    process.env.SES_SMTP_HOST?.match(/^email-smtp\.([a-z0-9-]+)\./i)?.[1] ||
    "eu-central-1"
  );
}

function hasAwsApiCredentials() {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY,
  );
}

export async function getLiveSesQuota() {
  if (!hasAwsApiCredentials()) return null;
  try {
    client ??= new SESv2Client({ region: sesRegion() });
    const account = await client.send(new GetAccountCommand({}));
    const quota = account.SendQuota;
    if (
      typeof quota?.Max24HourSend !== "number" ||
      typeof quota.SentLast24Hours !== "number"
    ) {
      return null;
    }
    return {
      max24HourSend: quota.Max24HourSend,
      sentLast24Hours: quota.SentLast24Hours,
      maxSendRate:
        typeof quota.MaxSendRate === "number" ? quota.MaxSendRate : null,
    };
  } catch (error) {
    console.warn("SES quota API could not be read", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}
