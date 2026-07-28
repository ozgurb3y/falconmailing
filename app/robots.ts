import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/unsubscribe"],
    },
    sitemap: "https://falconmailing.com/sitemap.xml",
    host: "https://falconmailing.com",
  };
}
