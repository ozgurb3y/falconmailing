import type { Metadata } from "next";
import { PageShell } from "../site";

export const metadata: Metadata = {
  title: "Abonelikten Çık",
  description:
    "FalconMailing pazarlama e-postaları için abonelikten çıkma ve izin geri çekme bilgileri.",
  alternates: { canonical: "/unsubscribe" },
  robots: { index: false, follow: false },
};

export default function UnsubscribePage() {
  return (
    <PageShell
      eyebrow="İletişim tercihleri"
      title="Tercihiniz sizin kontrolünüzde."
      intro="Pazarlama e-postalarımızı almak istemediğinizde izninizi kolayca geri çekebilirsiniz."
      note="Gönderim başlamadan önce token tabanlı tek tıklama akışı teknik olarak devreye alınacaktır."
    >
      <h2>Abonelikten nasıl çıkılır?</h2>
      <p>
        FalconMailing üzerinden gönderilecek her pazarlama e-postasında kişiye
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

      <h2>Gönderimler henüz başlamadı</h2>
      <p>
        FalconMailing şu anda üretim öncesi kurulum aşamasındadır ve gerçek
        kullanıcılara pazarlama gönderimi yapılmamaktadır. Bu nedenle henüz
        işlenebilecek aktif bir e-posta tokenı bulunmamaktadır. Gönderim sistemi
        devreye alınmadan önce bu sayfanın güvenli, idempotent ve token tabanlı
        işlem akışı tamamlanacaktır.
      </p>

      <div className="form-box">
        <h2>Manuel iptal talebi</h2>
        <p>
          Bir abonelik kaydınız olduğunu düşünüyorsanız veya izninizi şimdiden
          geri çekmek istiyorsanız, kayıtlı e-posta adresinizden bize ulaşın.
        </p>
        <a
          className="button button-primary"
          href="mailto:support@falconmailing.com?subject=Abonelikten%20Çıkma%20Talebi"
        >
          İptal talebi gönder
        </a>
        <p className="notice">
          Talebiniz doğrulandığında adresiniz pazarlama iletişimi için pasif
          hâle getirilecek ve yeniden gönderimi önleyen suppression kaydı
          oluşturulacaktır.
        </p>
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
    </PageShell>
  );
}
