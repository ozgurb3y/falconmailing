import type { Metadata } from "next";
import { PageShell } from "../site";

export const metadata: Metadata = {
  title: "İletişim",
  description:
    "FalconMailing destek, veri talebi, abonelik ve istenmeyen ileti bildirim kanalları.",
  alternates: { canonical: "/iletisim" },
};

const contacts = [
  {
    label: "Genel destek",
    title: "Ürün ve süreç soruları",
    detail: "Kurulum, izin modeli ve genel talepler.",
    subject: "Genel Destek Talebi",
  },
  {
    label: "Abonelik",
    title: "Tercih ve iptal işlemleri",
    detail: "Abonelik durumu veya iptal bağlantısı sorunları.",
    subject: "Abonelik Talebi",
  },
  {
    label: "Veri talebi",
    title: "KVKK kapsamındaki talepler",
    detail: "Erişim, düzeltme, silme veya bilgi talepleri.",
    subject: "Kişisel Veri Talebi",
  },
  {
    label: "Kötüye kullanım",
    title: "Spam ve şikâyet bildirimi",
    detail: "İstenmeyen ileti veya kötüye kullanım bildirimleri.",
    subject: "İstenmeyen İleti Bildirimi",
  },
];

export default function ContactPage() {
  return (
    <PageShell
      eyebrow="İletişim"
      title="Doğrudan bize ulaşın."
      intro="Abonelik tercihi, veri talebi, izin kaydı veya istenmeyen ileti bildirimi için doğru kanalı seçin."
      note="Destek talepleri support@falconmailing.com adresi üzerinden alınır."
    >
      <h2>İletişim kanalları</h2>
      <p>
        Talebinizin konusunu belirterek bize e-posta gönderebilirsiniz. Kişisel
        veri veya abonelik taleplerinde, hesabınızı bulabilmemiz için ilgili
        e-posta adresini belirtin; parola veya hassas kimlik bilgisi göndermeyin.
      </p>

      <div className="contact-grid">
        {contacts.map((contact) => (
          <div className="contact-card" key={contact.label}>
            <span>{contact.label}</span>
            <strong>{contact.title}</strong>
            <p>{contact.detail}</p>
            <p>
              <a
                href={`mailto:support@falconmailing.com?subject=${encodeURIComponent(
                  contact.subject,
                )}`}
              >
                E-posta gönder ↗
              </a>
            </p>
          </div>
        ))}
      </div>

      <h2>Yanıt ve doğrulama</h2>
      <p>
        Talepler konu ve kapsamına göre incelenir. Başkasına ait veriler üzerinde
        işlem yapılmasını önlemek amacıyla ek doğrulama isteyebiliriz. Kimlik
        kopyası gibi yüksek riskli belgeleri talep edilmedikçe e-postayla
        göndermeyin.
      </p>

      <h2>İstenmeyen ileti bildirimi</h2>
      <p>
        FalconMailing üzerinden gönderildiğini düşündüğünüz istenmeyen bir
        e-postayı incelenmesi için iletebilirsiniz. Mümkünse iletinin tam
        başlıklarını ve alındığı tarihi ekleyin. Bildirim, ilgili adresin
        gönderimden çıkarılması ve olayın araştırılması için kullanılır.
      </p>

      <div className="legal-callout">
        <p>
          <strong>Önemli:</strong> support@falconmailing.com adresinin üretim
          öncesinde gerçek bir posta kutusuna veya güvenli yönlendirmeye
          bağlanması gerekir. DNS’teki mevcut MX kayıtları kontrol edilmeden
          değiştirilmemelidir.
        </p>
      </div>
    </PageShell>
  );
}
