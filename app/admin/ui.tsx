"use client";

import { FormEvent, useState } from "react";
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

export function CampaignCreateForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch("/api/admin/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        subject: data.get("subject"),
        previewText: data.get("previewText"),
        heading: data.get("heading"),
        content: data.get("content"),
        audienceType: data.get("audienceType"),
        ctaLabel: data.get("ctaLabel"),
        ctaUrl: data.get("ctaUrl"),
      }),
    });
    const result = (await response.json()) as {
      id?: string;
      message?: string;
    };
    if (!response.ok || !result.id) {
      setMessage(result.message || "Kampanya oluşturulamadı.");
      setLoading(false);
      return;
    }
    router.push(`/admin/campaigns/${result.id}`);
    router.refresh();
  }

  return (
    <form className="campaign-form" onSubmit={submit}>
      <label>
        <span>Alıcı grubu</span>
        <select name="audienceType" required defaultValue="internal">
          <option value="internal">Şirket içi liste</option>
          <option value="marketing">İzinli pazarlama aboneleri</option>
        </select>
      </label>
      <div className="admin-field-grid">
        <label>
          <span>Kampanya adı</span>
          <input name="name" required maxLength={120} />
        </label>
        <label>
          <span>E-posta konusu</span>
          <input name="subject" required maxLength={180} />
        </label>
      </div>
      <label>
        <span>Ön izleme metni</span>
        <input name="previewText" maxLength={220} />
      </label>
      <label>
        <span>E-posta başlığı</span>
        <input name="heading" required maxLength={180} />
      </label>
      <label>
        <span>İçerik</span>
        <textarea
          name="content"
          required
          minLength={10}
          maxLength={20000}
          rows={10}
          placeholder="Paragrafları boş satırla ayırabilirsiniz."
        />
      </label>
      <div className="admin-field-grid">
        <label>
          <span>Buton metni (isteğe bağlı)</span>
          <input name="ctaLabel" maxLength={80} />
        </label>
        <label>
          <span>Buton bağlantısı</span>
          <input
            name="ctaUrl"
            maxLength={500}
            placeholder="https://..."
            type="url"
          />
        </label>
      </div>
      <div className="admin-notice">
        Kampanya oluşturulduğunda yalnızca o anda gönderime uygun olan kişilerin
        güvenli bir alıcı görüntüsü alınır. Gönderim sırasında uygunluk tekrar
        kontrol edilir.
      </div>
      <button className="admin-primary" disabled={loading} type="submit">
        {loading ? "Oluşturuluyor…" : "Taslağı ve alıcı listesini oluştur"}
      </button>
      {message ? <p className="admin-error">{message}</p> : null}
    </form>
  );
}

function parseInternalRecipients(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const angled = line.match(/^(.+?)\s*<([^>]+)>$/);
      if (angled) {
        return { name: angled[1].trim(), email: angled[2].trim() };
      }
      const [email, ...nameParts] = line.split(",");
      return {
        email: email.trim(),
        name: nameParts.join(",").trim() || null,
      };
    });
}

export function InternalRecipientImportForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const recipients = parseInternalRecipients(
      String(data.get("recipients") || ""),
    );
    const response = await fetch("/api/admin/internal-recipients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recipients,
        authorized: data.get("authorized") === "on",
      }),
    });
    const result = (await response.json()) as {
      processed?: number;
      active?: number;
      message?: string;
    };
    if (!response.ok) {
      setMessage(result.message || "Adresler eklenemedi.");
      setLoading(false);
      return;
    }
    form.reset();
    setMessage(
      `${result.processed || 0} adres işlendi. Aktif şirket içi liste: ${result.active || 0}.`,
    );
    setLoading(false);
    router.refresh();
  }

  return (
    <form className="campaign-form" onSubmit={submit}>
      <label>
        <span>Çalışan adresleri — her satıra bir kişi</span>
        <textarea
          name="recipients"
          required
          rows={7}
          placeholder={
            "calisan@ornek.com, Ad Soyad\nAd Soyad <calisan2@ornek.com>"
          }
        />
      </label>
      <label className="internal-authorization">
        <input name="authorized" required type="checkbox" />
        <span>
          Bu adresleri şirket içi iletişim kapsamında kullanmaya yetkili
          olduğumu ve listeyi güncel tutacağımı beyan ediyorum.
        </span>
      </label>
      <button className="admin-primary" disabled={loading} type="submit">
        {loading ? "Ekleniyor…" : "Şirket içi listeye ekle"}
      </button>
      {message ? (
        <p
          className={
            message.includes("işlendi") ? "admin-success" : "admin-error"
          }
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}

type DeliveryState = {
  status: string;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  remaining: number;
};

export function CampaignSender({
  campaignId,
  subject,
  initial,
}: {
  campaignId: string;
  subject: string;
  initial: DeliveryState;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [confirmSubject, setConfirmSubject] = useState("");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

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
      let next = state;
      do {
        next = await action("send");
        if (next.status === "completed" || next.remaining === 0) break;
        await new Promise((resolve) => window.setTimeout(resolve, 900));
      } while (next.status === "sending");
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

  return (
    <section className="send-control">
      <div className="progress-track" aria-label={`İlerleme yüzde ${percent}`}>
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className="send-stats">
        <span><strong>{state.sent_count}</strong> gönderildi</span>
        <span><strong>{state.failed_count}</strong> başarısız</span>
        <span><strong>{state.skipped_count}</strong> atlandı</span>
        <span><strong>{state.remaining}</strong> bekliyor</span>
      </div>

      {state.status === "draft" ? (
        <label className="confirm-field">
          <span>Gönderimi açmak için e-posta konusunu aynen yazın:</span>
          <input
            onChange={(event) => setConfirmSubject(event.target.value)}
            value={confirmSubject}
          />
        </label>
      ) : null}

      <div className="send-actions">
        {state.status === "draft" || state.status === "sending" ? (
          <>
            <button
              className="admin-danger"
              disabled={
                running ||
                (state.status === "draft" && confirmSubject !== subject) ||
                Number(state.remaining) === 0
              }
              onClick={run}
              type="button"
            >
              {running ? "Gönderiliyor…" : state.status === "draft" ? "Gönderimi başlat" : "Gönderime devam et"}
            </button>
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
        Gönderim güvenli gruplar halinde ilerler. Bu sayfa kapanırsa kampanya
        durmaz fakat sıradaki gruplar için sayfaya dönüp “devam et” düğmesine
        basmanız gerekir.
      </p>
    </section>
  );
}
