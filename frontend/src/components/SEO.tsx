import { useEffect } from "react";

export interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

export function SEO({
  title = "Maa Tara Sweets — Scan, Order, Enjoy | Ranchi",
  description = "Order Indian breakfast, snacks, main course and fresh mithai straight from your table QR code.",
  image = "https://shivansirestaurantranchi.vercel.app/og-image.jpg",
  url = "https://shivansirestaurantranchi.vercel.app",
}: SEOProps) {
  useEffect(() => {
    document.title = title;

    const setMetaTag = (attr: string, key: string, content: string) => {
      let element = document.querySelector(`meta[${attr}="${key}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attr, key);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    setMetaTag("name", "title", title);
    setMetaTag("name", "description", description);

    setMetaTag("property", "og:title", title);
    setMetaTag("property", "og:description", description);
    setMetaTag("property", "og:image", image);
    setMetaTag("property", "og:url", url);

    setMetaTag("name", "twitter:title", title);
    setMetaTag("name", "twitter:description", description);
    setMetaTag("name", "twitter:image", image);
    setMetaTag("name", "twitter:url", url);
  }, [title, description, image, url]);

  return null;
}
