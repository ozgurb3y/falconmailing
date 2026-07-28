import Link from "next/link";
import type { ReactNode } from "react";

const nav = [
  ["Abone Ol", "/#abone-ol"],
  ["Özellikler", "/#ozellikler"],
  ["Nasıl Çalışır?", "/#nasil-calisir"],
  ["İzin ve Güvenlik", "/#izin-ve-guvenlik"],
  ["Gizlilik", "/gizlilik"],
  ["İletişim", "/iletisim"],
];

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="FalconMailing ana sayfa">
      Falcon<span>Mailing</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav aria-label="Ana menü">
          {nav.map(([label, href]) => (
            <Link key={label} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <Link className="header-cta" href="/unsubscribe">
          Abonelikten Çık
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <Brand />
          <p>
            İzinli kullanıcı iletişimi ve sorumlu kampanya yönetimi için
            geliştirilen altyapı.
          </p>
        </div>
        <div className="footer-links">
          <div>
            <p>Kurumsal</p>
            <Link href="/#ozellikler">Özellikler</Link>
            <Link href="/#nasil-calisir">Nasıl Çalışır?</Link>
            <Link href="/iletisim">İletişim</Link>
          </div>
          <div>
            <p>Politikalar</p>
            <Link href="/gizlilik">Gizlilik Politikası</Link>
            <Link href="/kullanim-kosullari">Kullanım Koşulları</Link>
            <Link href="/ticari-ileti-ve-izin">Ticari İleti ve İzin</Link>
          </div>
          <div>
            <p>Tercihler</p>
            <Link href="/unsubscribe">Abonelikten Çık</Link>
            <a href="mailto:support@falconmailing.com">
              support@falconmailing.com
            </a>
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} FalconMailing</span>
        <span>İzinli iletişim. Şeffaf süreç. Sorumlu gönderim.</span>
      </div>
    </footer>
  );
}

export function PageShell({
  eyebrow,
  title,
  intro,
  children,
  note,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
  note?: string;
}) {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="page-hero">
          <div className="container narrow">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{intro}</p>
            <div className="page-meta">
              <span>Son güncelleme: 28 Temmuz 2026</span>
              <span>falconmailing.com</span>
            </div>
          </div>
        </section>
        <section className="legal-section">
          <div className="container legal-layout">
            <aside>
              <p>Belge özeti</p>
              <span>{note ?? "Bu metin şeffaflık amacıyla yayımlanmıştır."}</span>
            </aside>
            <article className="legal-content">{children}</article>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
