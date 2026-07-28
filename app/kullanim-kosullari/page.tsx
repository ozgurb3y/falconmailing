import type { Metadata } from "next";
import { PageShell } from "../site";

export const metadata: Metadata = {
  title: "Kullanım Koşulları",
  description:
    "FalconMailing hizmet kapsamı, izinli kullanım kuralları ve yasaklanan kullanım biçimleri.",
  alternates: { canonical: "/kullanim-kosullari" },
};

export default function TermsPage() {
  return (
    <PageShell
      eyebrow="Politikalar"
      title="Kullanım Koşulları"
      intro="FalconMailing web sitesinin ve geliştirilmekte olan izinli iletişim altyapısının kullanımına ilişkin temel kuralları açıklar."
      note="FalconMailing şu anda kurulum aşamasındadır; herkese açık müşteri hesabı sunulmamaktadır."
    >
      <h2>1. Hizmetin kapsamı</h2>
      <p>
        FalconMailing, açık izin vermiş kullanıcılarla bilgilendirme ve
        pazarlama iletişimini yönetmek üzere geliştirilen bir altyapıdır.
        Hizmetin ilk aşaması kurumsal web sitesi ve izin süreçlerinin
        hazırlanmasını kapsar. Yönetim paneli ve gönderim özellikleri devreye
        alındıkça bu koşullar güncellenebilir.
      </p>

      <h2>2. İzinli ve yasal kullanım</h2>
      <p>
        Hizmet yalnızca yürürlükteki mevzuata, alıcı tercihine ve bu koşullara
        uygun amaçlarla kullanılabilir. Gönderici, iletişim kurduğu kişilerin
        geçerli iznini kanıtlayabilmekten ve gerekli bilgilendirmeleri yapmaktan
        sorumludur.
      </p>

      <h2>3. Yasaklanan kullanımlar</h2>
      <p>Aşağıdaki kullanım biçimlerine izin verilmez:</p>
      <ul>
        <li>Satın alınmış, kiralanmış veya üçüncü taraf listeleri kullanmak,</li>
        <li>İnternetten kazınmış ya da izinsiz elde edilmiş adreslere göndermek,</li>
        <li>Alıcı kimliğini, gönderici bilgisini veya ileti amacını gizlemek,</li>
        <li>Abonelikten çıkma taleplerini görmezden gelmek,</li>
        <li>
          Zararlı yazılım, kimlik avı, aldatıcı, hukuka aykırı veya hak ihlal
          eden içerik göndermek,
        </li>
        <li>
          Sistem güvenliğini, gönderim kotalarını veya erişim kontrollerini
          aşmaya çalışmak,
        </li>
        <li>Hard bounce veya complaint kaydı bulunan adresi yeniden hedeflemek.</li>
      </ul>

      <h2>4. Hesap ve erişim güvenliği</h2>
      <p>
        Yönetici erişimi sunulduğunda kullanıcılar kimlik bilgilerini gizli
        tutmak ve şüpheli erişimleri gecikmeden bildirmekle sorumlu olacaktır.
        Yetkisiz kullanım şüphesinde erişim geçici olarak sınırlandırılabilir.
      </p>

      <h2>5. İnceleme, sınırlandırma ve askıya alma</h2>
      <p>
        Spam şikâyeti, olağandışı bounce oranı, izinsiz liste kullanımı veya
        güvenlik riski tespit edilmesi hâlinde ilgili gönderim durdurulabilir,
        erişim sınırlandırılabilir veya hesap askıya alınabilir. Gerektiğinde
        izin kaynağını gösteren kayıtların sunulması istenebilir.
      </p>

      <h2>6. Hizmet değişiklikleri</h2>
      <p>
        Teknik, hukuki veya güvenlik gereksinimleri doğrultusunda özellikler,
        kotalar ve bu koşullar değiştirilebilir. Önemli değişiklikler uygun
        kanallardan duyurulur. Henüz kullanıma açılmamış özellikler, sunulmuş bir
        hizmet taahhüdü oluşturmaz.
      </p>

      <h2>7. Fikrî haklar</h2>
      <p>
        FalconMailing adı, tasarımı ve hizmete ait içerikler üzerindeki haklar
        ilgili hak sahibine aittir. Kullanıcılar kendi kampanya içeriklerinin ve
        kullandıkları materyallerin gerekli haklarına sahip olmalıdır.
      </p>

      <h2>8. Sorumluluğun sınırları</h2>
      <p>
        Hizmetin kesintisiz veya hatasız olacağına dair mutlak garanti verilmez.
        Üçüncü taraf servisler, internet altyapısı, alıcı sunucuları veya
        mevzuat değişikliklerinden kaynaklanan durumlar hizmeti etkileyebilir.
        Emredici hukuk hükümleri saklı kalmak üzere sorumluluk, olayın niteliği
        ve uygulanabilir hukuk çerçevesinde değerlendirilir.
      </p>

      <h2>9. İletişim</h2>
      <p>
        Koşullara ilişkin sorularınızı{" "}
        <a href="mailto:support@falconmailing.com">
          support@falconmailing.com
        </a>{" "}
        adresine iletebilirsiniz.
      </p>

      <div className="legal-callout">
        <p>
          Bu metin bir çalışma taslağıdır. Ticari unvan, adres, yetkili mahkeme
          ve diğer zorunlu bilgiler kesinleştiğinde profesyonel hukuk incelemesi
          sonrasında tamamlanmalıdır.
        </p>
      </div>
    </PageShell>
  );
}
