import type { Metadata } from "next";
import { PageShell } from "../site";

export const metadata: Metadata = {
  title: "Ticari İleti ve İzin Politikası",
  description:
    "FalconMailing iletişim izni, abonelikten çıkma ve suppression süreçleri.",
  alternates: { canonical: "/ticari-ileti-ve-izin" },
};

export default function ConsentPolicyPage() {
  return (
    <PageShell
      eyebrow="İzin ve güvenlik"
      title="Ticari İleti ve İzin Politikası"
      intro="Kiminle, hangi dayanakla ve ne zamana kadar iletişim kurduğumuzun açık olmasını sağlayan temel gönderim kurallarımız."
      note="İzin yoksa pazarlama gönderimi yoktur."
    >
      <h2>1. Temel ilkemiz</h2>
      <p>
        FalconMailing yalnızca açıkça izin vermiş alıcılara bilgilendirme ve
        pazarlama e-postaları göndermek üzere tasarlanır. Satın alınmış,
        kiralanmış, internetten toplanmış veya izin kaynağı kanıtlanamayan
        listeler kullanılmaz.
      </p>

      <h2>2. İletişim izni nasıl alınır?</h2>
      <p>
        İzin, kullanıcının neye onay verdiğini anlayabileceği açık bir metin ve
        önceden işaretlenmemiş bir onay kutusu aracılığıyla alınır. Hizmet
        devreye alındığında double opt-in yöntemi kullanılması planlanmaktadır:
        formu dolduran kişi, e-posta adresine gelen doğrulama bağlantısını
        onaylamadan aktif pazarlama listesine eklenmez.
      </p>

      <h2>3. Hangi bilgiler kaydedilir?</h2>
      <ul>
        <li>E-posta adresi ve isteğe bağlı ad,</li>
        <li>İznin tarihi, türü ve kaynağı,</li>
        <li>Gösterilen izin ve gizlilik metninin sürümü,</li>
        <li>Doğrulama zamanı ve durumu,</li>
        <li>İzin kanıtı için gerekli sınırlı IP ve user-agent bilgileri,</li>
        <li>İzin geri çekildiyse iptal tarihi.</li>
      </ul>

      <h2>4. İzin vermeyen kişiler</h2>
      <p>
        Pazarlama izni vermemiş kişiler aktif kampanya hedefi olamaz. İletişim
        formu üzerinden destek talebi göndermek, tek başına pazarlama izni
        anlamına gelmez. Hizmet veya işlem için zorunlu bildirimler varsa bunlar,
        pazarlama iletişiminden ayrı değerlendirilir.
      </p>

      <h2>5. Abonelikten çıkma</h2>
      <p>
        Her pazarlama e-postasında görünür bir abonelikten çıkma bağlantısı yer
        alması planlanır. Geçerli iptal talebi alındığında pazarlama izni
        pasifleştirilir ve adres suppression listesine alınır. Teknik işlemin
        mümkün olan en kısa sürede ve en geç uygulanabilir yasal süre içinde
        tamamlanması hedeflenir.
      </p>
      <p>
        Abonelikten çıkmak için e-postadaki kişiye özel bağlantıyı kullanabilir
        veya support@falconmailing.com adresine talep gönderebilirsiniz.
      </p>

      <h2>6. Bounce ve spam şikâyetleri</h2>
      <p>
        Hard bounce veya spam complaint olayı alınan adreslerin otomatik olarak
        suppression listesine eklenmesi planlanır. Bu adreslere yeniden
        pazarlama gönderimi yapılmaz. Sürekli soft bounce üreten adresler de
        kontrollü bir eşik sonrasında engellenebilir.
      </p>

      <h2>7. Gönderim kalitesi</h2>
      <p>
        Gönderim alan adı için SPF, DKIM ve DMARC gibi kimlik doğrulama
        mekanizmaları kullanılır. Bounce ve complaint oranları izlenir; gönderim
        hacmi doğrulanmış abone tabanı büyüdükçe kademeli olarak artırılır.
        Uygulanmamış bir kontrol, devredeymiş gibi beyan edilmez.
      </p>

      <h2>8. İYS ve KVKK yaklaşımı</h2>
      <p>
        Türkiye’deki ticari elektronik ileti ve kişisel veri koruma kuralları
        süreç tasarımında dikkate alınır. Faaliyetin niteliğine göre İleti
        Yönetim Sistemi (İYS) yükümlülüğü doğması hâlinde gerekli kayıt ve
        bildirim süreçleri ayrıca uygulanır. KVKK kapsamındaki talepler için
        gizlilik politikamızdaki iletişim kanalı kullanılabilir.
      </p>

      <h2>9. Şikâyet ve kötüye kullanım bildirimi</h2>
      <p>
        FalconMailing kaynaklı olduğunu düşündüğünüz istenmeyen bir iletiyi,
        ileti başlıklarıyla birlikte{" "}
        <a href="mailto:support@falconmailing.com?subject=İstenmeyen%20İleti%20Bildirimi">
          support@falconmailing.com
        </a>{" "}
        adresine bildirebilirsiniz. Bildirim incelenirken ilgili adrese yeniden
        gönderim yapılmaması için önlem alınır.
      </p>
    </PageShell>
  );
}
