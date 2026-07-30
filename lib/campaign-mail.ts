import nodemailer from "nodemailer";

let campaignTransporter: nodemailer.Transporter | undefined;

function transporter() {
  const host = process.env.SES_SMTP_HOST;
  const username = process.env.SES_SMTP_USERNAME;
  const password = process.env.SES_SMTP_PASSWORD;
  if (!host || !username || !password) {
    throw new Error("Amazon SES SMTP credentials are not configured.");
  }

  campaignTransporter ??= nodemailer.createTransport({
    host,
    port: Number(process.env.SES_SMTP_PORT || 587),
    secure: false,
    requireTLS: true,
    auth: { user: username, pass: password },
    pool: true,
    maxConnections: 4,
    maxMessages: 100,
  });
  return campaignTransporter;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function paragraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 18px;line-height:1.75">${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`,
    )
    .join("");
}

export async function sendCampaignEmail({
  to,
  recipientName,
  subject,
  previewText,
  heading,
  content,
  ctaLabel,
  ctaUrl,
  unsubscribeToken,
  audienceType,
}: {
  to: string;
  recipientName?: string | null;
  subject: string;
  previewText?: string | null;
  heading: string;
  content: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  unsubscribeToken: string;
  audienceType: "marketing" | "internal";
}) {
  const appUrl = process.env.APP_URL || "https://falconmailing.com";
  const unsubscribeUrl = `${appUrl}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  const fromAddress =
    process.env.MAIL_FROM_ADDRESS || "duyuru@send.falconmailing.com";
  const fromName = process.env.MAIL_FROM_NAME || "FalconMailing";
  const greeting = recipientName?.trim()
    ? `Merhaba ${recipientName.trim()},`
    : "Merhaba,";
  const cta =
    ctaLabel && ctaUrl
      ? `<p style="margin:28px 0"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:5px">${escapeHtml(ctaLabel)}</a></p>`
      : "";
  const footerReason =
    audienceType === "internal"
      ? "Bu e-posta şirket içi iletişim listeniz kapsamında gönderildi."
      : "Bu e-postayı FalconMailing iletişimlerine izin verdiğiniz için aldınız.";

  const result = await transporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    text: `${greeting}\n\n${heading}\n\n${content}${ctaLabel && ctaUrl ? `\n\n${ctaLabel}: ${ctaUrl}` : ""}\n\nAbonelikten çık: ${unsubscribeUrl}\n\nFalconMailing\n${appUrl}`,
    html: `<!doctype html>
<html lang="tr">
  <body style="margin:0;background:#f7f4ee;font-family:Arial,sans-serif;color:#102a43">
    <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(previewText || "")}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f4ee;padding:32px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fffdf9;border:1px solid #d9e2ec">
          <tr><td style="padding:36px">
            <p style="margin:0 0 28px;font-size:22px;font-weight:700">Falcon<span style="color:#f97316">Mailing</span></p>
            <p style="margin:0 0 18px;color:#52606d">${escapeHtml(greeting)}</p>
            <h1 style="margin:0 0 22px;font-size:30px;line-height:1.2">${escapeHtml(heading)}</h1>
            ${paragraphs(content)}
            ${cta}
            <hr style="margin:34px 0;border:0;border-top:1px solid #d9e2ec">
            <p style="margin:0;color:#7b8794;font-size:12px;line-height:1.65">
              ${footerReason}
              <a href="${unsubscribeUrl}" style="color:#c2410c">Abonelikten çıkın</a>.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  return result.messageId;
}
