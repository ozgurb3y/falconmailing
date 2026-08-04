"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: data.get("password") }),
    });
    const result = (await response.json()) as { message?: string };
    if (!response.ok) {
      setMessage(result.message || "Giriş başarısız.");
      setLoading(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        <span>Yönetici parolası</span>
        <input
          autoComplete="current-password"
          minLength={8}
          name="password"
          required
          type="password"
        />
      </label>
      <button className="admin-primary" disabled={loading} type="submit">
        {loading ? "Giriş yapılıyor…" : "Giriş yap"}
      </button>
      {message ? <p className="admin-error">{message}</p> : null}
    </form>
  );
}

export function AdminLogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }
  return (
    <button className="admin-ghost" onClick={logout} type="button">
      Çıkış yap
    </button>
  );
}

type InternalRecipient = { email: string; name: string | null };

function parseRecipientToken(token: string): InternalRecipient {
  const angled = token.match(/^(.+?)\s*<([^>]+)>$/);
  if (angled) {
    const email = angled[2].trim();
    return { name: angled[1].trim() || null, email };
  }

  return { email: token.trim(), name: null };
}

function parseInternalRecipients(value: string) {
  const recipients: InternalRecipient[] = [];

  value.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim().replace(/[;,]\s*$/, "");
    if (!line) return;

    const angleCount = (line.match(/</g) || []).length;
    const tokens = angleCount === 1 && /^(.+?)\s*<([^>]+)>$/.test(line)
      ? [line]
      : line.split(/[;,]/).map((token) => token.trim()).filter(Boolean);

    tokens.forEach((token) => {
      const recipient = parseRecipientToken(token);
      if (recipient.email) recipients.push(recipient);
    });
  });

  return {
    recipients: Array.from(
      new Map(
        recipients.map((recipient) => [recipient.email.toLowerCase(), recipient]),
      ).values(),
    ),
  };
}

type DeliveryStats = {
  campaignId: string | null;
  subject: string | null;
  status: string;
  requested: number;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  delayed: number;
  rejected: number;
  failed: number;
  skipped: number;
  monthlySent: number;
  monthlyDelivered: number;
  quotaMax: number;
  quotaSent: number;
  quotaRemaining: number;
  quotaMaxSendRate: number | null;
  quotaSource: "aws" | "configured" | "estimated";
  updatedAt: string | null;
};

const emptyDeliveryStats: DeliveryStats = {
  campaignId: null,
  subject: null,
  status: "idle",
  requested: 0,
  sent: 0,
  delivered: 0,
  bounced: 0,
  complained: 0,
  delayed: 0,
  rejected: 0,
  failed: 0,
  skipped: 0,
  monthlySent: 0,
  monthlyDelivered: 0,
  quotaMax: 10_000,
  quotaSent: 0,
  quotaRemaining: 10_000,
  quotaMaxSendRate: null,
  quotaSource: "configured",
  updatedAt: null,
};

function deliveryStatusLabel(status: string) {
  return (
    {
      idle: "Bekliyor",
      draft: "Hazır",
      sending: "Gönderiliyor",
      paused: "Duraklatıldı",
      completed: "Tamamlandı",
      cancelled: "İptal edildi",
    }[status] || status
  );
}

