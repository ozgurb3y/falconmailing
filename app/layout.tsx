import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://falconmailing.com"),
  title: {
    default: "FalconMailing | İzinli E-posta İletişimi",
    template: "%s | FalconMailing",
  },
  description:
    "Açık izin vermiş kullanıcılarla bilgilendirme ve kampanya iletişimini yönetmek için geliştirilen güvenilir e-posta altyapısı.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "https://falconmailing.com",
    siteName: "FalconMailing",
    title: "FalconMailing | İzinli E-posta İletişimi",
    description:
      "İzinli kullanıcı iletişimi ve sorumlu kampanya yönetimi için güvenilir altyapı.",
    images: [
      {
        url: "/og.png",
        width: 1746,
        height: 909,
        alt: "FalconMailing — İzinli E-posta İletişimi İçin Güvenilir Altyapı",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FalconMailing | İzinli E-posta İletişimi",
    description:
      "İzinli kullanıcı iletişimi ve sorumlu kampanya yönetimi için güvenilir altyapı.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
