"use client";

import dynamic from "next/dynamic";
import "./globals.css";

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
      <body className="antialiased">
        <DynamicCornerstoneProvider>{children}</DynamicCornerstoneProvider>
      </body>
    </html>
  );
}
