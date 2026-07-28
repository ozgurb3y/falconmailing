"use client";

import { FormEvent, useState } from "react";

export function VerifyForm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function verify(event: FormEvent) {
    event.preventDefault();
    setState("submitting");

    try {
      const response = await fetch("/api/subscriptions/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message || "Doğrulama tamamlanamadı.");
      }

      setState("success");
      setMessage("E-posta adresiniz doğrulandı ve aboneliğiniz etkinleştirildi.");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Doğrulama tamamlanamadı. Yeni bir bağlantı isteyebilirsiniz.",
      );
    }
  }

  if (state === "success") {
    return <p className="form-message is-success">{message}</p>;
  }

  return (
    <form onSubmit={verify}>
      <button
        className="button button-primary"
        disabled={!token || state === "submitting"}
        type="submit"
      >
        {state === "submitting" ? "Doğrulanıyor…" : "Aboneliğimi doğrula"}
      </button>
      {message ? (
        <p className="form-message is-error" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}

