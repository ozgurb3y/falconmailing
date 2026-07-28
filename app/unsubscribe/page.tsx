import type { Metadata } from "next";
import { UnsubscribeForm } from "../components/unsubscribe-form";
import { PageShell } from "../site";

export const metadata: Metadata = {
  title: "Abonelikten Çık",
  description:
    "FalconMailing pazarlama e-postaları için abonelikten çıkma ve izin geri çekme bilgileri.",
  alternates: { canonical: "/unsubscribe" },
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <PageShell
      eyebrow="İletişim tercihleri"
      title="Tercihiniz sizin kontrolünüzde."
      intro="Pazarlama e-postalarımızı almak istemediğinizde izninizi kolayca geri çekebilirsiniz."
      note="Kişiye özel bağlantılar e-posta adresinizi açıkça paylaşmadan tercihinizi uygular."
    >
      <h2>Abonelikten nasıl çıkılır?</h2>
      <p>
        FalconMailing üzerinden gönderilen her pazarlama e-postasında kişiye
        özel bir abonelikten çıkma bağlantısı bulunacaktır. Bu bağlantı,
        adresinizi açık şekilde yayımlamadan tercihinizi güvenli bir token ile
        tanıyacak ve tek işlemle iptal edecektir.
      </p>

      <ol>
        <li>E-postanın alt bölümündeki “Abonelikten çık” bağlantısını açın.</li>
        <li>Maskelenmiş e-posta adresinizin doğru olduğunu kontrol edin.</li>
        <li>İptal işlemini onaylayın.</li>
        <li>Başarılı işlem mesajını gördüğünüzde tercihiniz kaydedilmiş olur.</li>
      </ol>

      <div className="form-box">
        <h2>Aboneliği sonlandır</h2>
        <p>
          E-postanızdaki kişiye özel bağlantıyla geldiyseniz aşağıdaki düğme
          pazarlama izninizi hemen pasifleştirir.
        </p>
        <UnsubscribeForm token={token} />
      </div>

      <h2>Tekrar e-posta alır mıyım?</h2>
      <p>
        Geçerli iptal talebi sonrasında aynı izin kapsamında yeniden pazarlama
        e-postası gönderilmez. Gelecekte yeniden abone olmak isterseniz yeni ve
        açık bir izin vermeniz gerekir. Yasal veya işlemsel bildirimler,
        pazarlama tercihinden ayrı bir dayanağa sahip olabilir.
      </p>

      <h2>Bağlantı çalışmıyorsa</h2>
      <p>
        E-postadaki bağlantı açılmıyorsa veya yanlış adres gösteriyorsa{" "}
        <a href="mailto:support@falconmailing.com?subject=Abonelik%20Bağlantısı%20Sorunu">
          support@falconmailing.com
        </a>{" "}
        adresine iletinin tarihini belirterek yazabilirsiniz.
      </p>
      <p>
        Manuel talep için kayıtlı e-posta adresinizden{" "}
        <a href="mailto:support@falconmailing.com?subject=Abonelikten%20Çıkma%20Talebi">
          support@falconmailing.com
        </a>{" "}
        adresine yazabilirsiniz.
      </p>
    </PageShell>
  );
}
