"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type FormState = "idle" | "submitting" | "success" | "error";

export function SubscriptionForm() {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          marketingConsent: formData.get("marketingConsent") === "on",
          company: formData.get("company"),
        }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message || "Talebiniz şu anda alınamadı.");
      }

      form.reset();
      setState("success");
      setMessage(
        result.message ||
          "Doğrulama e-postası gönderildi. Aboneliği tamamlamak için gelen kutunuzu kontrol edin.",
      );
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Talebiniz şu anda alınamadı. Lütfen daha sonra tekrar deneyin.",
      );
    }
  }

  return (
    <form className="subscription-form" onSubmit={submit} noValidate>
      <div className="form-row">
        <label>
          <span>Adınız <small>(isteğe bağlı)</small></span>
          <input
            autoComplete="name"
            maxLength={100}
            name="name"
            placeholder="Adınız"
            type="text"
          />
        </label>
        <label>
          <span>E-posta adresiniz</span>
          <input
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            name="email"
            placeholder="ornek@eposta.com"
            required
            type="email"
          />
        </label>
      </div>

      <label className="honeypot" aria-hidden="true">
        Şirket
        <input autoComplete="off" name="company" tabIndex={-1} type="text" />
      </label>

      <label className="consent-control">
        <input name="marketingConsent" required type="checkbox" />
        <span>
          FalconMailing&apos;in kampanya, ürün duyurusu ve bilgilendirme
          e-postalarını göndermesine izin veriyorum. İznimi dilediğim zaman geri
          çekebileceğimi biliyorum.
        </span>
      </label>

      <p className="form-legal">
        Abone olarak{" "}
        <Link href="/ticari-ileti-ve-izin">Ticari İleti ve İzin Politikası</Link>{" "}
        ile <Link href="/gizlilik">Gizlilik Politikası</Link>&apos;nı
        okuduğunuzu kabul edersiniz. Onay kutusu önceden işaretlenmez.
      </p>

      <button
        className="button button-primary"
        disabled={state === "submitting"}
        type="submit"
      >
        {state === "submitting" ? "Gönderiliyor…" : "Doğrulama e-postası gönder"}
      </button>

      {message ? (
        <p
          className={`form-message ${state === "error" ? "is-error" : "is-success"}`}
          role={state === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}

