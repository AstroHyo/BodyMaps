"use client";

import dynamic from "next/dynamic";
import Image from "next/image";

// Using dynamic imports to exclude the UploadCT component from SSR
const DynamicUploadCT = dynamic(() => import("@/components/UploadCT"), {
  ssr: false,
});

export default function MainPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col items-center justify-center p-4">
      <Image
        src="/BodyMapsIcon.png"
        alt="BodyMaps Logo"
        width={128}
        height={128}
        className="w-32 mb-4"
        priority
      />
      <h1 className="text-4xl font-bold mb-2 text-center">BodyMaps</h1>
      <p className="text-sm text-gray-600 mb-8 text-center">
        JHU CCVL Research Group
      </p>
      <DynamicUploadCT />
      <p className="text-sm text-gray-700 mt-4 max-w-md text-center">
        By using this online service, you agree that the data can be used to
        improve the model.
      </p>
    </div>
  );
}
