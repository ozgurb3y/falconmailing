# FalconMailing

FalconMailing'in izinli kullanıcı iletişimi ve kampanya yönetimi yaklaşımını
uygulayan kurumsal web sitesi ve yönetim paneli.

## Teknoloji

- Next.js 16
- React 19
- TypeScript
- Neon PostgreSQL
- Amazon SES

## Komutlar

```bash
npm install
npm run dev
npm run build
npm start
```

## Sayfalar

- `/`
- `/admin`
- `/gizlilik`
- `/kullanim-kosullari`
- `/ticari-ileti-ve-izin`
- `/iletisim`
- `/unsubscribe`

## Yönetim paneli

Kampanya yönetimi `/admin` altında çalışır. Yönetici parolası ve oturum imzalama
anahtarı yalnızca dağıtım ortamındaki `ADMIN_PASSWORD_HASH` ve
`ADMIN_SESSION_SECRET` değişkenlerinde saklanır.

Kampanyalar oluşturulurken alıcı listesi `marketing_eligible_contacts`
görünümünden alınır. Gönderimden hemen önce uygunluk tekrar kontrol edilir;
doğrulanmamış, izni uygun olmayan, abonelikten çıkmış veya engellenmiş kişiler
gönderime dahil edilmez.

Şirket çalışanlarına yapılan iç iletişimler için pazarlama abonelerinden ayrı
bir `internal_recipients` listesi bulunur. Yönetici kampanya oluştururken
“Şirket içi liste” grubunu seçebilir; bu grupta İYS filtresi uygulanmaz.
Listeden ayrılan veya pasifleştirilen çalışan adresleri yeniden hedeflenmez.

Kampanya gönderimi tarayıcıdan bağımsız bir sunucu işçisiyle ilerler. İşçi
görevi veritabanında süreli olarak sahiplenir, kontrollü SMTP bağlantı havuzu
kullanır ve sunucu çalışması kesilirse kaldığı kuyruğu yeniden sahiplenir.
`CAMPAIGN_SMTP_CONNECTIONS`, `CAMPAIGN_BATCH_SIZE` ve
`CAMPAIGN_BATCHES_PER_INVOCATION` değerleri SES gönderim kotasına göre
ayarlanabilir.

## Vercel

Vercel proje ayarlarında:

- Framework Preset: `Next.js`
- Build Command: `npm run build`
- Output Directory: varsayılan
- Root Directory: `.`

`falconmailing.com` ve `www.falconmailing.com` alan adları bağlanırken Amazon SES
DKIM, DMARC, MX ve SPF kayıtları korunmalıdır.
