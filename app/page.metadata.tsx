import { generateMetadata, getJsonLd } from "./metadata";
import Script from "next/script";

// Export metadata for the home page
export const metadata = generateMetadata();

// Export a component that renders the JSON-LD script
export function JsonLd() {
  return (
    <Script
      id="home-json-ld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: getJsonLd()
      }}
    />
  );
}