export function DeliveryMonitor() {
  const [stats, setStats] = useState<DeliveryStats>(emptyDeliveryStats);
  const [error, setError] = useState("");
  const [workflowHealth, setWorkflowHealth] = useState<
    "checking" | "healthy" | "unhealthy"
  >("checking");

  useEffect(() => {
    let mounted = true;
    async function checkWorkflowHealth() {
      try {
        const response = await fetch("/api/admin/workflow-health", {
          cache: "no-store",
        });
        const result = (await response.json()) as { healthy?: boolean };
        if (mounted) {
          setWorkflowHealth(response.ok && result.healthy ? "healthy" : "unhealthy");
        }
      } catch {
        if (mounted) setWorkflowHealth("unhealthy");
      }
    }
    void checkWorkflowHealth();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;

    async function refresh() {
      let nextRefreshMs = 15_000;
      try {
        const response = await fetch("/api/admin/delivery-stats", {
          cache: "no-store",
        });
        const result = (await response.json()) as DeliveryStats & {
          message?: string;
        };
        if (!response.ok) {
          throw new Error(result.message || "İstatistikler alınamadı.");
        }
        if (mounted) {
          setStats(result);
          setError("");
          nextRefreshMs = result.status === "sending" ? 5_000 : 30_000;
        }
      } catch (refreshError) {
        if (mounted) {
          setError(
            refreshError instanceof Error
              ? refreshError.message
              : "İstatistikler alınamadı.",
          );
        }
      } finally {
        if (mounted) {
          timer = window.setTimeout(() => void refresh(), nextRefreshMs);
        }
      }
    }

    void refresh();
    return () => {
      mounted = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  const failedTotal = stats.failed + stats.skipped;
  const processing = Math.max(
    stats.requested - stats.sent - failedTotal,
    0,
  );
  const progress =
    stats.requested > 0
      ? Math.min(
          100,
          Math.round(((stats.sent + failedTotal) / stats.requested) * 100),
        )
      : 0;
  const quotaPercent =
    stats.quotaMax > 0
      ? Math.min(100, Math.round((stats.quotaSent / stats.quotaMax) * 100))
      : 0;

  return (
    <section className="delivery-monitor" aria-live="polite">
      <div className="delivery-monitor-heading">
        <div>
          <p className="admin-kicker">Canlı takip</p>
          <h2>İşlemde olan gönderim durumu</h2>
        </div>
        <span className={`status status-${stats.status}`}>
          {deliveryStatusLabel(stats.status)}
        </span>
      </div>
      {stats.subject ? <p className="delivery-subject">{stats.subject}</p> : null}
      <p className={workflowHealth === "unhealthy" ? "admin-error" : "admin-success"}>
        {workflowHealth === "checking"
          ? "Arka plan gönderim altyapısı kontrol ediliyor…"
          : workflowHealth === "healthy"
            ? "Arka plan gönderimi hazır · Sayfa kapansa da devam eder."
            : "Arka plan gönderim altyapısı şu anda doğrulanamadı."}
      </p>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Gönderim ilerlemesi"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="delivery-counts">
        <div>
          <span>Gönderilen</span>
          <strong>{stats.sent.toLocaleString("tr-TR")}</strong>
        </div>
        <div>
          <span>İşlemde olan</span>
          <strong>{processing.toLocaleString("tr-TR")}</strong>
        </div>
        <div>
          <span>Başarısız</span>
          <strong>{failedTotal.toLocaleString("tr-TR")}</strong>
        </div>
      </div>
      <div className="ses-quota-card">
        <div className="ses-quota-heading">
          <div>
            <span>SES günlük kota · Son 24 saat</span>
            <strong>
              {stats.quotaSent.toLocaleString("tr-TR")} /{" "}
              {stats.quotaMax < 0
                ? "Sınırsız"
                : stats.quotaMax.toLocaleString("tr-TR")}
            </strong>
          </div>
          <div>
            <span>Kalan gönderim hakkı</span>
            <strong>
              {stats.quotaRemaining < 0
                ? "Sınırsız"
                : stats.quotaRemaining.toLocaleString("tr-TR")}
            </strong>
          </div>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="SES günlük kota kullanımı"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={quotaPercent}
        >
          <span style={{ width: `${quotaPercent}%` }} />
        </div>
        <small>
          {stats.quotaSource === "aws"
            ? `AWS canlı kota${stats.quotaMaxSendRate ? ` · Saniyede ${stats.quotaMaxSendRate.toLocaleString("tr-TR")} e-posta` : ""}`
            : stats.quotaSource === "estimated"
              ? "Tahmini kota · AWS API anahtarı eklendiğinde kesin değer gösterilir"
              : "Yapılandırılmış kota · SES_DAILY_QUOTA"}
        </small>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
    </section>
  );
}

export function CampaignCreateForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [htmlContent, setHtmlContent] = useState("");
  const [recipientLineCount, setRecipientLineCount] = useState(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const parsedRecipients = parseInternalRecipients(
      String(data.get("internalRecipients") || ""),
    );
    const internalRecipients = parsedRecipients.recipients;
    if (internalRecipients.length === 0) {
      setMessage("En az bir e-posta kaydı girin.");
      setLoading(false);
      return;
    }
    const subject = String(data.get("subject") || "");
    let result: { id?: string; message?: string };
    try {
      const response = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: subject,
          subject,
          previewText: null,
          heading: null,
          content: null,
          contentMode: "html",
          htmlContent,
          audienceType: "internal",
          internalRecipients,
          internalAuthorized: true,
          ctaLabel: null,
          ctaUrl: null,
        }),
      });
      result = (await response.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
      };
      if (!response.ok || !result.id) {
        setMessage(
          result.message ||
            "Kampanya oluşturulamadı. Sunucu yanıtını kontrol edip tekrar deneyin.",
        );
        setLoading(false);
        return;
      }
    } catch {
      setMessage(
        "Kampanya oluşturma bağlantısı kesildi. Liste korunuyor; tekrar deneyin.",
      );
      setLoading(false);
      return;
    }

    try {
      const sendResponse = await fetch(
        `/api/admin/campaigns/${result.id}/send`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "send" }),
        },
      );
      const delivery = (await sendResponse.json()) as DeliveryState & {
        message?: string;
      };
      if (!sendResponse.ok) {
        throw new Error(delivery.message || "Gönderim başlatılamadı.");
      }

      form.reset();
      setHtmlContent("");
      setRecipientLineCount(0);
      router.push(`/admin/campaigns/${result.id}`);
      router.refresh();
      return;
    } catch (sendError) {
      setMessage(
        sendError instanceof Error
          ? sendError.message
          : "Gönderim başlatılamadı.",
      );
    }

    setLoading(false);
    router.refresh();
  }

  return (
    <form className="campaign-form" onSubmit={submit}>
      <div className="instant-recipient-box">
        <label>
          <span className="recipient-label">
            Gönderilecek e-posta adresleri
            <strong>{recipientLineCount.toLocaleString("tr-TR")}</strong>
          </span>
          <textarea
            name="internalRecipients"
            required
            rows={9}
            onChange={(event) =>
              setRecipientLineCount(
                parseInternalRecipients(event.target.value).recipients.length,
              )
            }
          />
          <small>
            Her satıra bir adres yazın. Virgül veya noktalı virgülle ayrılmış
            adresler ile Ad Soyad &lt;mail@adres.com&gt; biçimi de kabul edilir.
            Hatalı adresler gönderimi durdurmaz; başarısız olarak işaretlenir.
          </small>
        </label>
      </div>
      <label>
        <span>E-posta konusu</span>
        <input name="subject" required maxLength={120} />
      </label>
      <div className="html-editor-grid">
        <label>
          <span>HTML içeriği</span>
          <textarea
            className="html-code-editor"
            name="htmlContent"
            required
            minLength={10}
            maxLength={500000}
            rows={24}
            spellCheck={false}
            value={htmlContent}
            onChange={(event) => setHtmlContent(event.target.value)}
          />
        </label>
        <div className="html-preview-panel">
          <span>Canlı ön izleme</span>
          <iframe
            className="html-preview-frame"
            sandbox=""
            srcDoc={htmlContent}
            title="HTML e-posta canlı ön izlemesi"
          />
        </div>
      </div>
      <button className="admin-primary" disabled={loading} type="submit">
        Gönder
      </button>
      {message ? <p className="admin-error">{message}</p> : null}
    </form>
  );
}

