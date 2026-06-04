import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#6366f1" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1b4b" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "Knowledge Cloud",
    template: "%s | Knowledge Cloud",
  },
  description: "Track your YouTube subscriptions, organize videos by tags, and manage your watch progress.",
  keywords: ["YouTube", "subscriptions", "tracker", "videos", "tags", "watchlist"],
  authors: [{ name: "Knowledge Cloud" }],
  manifest: "/manifest.json?v=2",
  icons: {
    icon: [
      { url: "/favicon-16x16.png?v=2", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico?v=2", sizes: "48x48" },
      { url: "/icon.svg?v=2", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon.ico?v=2"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Knowledge Cloud",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Knowledge Cloud",
    title: "Knowledge Cloud",
    description: "Track your YouTube subscriptions, organize videos by tags, and manage your watch progress.",
    images: [
      {
        url: "/og-image.png?v=2",
        width: 1200,
        height: 630,
        alt: "Knowledge Cloud - YouTube Subscription Tracker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Knowledge Cloud",
    description: "Track your YouTube subscriptions, organize videos by tags, and manage your watch progress.",
    images: ["/og-image.png?v=2"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
