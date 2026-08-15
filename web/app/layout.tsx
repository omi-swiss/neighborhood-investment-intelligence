import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "neighborhood-investment-intelligence.openai.site";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : host.startsWith("localhost")
        ? "http"
        : "https";
  const origin = `${protocol}://${host}`;
  const description =
    "A private, evidence-first application for screening U.S. neighborhoods and evaluating real-estate opportunities.";
  const previewImage = `${origin}/og.png`;
  return {
    metadataBase: new URL(origin),
    title: {
      default: "Neighborhood Investment Intelligence",
      template: "%s | NII",
    },
    description,
    openGraph: {
      title: "Neighborhood Investment Intelligence",
      description: "Evidence-first neighborhood screening",
      type: "website",
      url: origin,
      images: [{ url: previewImage, width: 1200, height: 630, alt: "Neighborhood Investment Intelligence" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Neighborhood Investment Intelligence",
      description: "Evidence-first neighborhood screening",
      images: [previewImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        {children}
        <footer className="site-footer">
          <span>Neighborhood Investment Intelligence</span>
          <nav aria-label="Legal and accessibility">
            <a href="/accessibility">Accessibility</a>
            <a href="/sources">Sources</a>
            <a href="/methodology">Methodology</a>
            <a href="/health">Data health</a>
          </nav>
        </footer>
      </body>
    </html>
  );
}
