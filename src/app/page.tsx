"use client";

import dynamic from "next/dynamic";
import Image from "next/image";

// Using dynamic imports to exclude the UploadCT component from SSR
const DynamicUploadCT = dynamic(() => import("@/components/UploadCT"), {
  ssr: false,
});

export default function MainPage() {
  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8">
      <main className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-8 md:grid-cols-[0.9fr_1.1fr]">
        <section className="flex flex-col items-start">
          <Image
            src="/BodyMapsIcon.png"
            alt="BodyMaps Logo"
            width={128}
            height={128}
            className="mb-5 h-24 w-24"
            priority
          />
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-primary">
            JHU CCVL Research Group
          </p>
          <h1 className="mb-4 text-5xl font-semibold leading-tight text-white">
            BodyMaps
          </h1>
          <p className="max-w-md text-base leading-7 text-muted-foreground">
            Upload an abdominal CT volume and review SuPreM-powered organ
            segmentations in synchronized 2D and 3D medical views.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card/95 p-5 shadow-2xl shadow-black/30">
          <DynamicUploadCT />
          <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
            By using this online service, you agree that the data can be used
            to improve the model.
          </p>
        </section>
      </main>
    </div>
  );
}
