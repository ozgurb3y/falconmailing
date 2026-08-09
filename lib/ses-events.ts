import { createVerify } from "node:crypto";

const DEFAULT_TOPIC_ARN =
  "arn:aws:sns:eu-central-1:597564118670:falconmailing-ses-events";

export type SnsEnvelope = {
  Type: "Notification" | "SubscriptionConfirmation" | "UnsubscribeConfirmation";
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: "1" | "2";
  Signature: string;
  SigningCertURL: string;
  Subject?: string;
  SubscribeURL?: string;
  Token?: string;
};

const certCache = new Map<string, { certificate: string; expiresAt: number }>();

function allowedTopicArn() {
  return process.env.SES_SNS_TOPIC_ARN || DEFAULT_TOPIC_ARN;
}

function trustedSnsUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      /^sns\.[a-z0-9-]+\.amazonaws\.com$/i.test(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function signatureFields(envelope: SnsEnvelope) {
  return envelope.Type === "Notification"
    ? ["Message", "MessageId", ...(envelope.Subject ? ["Subject"] : []), "Timestamp", "TopicArn", "Type"]
    : ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"];
}

async function signingCertificate(url: string) {
  const cached = certCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.certificate;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("SNS signing certificate could not be loaded.");
  const certificate = await response.text();
  certCache.set(url, { certificate, expiresAt: Date.now() + 60 * 60 * 1000 });
  return certificate;
}

export async function verifySnsEnvelope(envelope: SnsEnvelope) {
  if (
    envelope.TopicArn !== allowedTopicArn() ||
    !trustedSnsUrl(envelope.SigningCertURL) ||
    !["1", "2"].includes(envelope.SignatureVersion)
  ) {
    return false;
  }
  const fields = signatureFields(envelope);
  const canonical = fields
    .map((field) => `${field}\n${String(envelope[field as keyof SnsEnvelope] || "")}\n`)
    .join("");
  const certificate = await signingCertificate(envelope.SigningCertURL);
  const verifier = createVerify(
    envelope.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1",
  );
  verifier.update(canonical, "utf8");
  verifier.end();
  return verifier.verify(certificate, envelope.Signature, "base64");
}

export async function confirmSnsSubscription(envelope: SnsEnvelope) {
  if (!envelope.SubscribeURL || !trustedSnsUrl(envelope.SubscribeURL)) {
    throw new Error("SNS subscription URL is not trusted.");
  }
  const response = await fetch(envelope.SubscribeURL, { cache: "no-store" });
  if (!response.ok) throw new Error("SNS subscription could not be confirmed.");
}
