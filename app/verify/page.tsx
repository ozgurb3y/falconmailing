import type { Metadata } from "next";
import { VerifyForm } from "../components/verify-form";
import { PageShell } from "../site";

export const metadata: Metadata = {
  title: "Aboneliği Doğrula",
  description: "FalconMailing e-posta aboneliği doğrulama sayfası.",
  robots: { index: false, follow: false },
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <PageShell
      eyebrow="Double opt-in"
      title="Aboneliğinizi doğrulayın."
      intro="E-posta bağlantı tarayıcılarının sizin yerinize izin vermesini önlemek için son onayı bu sayfada siz tamamlarsınız."
      note="Doğrulama tamamlanmadan adresiniz pazarlama listesine eklenmez."
    >
      <div className="form-box">
        <h2>Son adım</h2>
        <p>
          FalconMailing kampanya, ürün duyurusu ve bilgilendirme e-postalarını
          almak istiyorsanız aşağıdaki düğmeye basın.
        </p>
        {token ? (
          <VerifyForm token={token} />
        ) : (
          <p className="form-message is-error">
            Doğrulama bağlantısı eksik veya geçersiz.
          </p>
        )}
      </div>
    </PageShell>
  );
}

