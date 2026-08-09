import { NextResponse } from "next/server";
import {
  confirmSnsSubscription,
  type SnsEnvelope,
  verifySnsEnvelope,
} from "@/lib/ses-events";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const envelope = (await request.json()) as SnsEnvelope;
    if (!(await verifySnsEnvelope(envelope))) {
      return NextResponse.json({ message: "Invalid SNS signature." }, { status: 403 });
    }
    if (envelope.Type === "SubscriptionConfirmation") {
      await confirmSnsSubscription(envelope);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("SES webhook failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ message: "Webhook could not be processed." }, { status: 400 });
  }
}
