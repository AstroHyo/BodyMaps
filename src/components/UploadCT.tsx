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
      formData.append("params", JSON.stringify({}));

      const res = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "API request failed");
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
      setError(
        error instanceof Error
          ? error.message
          : "Upload failed. Could be due to incorrect password."
      );
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
      <div className="w-full">
        <div className="my-4 w-full">
          <Label htmlFor="password" className="text-muted-foreground">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              autoComplete="off"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password to enable upload"
              disabled={isUploading || isProcessing}
              className="mt-2 border-input bg-muted text-foreground placeholder:text-muted-foreground pr-10"
            />
            <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
        <div
          className={`flex h-64 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-black/25 text-center transition-all duration-300 hover:border-primary hover:bg-primary/5 ${
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
              <FileUp className="mx-auto mb-4 h-16 w-16 text-primary" />
              <p className="text-lg font-semibold text-white">{file.name}</p>
            </div>
          ) : (
            <div className="text-center">
              <Upload className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
              <p className="text-lg text-white">
                {!password
                  ? "Enter Password First"
                  : "Drag & Drop or Click to Upload"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
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
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-cyan-300"
              onClick={() => router.push("/visualization?runpodEvidence=1")}
            >
              Load RunPod Result
            </Button>
            <Button
              className="w-full border border-border bg-secondary text-secondary-foreground hover:bg-muted"
              onClick={() => router.push("/visualization?sample=1")}
            >
              Load Sample Data
            </Button>
          </div>
        )}
        {(isUploading || isProcessing) && (
          <div className="w-full mt-4">
            <div className="mb-2 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{status}</span>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted">
              <div
                className="h-2.5 rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}
        {(isUploading || isProcessing) && (
          <div className="mt-4 flex items-center text-accent">
            <AlertTriangle className="mr-2 h-5 w-5" />
            <span className="text-sm">
              Please do not close or refresh the page during upload and
              processing.
            </span>
          </div>
        )}
        {error && (
          <div className="mt-4 flex items-center text-red-300">
            <AlertTriangle className="mr-2 h-5 w-5" />
            <span className="text-sm">{error}</span>
          </div>
        )}
      </div>
    </>
  );
}
