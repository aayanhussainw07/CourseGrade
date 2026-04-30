import type { MetadataRoute } from "next";

const siteUrl = "https://www.coursegrade.io";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/semesters/", "/admin/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
