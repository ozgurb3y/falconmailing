import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | undefined;

function getTransporter() {
  const host = process.env.SES_SMTP_HOST;
  const username = process.env.SES_SMTP_USERNAME;
  const password = process.env.SES_SMTP_PASSWORD;

  if (!host || !username || !password) {
    throw new Error("Amazon SES SMTP credentials are not configured.");
  }

  transporter ??= nodemailer.createTransport({
    host,
    port: Number(process.env.SES_SMTP_PORT || 587),
    secure: false,
    requireTLS: true,
    auth: { user: username, pass: password },
  });

  return transporter;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendVerificationEmail({
  email,
  name,
  token,
}: {
  email: string;
  name?: string | null;
  token: string;
}) {
  const appUrl = process.env.APP_URL || "https://falconmailing.com";
  const verificationUrl = `${appUrl}/verify?token=${encodeURIComponent(token)}`;
  const displayName = name?.trim() ? ` ${escapeHtml(name.trim())}` : "";
  const fromAddress =
    process.env.MAIL_FROM_ADDRESS || "duyuru@send.falconmailing.com";
  const fromName = process.env.MAIL_FROM_NAME || "FalconMailing";

  await getTransporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: email,
    subject: "FalconMailing aboneliğinizi doğrulayın",
    text: `Merhaba${name?.trim() ? ` ${name.trim()}` : ""},\n\nFalconMailing kampanya ve duyuru aboneliğinizi doğrulamak için aşağıdaki bağlantıyı açın ve onay düğmesine basın:\n\n${verificationUrl}\n\nBu talebi siz oluşturmadıysanız herhangi bir işlem yapmayın. Bağlantı 24 saat geçerlidir.\n\nFalconMailing\n${appUrl}`,
    html: `<!doctype html>
<html lang="tr">
  <body style="margin:0;background:#f7f4ee;font-family:Arial,sans-serif;color:#102a43">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f4ee;padding:32px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fffdf9;border:1px solid #d9e2ec">
          <tr><td style="padding:34px">
            <p style="margin:0 0 24px;font-size:22px;font-weight:700">Falcon<span style="color:#f97316">Mailing</span></p>
            <h1 style="margin:0 0 18px;font-size:30px;line-height:1.15">Aboneliğinizi doğrulayın</h1>
            <p style="margin:0 0 24px;line-height:1.7">Merhaba${displayName}, kampanya ve duyuru aboneliğinizi tamamlamak için bağlantıyı açıp onay düğmesine basın.</p>
            <p style="margin:0 0 26px">
              <a href="${verificationUrl}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:5px">E-posta adresimi doğrula</a>
            </p>
            <p style="margin:0;color:#52606d;font-size:13px;line-height:1.6">Bu talebi siz oluşturmadıysanız herhangi bir işlem yapmayın. Bağlantı 24 saat geçerlidir.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  });
}

