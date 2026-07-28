"use client";

import { FormEvent, useState } from "react";

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function unsubscribe(event: FormEvent) {
    event.preventDefault();
    setState("submitting");

    try {
      const response = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message || "İşlem tamamlanamadı.");
      }

      setState("success");
      setMessage(
        "Pazarlama aboneliğiniz sonlandırıldı. Bu izin kapsamında yeniden e-posta gönderilmeyecek.",
      );
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "İşlem tamamlanamadı. Lütfen destek ekibimize ulaşın.",
      );
    }
  }

  if (!token) {
    return (
      <p className="notice">
        Geçerli bir abonelikten çıkma bağlantısı bulunamadı. E-postanızdaki
        kişiye özel bağlantıyı kullanın.
      </p>
    );
  }

  if (state === "success") {
    return <p className="form-message is-success">{message}</p>;
  }

  return (
    <form onSubmit={unsubscribe}>
      <button
        className="button button-primary"
        disabled={state === "submitting"}
        type="submit"
      >
        {state === "submitting" ? "İşleniyor…" : "Pazarlama aboneliğimi sonlandır"}
      </button>
      {message ? (
        <p className="form-message is-error" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}

