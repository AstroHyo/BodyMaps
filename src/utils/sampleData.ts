export const SAMPLE_VOLUME_URL = "/samples/ct.nii.gz";

export const SAMPLE_SEGMENTATION_FILES = [
  { organName: "aorta", url: "/samples/aorta.nii.gz" },
  { organName: "gall_bladder", url: "/samples/gall_bladder.nii.gz" },
  { organName: "kidney_left", url: "/samples/kidney_left.nii.gz" },
  { organName: "kidney_right", url: "/samples/kidney_right.nii.gz" },
  { organName: "liver", url: "/samples/liver.nii.gz" },
  { organName: "pancreas", url: "/samples/pancreas.nii.gz" },
  { organName: "postcava", url: "/samples/postcava.nii.gz" },
  { organName: "spleen", url: "/samples/spleen.nii.gz" },
  { organName: "stomach", url: "/samples/stomach.nii.gz" },
];

type SampleMetrics = Record<
  string,
  {
    meanHU: string;
    volumeCM: string;
  }
>;

export async function loadSampleSegmentations() {
  const metricsRes = await fetch("/samples/manifest.json");
  const metrics: SampleMetrics = metricsRes.ok ? await metricsRes.json() : {};

  const segmentations = await Promise.all(
    SAMPLE_SEGMENTATION_FILES.map(async ({ organName, url }) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load sample segmentation: ${url}`);
      }

      const content = await res.arrayBuffer();
      return {
        organName,
        content,
        volumeCM: metrics[organName]?.volumeCM ?? "",
        meanHU: metrics[organName]?.meanHU ?? "",
      };
    })
  );

  return {
    volumeURL: SAMPLE_VOLUME_URL,
    segmentations,
  };
}
