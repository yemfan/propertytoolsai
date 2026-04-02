/**
 * Browsers often send empty `File.type` or `application/octet-stream` for valid images.
 * Resolve a canonical image MIME + extension from type and/or filename.
 */

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

const EXT_TO_CANONICAL: Record<string, { mime: string; ext: string }> = {
  ".jpg": { mime: "image/jpeg", ext: "jpg" },
  ".jpeg": { mime: "image/jpeg", ext: "jpg" },
  ".png": { mime: "image/png", ext: "png" },
  ".webp": { mime: "image/webp", ext: "webp" },
  ".gif": { mime: "image/gif", ext: "gif" },
  ".heic": { mime: "image/heic", ext: "heic" },
  ".heif": { mime: "image/heif", ext: "heif" },
};

export type AvatarResolved =
  | { ok: true; contentType: string; ext: string }
  | { ok: false; error: string };

export function resolveAvatarImageFile(file: Pick<File, "type" | "name">): AvatarResolved {
  let mime = (file.type || "").trim().toLowerCase();
  const name = (file.name || "").toLowerCase();
  const dot = name.lastIndexOf(".");
  const extKey = dot >= 0 ? name.slice(dot) : "";

  if (!mime || mime === "application/octet-stream") {
    const fromName = EXT_TO_CANONICAL[extKey];
    if (fromName) {
      return { ok: true, contentType: fromName.mime, ext: fromName.ext };
    }
  }

  if (mime === "image/jpg") mime = "image/jpeg";

  const ext = MIME_TO_EXT[mime];
  if (ext) {
    return { ok: true, contentType: mime, ext };
  }

  if (extKey && EXT_TO_CANONICAL[extKey]) {
    const c = EXT_TO_CANONICAL[extKey];
    return { ok: true, contentType: c.mime, ext: c.ext };
  }

  return {
    ok: false,
    error:
      "Could not detect image type. Use JPEG, PNG, WebP, GIF, or HEIC, or rename the file with a normal extension (.jpg, .png, …).",
  };
}
