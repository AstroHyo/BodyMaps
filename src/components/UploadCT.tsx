"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Upload, FileUp, AlertTriangle, Lock } from "lucide-react";
import { upload } from "@vercel/blob/client";
import { base64ToArrayBuffer } from "@/utils/base64ToArrayBuffer";
import { useCornerstone } from "@/context/CornerstoneContext";
import { parseInferenceResult } from "@/utils/inference";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function UploadCT() {
  const [file, setFile] = React.useState<File | null>(null);
  const [password, setPassword] = React.useState("");
  const [progress, setProgress] = React.useState(0);
  const [status, setStatus] = React.useState("");
  const [isUploading, setIsUploading] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const { setVolumeURL, setSegmentations } = useCornerstone();

  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.log("asking");
      if (isUploading || isProcessing) {
        e.preventDefault();
        return (e.returnValue = "Are you sure you want to leave?");
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isUploading, isProcessing]);

  const simulateProgress = React.useCallback(
    (startMessage: string, duration: number) => {
      setProgress(0);
      setStatus(startMessage);

      const interval = setInterval(() => {
        setProgress((prevProgress) => {
          if (prevProgress >= 99) {
            clearInterval(interval);
            return 99;
          }
          return prevProgress + 1;
        });
      }, duration / 100);

      return () => clearInterval(interval);
    },
    []
  );

  const handleUpload = React.useCallback(async () => {
    if (!file) return;
    if (!password) return;

    setError(null);
    setIsUploading(true);

    let clearSimulation: (() => void) | null = null;

    try {
      // Simulate upload progress
      clearSimulation = simulateProgress(
        "Uploading...",
        5000 // allocate seconds for upload
      );

      // Actual upload
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        clientPayload: JSON.stringify({ password }),
      });

      setIsUploading(false);
      clearSimulation?.();

      console.log("File uploaded successfully:", blob.url);

      setIsProcessing(true);

      // Simulate processing progress
      clearSimulation = simulateProgress(
        "Running inference... (this could take up to a few minutes)",
        60000 // allocate 60 seconds for processing
      );

      // Here you would typically send the blob.url to your backend for processing
      const formData = new FormData();
      formData.append("file", blob.url);
      formData.append("password", password);

      const res = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("API request failed");
      }

      const data = parseInferenceResult(await res.json());

      console.log("got data", data);

      console.log("setting data");

      setVolumeURL(URL.createObjectURL(file));
      setSegmentations(
        Object.entries(data).map(
          ([organName, { content, volume_cm, mean_hu }]) => ({
            organName,
            content: base64ToArrayBuffer(content),
            volumeCM: volume_cm + "",
            meanHU: mean_hu + "",
          })
        )
      );

      router.push("/visualization");
    } catch (error) {
      console.error("Upload failed:", error);
      setError(`Upload failed. Could be due to incorrect password.`);
    }

    clearSimulation?.();
    setIsUploading(false);
    setIsProcessing(false);
    setFile(null);
  }, [
    file,
    simulateProgress,
    router,
    password,
    setSegmentations,
    setVolumeURL,
  ]);

  React.useEffect(() => {
    if (file) {
      handleUpload();
    }
  }, [file, handleUpload]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.name.endsWith(".nii.gz")) {
      setFile(selectedFile);
    } else {
      alert("Please select a valid .nii.gz file");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith(".nii.gz")) {
      setFile(droppedFile);
    } else {
      alert("Please drop a valid .nii.gz file");
    }
  };

  return (
    <>
      <div className="w-full max-w-md">
        <div className="my-4 w-full">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              autoComplete="off"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password to enable upload"
              disabled={isUploading || isProcessing}
              className="pr-10"
            />
            <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
        </div>
        <div
          className={`h-64 border-2 border-dashed border-gray-400 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-300 hover:border-blue-500 ${
            !password || isUploading || isProcessing
              ? "pointer-events-none opacity-50"
              : ""
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {file ? (
            <div className="text-center">
              <FileUp className="w-16 h-16 mx-auto mb-4 text-blue-500" />
              <p className="text-lg font-semibold">{file.name}</p>
            </div>
          ) : (
            <div className="text-center">
              <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-lg">
                {!password
                  ? "Enter Password First"
                  : "Drag & Drop or Click to Upload"}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Supported format: .nii.gz
              </p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".nii.gz"
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading || isProcessing}
        />
        {process.env.NEXT_PUBLIC_ALLOW_SAMPLE_DATA && (
          <Button
            onClick={() => router.push("/visualization?sample=1")}
          >
            Load Sample Data
          </Button>
        )}
        {(isUploading || isProcessing) && (
          <div className="w-full mt-4">
            <div className="mb-2 flex justify-between items-center">
              <span className="text-sm">{status}</span>
              <span className="text-sm">{progress}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}
        {(isUploading || isProcessing) && (
          <div className="mt-4 flex items-center text-yellow-400">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <span className="text-sm">
              Please do not close or refresh the page during upload and
              processing.
            </span>
          </div>
        )}
        {error && (
          <div className="mt-4 flex items-center text-red-400">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <span className="text-sm">{error}</span>
          </div>
        )}
      </div>
    </>
  );
}
