import { createVerify } from "node:crypto";
import { db } from "@/lib/db";

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

type SesEvent = {
  eventType?: string;
  notificationType?: string;
  mail?: {
    messageId?: string;
    timestamp?: string;
    destination?: string[];
  };
  [key: string]: unknown;
};

function eventStatus(eventType: string) {
  return (
    {
      send: "accepted",
      delivery: "delivered",
      deliverydelay: "delayed",
      bounce: "bounced",
      complaint: "complained",
      reject: "rejected",
      renderingfailure: "rendering_failed",
    } as Record<string, string>
  )[eventType.toLowerCase().replaceAll("_", "").replaceAll(" ", "")];
}

function eventTimestamp(event: SesEvent, normalizedType: string) {
  const candidates = [
    event[normalizedType],
    event[normalizedType === "deliverydelay" ? "deliveryDelay" : ""],
    event[normalizedType === "renderingfailure" ? "failure" : ""],
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && "timestamp" in candidate) {
      return String((candidate as { timestamp: unknown }).timestamp);
    }
  }
  return event.mail?.timestamp || new Date().toISOString();
}

const statusPriority: Record<string, number> = {
  unknown: 0,
  accepted: 1,
  delayed: 2,
  delivered: 3,
  rendering_failed: 4,
  rejected: 5,
  bounced: 6,
  complained: 7,
};

async function applyDeliveryEvent({
  sesMessageId,
  status,
  eventAt,
  payload,
}: {
  sesMessageId: string;
  status: string;
  eventAt: string;
  payload: SesEvent;
}) {
  const sql = db();
  const priority = statusPriority[status] || 0;
  await sql`
    UPDATE campaign_recipients
    SET delivery_status = CASE
          WHEN ${priority} >= CASE delivery_status
            WHEN 'complained' THEN 7 WHEN 'bounced' THEN 6 WHEN 'rejected' THEN 5
            WHEN 'rendering_failed' THEN 4 WHEN 'delivered' THEN 3
            WHEN 'delayed' THEN 2 WHEN 'accepted' THEN 1 ELSE 0 END
          THEN ${status} ELSE delivery_status END,
        delivered_at = CASE
          WHEN ${status} = 'delivered' THEN ${eventAt}::timestamptz
          ELSE delivered_at END,
        last_delivery_event_at = GREATEST(
          COALESCE(last_delivery_event_at, ${eventAt}::timestamptz),
          ${eventAt}::timestamptz
        ),
        delivery_event_detail = CASE
          WHEN last_delivery_event_at IS NULL OR ${eventAt}::timestamptz >= last_delivery_event_at
          THEN ${JSON.stringify(payload)}::jsonb ELSE delivery_event_detail END,
        updated_at = NOW()
    WHERE ses_message_id = ${sesMessageId}
  `;
}

export async function recordSesNotification(
  snsMessageId: string,
  message: string,
) {
  const event = JSON.parse(message) as SesEvent;
  const rawType = event.eventType || event.notificationType || "";
  const normalizedType = rawType.toLowerCase().replaceAll("_", "").replaceAll(" ", "");
  const status = eventStatus(rawType);
  const sesMessageId = event.mail?.messageId;
  if (!status || !sesMessageId) return;
  const eventAt = eventTimestamp(event, normalizedType);
  const recipients = event.mail?.destination || [];
  const compactPayload: SesEvent = {
    eventType: rawType,
    status,
    eventAt,
  };
  const sql = db();
  await sql`
    INSERT INTO ses_delivery_events (
      sns_message_id, ses_message_id, event_type, event_at,
      recipient_emails, payload, created_at
    ) VALUES (
      ${snsMessageId}, ${sesMessageId}, ${rawType}, ${eventAt}::timestamptz,
      ${JSON.stringify(recipients)}::jsonb,
      ${JSON.stringify(compactPayload)}::jsonb, NOW()
    )
    ON CONFLICT (sns_message_id) DO NOTHING
  `;
  await applyDeliveryEvent({
    sesMessageId,
    status,
    eventAt,
    payload: compactPayload,
  });
}

export async function reconcileSesMessage(sesMessageId: string) {
  const sql = db();
  const rows = await sql`
    SELECT event_type, event_at, payload
    FROM ses_delivery_events
    WHERE ses_message_id = ${sesMessageId}
    ORDER BY event_at
  `;
  for (const row of rows) {
    const status = eventStatus(String(row.event_type));
    if (status) {
      await applyDeliveryEvent({
        sesMessageId,
        status,
        eventAt: String(row.event_at),
        payload: row.payload as SesEvent,
      });
    }
  }
}
