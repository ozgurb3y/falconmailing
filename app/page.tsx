import Link from "next/link";
import { SubscriptionForm } from "./components/subscription-form";
import { SiteFooter, SiteHeader } from "./site";

const features = [
  {
    number: "01",
    title: "İzin kaydını merkeze alır",
    text: "İzin tarihi, kaynağı ve kullanılan bilgilendirme metninin sürümüyle birlikte izlenebilir bir kayıt modeli.",
  },
  {
    number: "02",
    title: "Gönderimden önce kontrol eder",
    text: "Abonelikten çıkan, hard bounce üreten veya şikâyette bulunan adreslerin yeniden hedeflenmesini önleyen suppression yaklaşımı.",
  },
  {
    number: "03",
    title: "Alıcı tercihine saygı duyar",
    text: "Her pazarlama iletisinde görünür ve kolay erişilebilir abonelikten çıkma süreci.",
  },
  {
    number: "04",
    title: "Kimlik doğrulamayı önemser",
    text: "SPF, DKIM ve DMARC ile desteklenen, itibarı ve teslim edilebilirliği gözeten gönderim mimarisi.",
  },
];

const steps = [
  ["İzin alınır", "Kullanıcı, işaretlenmemiş bir onay kutusuyla açık tercihini bildirir."],
  ["Kayıt doğrulanır", "İzin; tarih, kaynak ve metin sürümüyle kaydedilir. E-posta adresi double opt-in ile doğrulanır."],
  ["Kampanya hazırlanır", "Yalnızca uygun ve izinli alıcılar hedeflenir; engelli adresler dışarıda bırakılır."],
  ["İleti gönderilir", "Gönderim hacmi kademeli tutulur ve teknik kimlik doğrulama kontrolleri izlenir."],
  ["Tercih uygulanır", "İptal, hard bounce ve complaint kayıtları sonraki gönderimleri durdurur."],
];

