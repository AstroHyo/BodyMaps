type AuthResult =
  | { ok: true }
  | { ok: false; error: string; status: 400 | 401 | 500 };

const VERCEL_BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

function normalizedHost(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function configuredCtHosts(): string[] {
  return (process.env.ALLOWED_CT_URL_HOSTS ?? "")
    .split(",")
    .map(normalizedHost)
    .filter(Boolean);
}

function isConfiguredAllowedHost(hostname: string): boolean {
  const normalized = normalizedHost(hostname);

  if (normalized.endsWith(VERCEL_BLOB_HOST_SUFFIX)) {
    return true;
  }

  return configuredCtHosts().some((allowedHost) => {
    if (allowedHost.startsWith(".")) {
      return normalized.endsWith(allowedHost);
    }
    return normalized === allowedHost;
  });
}

export function isManagedVercelBlobUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return normalizedHost(url.hostname).endsWith(VERCEL_BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

export function validateCtDownloadUrl(value: unknown): string {
  if (typeof value !== "string" || !value) {
    throw new Error("Missing CT download URL");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid CT download URL");
  }

  if (url.protocol !== "https:") {
    throw new Error("CT download URL must use HTTPS");
  }

  if (url.username || url.password) {
    throw new Error("CT download URL must not include credentials");
  }

  if (!isConfiguredAllowedHost(url.hostname)) {
    throw new Error("CT download URL host is not allowed");
  }

  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname).toLowerCase();
  } catch {
    throw new Error("CT download URL path is malformed");
  }

  if (!pathname.endsWith(".nii.gz")) {
    throw new Error("CT download URL must point to a .nii.gz file");
  }

  return url.toString();
}

export function isLocalPasswordBypassAllowed(): boolean {
  return (
    process.env.DISABLE_PASSWORD === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

export function validateSharedPassword(
  password: FormDataEntryValue | string | null | undefined
): AuthResult {
  if (isLocalPasswordBypassAllowed()) {
    return { ok: true };
  }

  if (!process.env.PASSWORD) {
    return {
      ok: false,
      error: "Server password is not configured",
      status: 500,
    };
  }

  if (typeof password !== "string" || !password) {
    return { ok: false, error: "Password is required", status: 400 };
  }

  if (password !== process.env.PASSWORD) {
    return { ok: false, error: "Invalid password", status: 401 };
  }

  return { ok: true };
}