type DeliveryState = {
  status: string;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  remaining: number;
  quota_waiting?: boolean;
};

export function CampaignSender({
  campaignId,
  initial,
}: {
  campaignId: string;
  initial: DeliveryState;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;
    async function refresh() {
      try {
        const response = await fetch(`/api/admin/campaigns/${campaignId}/send`, {
          cache: "no-store",
        });
        const result = (await response.json()) as DeliveryState;
        if (response.ok && mounted) setState(result);
      } finally {
        if (mounted) timer = window.setTimeout(() => void refresh(), 5_000);
      }
    }
    void refresh();
    return () => {
      mounted = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [campaignId]);

  async function action(actionName: "send" | "pause" | "resume" | "cancel") {
    const response = await fetch(
      `/api/admin/campaigns/${campaignId}/send`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: actionName }),
      },
    );
    const result = (await response.json()) as DeliveryState & {
      message?: string;
    };
    if (!response.ok) {
      throw new Error(result.message || "İşlem tamamlanamadı.");
    }
    setState(result);
    router.refresh();
    return result;
  }

  async function run() {
    setRunning(true);
    setMessage("");
    try {
      await action("send");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gönderim durdu.");
    } finally {
      setRunning(false);
    }
  }

  async function pause() {
    setRunning(false);
    setState(await action("pause"));
  }

  const processed =
    Number(state.sent_count) +
    Number(state.failed_count) +
    Number(state.skipped_count);
  const total = processed + Number(state.remaining);
  const percent = total ? Math.round((processed / total) * 100) : 100;
  const failedTotal =
    Number(state.failed_count) + Number(state.skipped_count);

  return (
    <section className="send-control">
      <div className="progress-track" aria-label={`İlerleme yüzde ${percent}`}>
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className="send-stats">
        <span><strong>{state.sent_count}</strong> gönderildi</span>
        <span><strong>{state.remaining}</strong> işlemde olan</span>
        <span><strong>{failedTotal}</strong> başarısız</span>
      </div>

      <div className="send-actions">
        {state.status === "draft" || state.status === "sending" ? (
          <>
            {state.status === "sending" && state.quota_waiting ? (
              <span className="admin-success">
                SES günlük kotası bekleniyor · 15 dakikada bir otomatik denenecek.
              </span>
            ) : (
              <button
                className="admin-danger"
                disabled={running || Number(state.remaining) === 0}
                onClick={run}
                type="button"
              >
                {running ? "Gönderiliyor…" : state.status === "draft" ? "Gönderimi başlat" : "Gönderime devam et"}
              </button>
            )}
            {state.status === "sending" ? (
              <button className="admin-ghost" onClick={pause} type="button">
                Duraklat
              </button>
            ) : null}
          </>
        ) : null}
        {state.status === "paused" ? (
          <button
            className="admin-primary"
            onClick={async () => {
              await action("resume");
              await run();
            }}
            type="button"
          >
            Devam ettir
          </button>
        ) : null}
        {state.status === "completed" ? (
          <span className="admin-success">Gönderim tamamlandı.</span>
        ) : null}
      </div>
      {message ? <p className="admin-error">{message}</p> : null}
      <p className="send-hint">
        Gönderim güvenli gruplar halinde sunucuda ilerler. Sayfayı kapatmanız,
        oturumun sona ermesi veya bilgisayarın kapanması kampanyayı durdurmaz.
      </p>
    </section>
  );
}