const principles = [
  "Satın alınmış, kiralanmış veya internetten toplanmış adresler kullanılmaz.",
  "İzin vermemiş kişilere pazarlama amaçlı ileti gönderilmez.",
  "Onay kutuları önceden işaretlenmez; izin kanıtı kayıt altında tutulur.",
  "Abonelikten çıkma talebi tekrar pazarlama gönderimini engeller.",
  "Hard bounce ve spam şikâyeti oluşturan adresler suppression listesine alınır.",
  "Gönderim hacmi, doğrulanmış alıcı tabanı ve servis kotalarıyla birlikte kademeli artırılır.",
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">İzinli iletişim · Sorumlu gönderim</p>
              <h1>
                E-posta iletişimi,
                <br />
                <span>izinle başlar.</span>
              </h1>
              <p className="hero-lead">
                FalconMailing, açıkça izin vermiş kullanıcılarla bilgilendirme
                ve kampanya iletişimini yönetmek için geliştirilen güvenilir bir
                altyapıdır.
              </p>
              <div className="hero-actions">
                <a className="button button-primary" href="#abone-ol">
                  İzinli listeye katılın
                </a>
                <Link className="text-link" href="/ticari-ileti-ve-izin">
                  İzin politikamız <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </div>
            <aside className="trust-card" aria-label="Gönderim ilkelerimiz">
              <p className="card-kicker">Gönderim ilkesi</p>
              <p className="trust-quote">
                “Doğrulanabilir izin yoksa gönderim de yok.”
              </p>
              <div className="status-row">
                <span className="status-dot" aria-hidden="true" />
                <span>Amazon SES alan adı kimliği doğrulandı</span>
              </div>
              <div className="trust-rule" />
              <dl className="trust-facts">
                <div>
                  <dt>Gönderim alan adı</dt>
                  <dd>send.falconmailing.com</dd>
                </div>
                <div>
                  <dt>Bölge</dt>
                  <dd>Europe (Frankfurt)</dd>
                </div>
                <div>
                  <dt>Mevcut aşama</dt>
                  <dd>İzin ve doğrulama altyapısı</dd>
                </div>
              </dl>
            </aside>
          </div>
        </section>

        <section className="statement">
          <div className="container statement-grid">
            <p className="section-label">Yaklaşımımız</p>
            <p className="statement-copy">
              Daha çok e-posta göndermek için değil, doğru kişiye doğru
              iletiyi, açık bir izin kaydıyla ulaştırmak için tasarlanıyoruz.
            </p>
          </div>
        </section>

        <section className="subscription-section" id="abone-ol">
          <div className="container subscription-grid">
            <div>
              <p className="section-label">İzinli abonelik</p>
              <h2>Önce siz istersiniz, sonra biz doğrularız.</h2>
              <p className="subscription-intro">
                Kampanya, ürün duyurusu ve bilgilendirme e-postalarımıza katılmak
                için formu doldurun. Adresiniz, gönderdiğimiz doğrulama
                bağlantısını açıp son onayı vermeden aktif listeye eklenmez.
              </p>
              <ul className="mini-check-list">
                <li>Onay kutusu önceden işaretlenmez.</li>
                <li>İzin tarihi, kaynağı ve metin sürümü kaydedilir.</li>
                <li>İzninizi istediğiniz zaman geri çekebilirsiniz.</li>
              </ul>
            </div>
            <div className="subscription-card">
              <h3>E-posta aboneliği</h3>
              <p>
                Formdan sonra gelen kutunuza tek kullanımlık bir doğrulama
                bağlantısı gönderilir.
              </p>
              <SubscriptionForm />
            </div>
          </div>
        </section>

        <section className="section" id="ozellikler">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="section-label">Altyapı bileşenleri</p>
                <h2>Güven, gönder tuşundan önce kurulur.</h2>
              </div>
              <p>
                Aşağıdaki kontroller FalconMailing’in izinli gönderim
                mimarisinin temelidir ve her kayıt için uygulanır.
              </p>
            </div>
            <div className="feature-grid">
              {features.map((feature) => (
                <article className="feature-card" key={feature.number}>
                  <span>{feature.number}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section process-section" id="nasil-calisir">
          <div className="container">
            <div className="section-heading light-heading">
              <div>
                <p className="section-label">Nasıl çalışır?</p>
                <h2>İzinden tercihe, açık bir iletişim zinciri.</h2>
              </div>
              <p>
                Süreç; rıza kaydını, uygunluk kontrolünü ve alıcı tercihini tek
                bir denetlenebilir akışta birleştirir.
              </p>
            </div>
            <ol className="process-list">
              {steps.map(([title, text], index) => (
                <li key={title}>
                  <span className="step-number">0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section" id="izin-ve-guvenlik">
          <div className="container principle-grid">
            <div>
              <p className="section-label">İzin ve güvenlik</p>
              <h2>Liste büyüklüğünden önce liste kaynağına bakarız.</h2>
              <p className="principle-intro">
                FalconMailing; izinli kullanıcı iletişimi ve kampanya yönetimi
                için hazırlanır. Her listeye gönderim yapan bir toplu e-posta
                satış hizmeti değildir.
              </p>
              <Link className="button button-dark" href="/ticari-ileti-ve-izin">
                Politikanın tamamı
              </Link>
            </div>
            <ul className="check-list">
              {principles.map((principle) => (
                <li key={principle}>
                  <span aria-hidden="true">✓</span>
                  {principle}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="cta-section">
          <div className="container cta-card">
            <div>
              <p className="section-label">Şeffaf iletişim</p>
              <h2>Bir izin, veri veya abonelik sorunuz mu var?</h2>
              <p>
                Abonelik tercihi, veri silme talebi ya da istenmeyen ileti
                bildirimi için doğrudan bize ulaşabilirsiniz.
              </p>
            </div>
            <div className="cta-actions">
              <Link className="button button-primary" href="/iletisim">
                İletişime geçin
              </Link>
              <Link className="text-link light-link" href="/unsubscribe">
                Abonelikten çıkın <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
