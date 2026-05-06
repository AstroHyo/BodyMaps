"use client";

import localFont from "next/font/local";
import dynamic from "next/dynamic";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// Using dynamic imports to exclude Cornerstone.js from SSR
const DynamicCornerstoneProvider = dynamic(
  () =>
    import("@/context/CornerstoneContext").then(
      (mod) => mod.CornerstoneProvider
    ),
  { ssr: false }
);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <title>BodyMaps</title>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <DynamicCornerstoneProvider>{children}</DynamicCornerstoneProvider>
      </body>
    </html>
  );
}
