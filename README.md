# FalconMailing

FalconMailing'in izinli kullanıcı iletişimi ve kampanya yönetimi yaklaşımını
anlatan kurumsal web sitesi.

## Teknoloji

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS

## Komutlar

```bash
npm install
npm run dev
npm run build
npm start
```

## Sayfalar

- `/`
- `/gizlilik`
- `/kullanim-kosullari`
- `/ticari-ileti-ve-izin`
- `/iletisim`
- `/unsubscribe`

## Vercel

Vercel proje ayarlarında:

- Framework Preset: `Next.js`
- Build Command: `npm run build`
- Output Directory: varsayılan
- Root Directory: `.`

`falconmailing.com` ve `www.falconmailing.com` domainleri ancak Vercel preview
deployment doğrulandıktan sonra bağlanmalıdır. DNS değişikliği yapılırken Amazon
SES DKIM, DMARC, MX ve SPF kayıtları korunmalıdır.
