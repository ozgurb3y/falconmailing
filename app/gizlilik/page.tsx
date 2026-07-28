import type { Metadata } from "next";
import { PageShell } from "../site";

export const metadata: Metadata = {
  title: "Gizlilik Politikası",
  description:
    "FalconMailing kişisel veri işleme, izin kaydı ve kullanıcı hakları hakkında gizlilik politikası.",
  alternates: { canonical: "/gizlilik" },
};

export default function PrivacyPage() {
  return (
    <PageShell
      eyebrow="Politikalar"
      title="Gizlilik Politikası"
      intro="FalconMailing ile paylaşılan kişisel verilerin hangi amaçlarla ve hangi ilkeler çerçevesinde işlendiğini açıkları."
      note="Bu belge bilgilendirme amaçlı bir taslaktır ve profesyonel hukuk incelemesine açıktır."
    >
      <h2>1. Politikanın kapsamı</h2>
      <p>
        Bu politika, falconmailing.com internet sitesini ziyaret ettiğinizde,
        bizimle iletişime geçtiğinizde veya izinli e-posta iletişimine
        katıldığınızda işlenebilecek kişisel verilere ilişkin yaklaşımımızı
        açıklar. FalconMailing’in gönderim altyapısı kurulum aşamasındadır;
        yalnızca teknik olarak devreye alınmış süreçler üzerinden veri işlenir.
      </p>

      <h2>2. İşlenebilecek veriler</h2>
      <p>Hizmetin ilgili bölümünü kullandığınızda şu veriler işlenebilir:</p>
      <ul>
        <li>E-posta adresi ve isteğe bağlı ad bilgisi,</li>
        <li>İzin türü, izin tarihi, izin kaynağı ve izin metni sürümü,</li>
        <li>Double opt-in doğrulama ve abonelik durumu,</li>
        <li>Abonelikten çıkma veya izni geri çekme tarihi,</li>
        <li>
          IP adresi, user-agent, güvenlik kayıtları ve işlem zamanları gibi
          teknik veriler,
        </li>
        <li>
          Teslimat, bounce ve complaint gibi e-posta olaylarına ilişkin sınırlı
          teknik kayıtlar,
        </li>
        <li>Bizimle paylaştığınız iletişim talebi ve mesaj içeriği.</li>
      </ul>

      <h2>3. İşleme amaçları</h2>
      <p>Veriler, ilgili olduğu ölçüde aşağıdaki amaçlarla işlenebilir:</p>
      <ul>
        <li>Talep ettiğiniz bilgilendirme ve kampanya iletilerini göndermek,</li>
        <li>İletişim iznini doğrulamak ve kanıtlanabilir biçimde kaydetmek,</li>
        <li>Abonelikten çıkma ve veri sahibi taleplerini uygulamak,</li>
        <li>
          Hard bounce, spam şikâyeti ve kötüye kullanım durumlarında yeniden
          gönderimi engellemek,
        </li>
        <li>Hizmet güvenliğini, sürekliliğini ve hata takibini sağlamak,</li>
        <li>Yasal yükümlülükleri değerlendirmek ve yerine getirmek.</li>
      </ul>

      <h2>4. İzin kayıtları</h2>
      <p>
        Pazarlama amaçlı iletişim, açık bir kullanıcı tercihi bulunmadan
        başlatılmaz. İzin kaydının; tarih, kaynak, kullanılan metin sürümü ve
        mümkün olduğunda doğrulama bilgisiyle tutulması planlanır. Onay kutuları
        önceden işaretlenmez. Kullanıcı, iznini dilediği zaman geri çekebilir.
      </p>

      <h2>5. Teknik kayıtların kullanımı</h2>
      <p>
        IP adresi, user-agent ve işlem zamanı gibi veriler; iznin kaynağını
        belgelendirmek, kötüye kullanımı önlemek, hata araştırmak ve sistem
        güvenliğini sağlamak amacıyla sınırlı biçimde tutulabilir. Bu veriler,
        amaçla bağdaşmayan profilleme için kullanılmaz.
      </p>

      <h2>6. Hizmet sağlayıcılar ve aktarım</h2>
      <p>
        E-posta gönderimi için Amazon Web Services ve Amazon Simple Email
        Service (SES) kullanılması planlanmaktadır. Site barındırma, güvenlik,
        DNS ve form koruması için Cloudflare hizmetleri kullanılabilir. Bu
        sağlayıcılar verileri kendi hizmet koşulları ve güvenlik tedbirleri
        kapsamında işleyebilir. Yurt dışına veri aktarımı gerektiren süreçler,
        ilgili mevzuat ve uygun hukuki mekanizmalar gözetilerek ayrıca
        değerlendirilir.
      </p>

      <h2>7. Saklama süreleri</h2>
      <p>
        Veriler, işleme amacı ve yasal gereklilik için gerekli süreden uzun
        tutulmaz. Aktif abonelik kayıtları ilişki sürdükçe; iptal, hard bounce
        ve complaint gibi suppression kayıtları ise yeniden istenmeyen gönderimi
        önlemek ve tercihi kanıtlamak için gerekli sınırlı süre boyunca
        saklanabilir. Süre sonunda veriler silinir, anonimleştirilir veya erişimi
        sınırlandırılır.
      </p>

      <h2>8. Güvenlik</h2>
      <p>
        Erişim kontrolü, güvenli bağlantı, hassas bilgilerin ortam değişkenleri
        üzerinden yönetilmesi, kimlik doğrulama ve günlüklerin sınırlandırılması
        gibi uygun teknik ve idari tedbirler hedeflenir. İnternet üzerinden
        aktarımın mutlak güvenliği garanti edilemese de riskler düzenli olarak
        gözden geçirilir.
      </p>

      <h2>9. Haklarınız</h2>
      <p>
        Uygulanabilir mevzuat kapsamında verilerinizin işlenip işlenmediğini
        öğrenme; bunlara erişme; düzeltme, silme veya işlemenin
        sınırlandırılmasını isteme; izninizi geri çekme ve ilgili mercilere
        başvurma haklarına sahip olabilirsiniz. Talebinizi, kimliğinizi
        doğrulamaya yetecek bilgiyle bize iletebilirsiniz.
      </p>

      <h2>10. İletişim</h2>
      <p>
        Gizlilik veya veri sahibi taleplerinizi{" "}
        <a href="mailto:support@falconmailing.com">
          support@falconmailing.com
        </a>{" "}
        adresine “Kişisel Veri Talebi” konusuyla iletebilirsiniz.
      </p>

      <div className="legal-callout">
        <p>
          Bu metin genel bilgilendirme amacıyla hazırlanmış çalışma taslağıdır;
          hukuki görüş yerine geçmez. Şirket ve veri sorumlusu bilgileri
          kesinleştiğinde metin güncellenecektir.
        </p>
      </div>
    </PageShell>
  );
}
