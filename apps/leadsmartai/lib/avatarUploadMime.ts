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
  "image/avif": "avif",
};

const EXT_TO_CANONICAL: Record<string, { mime: string; ext: string }> = {
  ".jpg": { mime: "image/jpeg", ext: "jpg" },
  ".jpeg": { mime: "image/jpeg", ext: "jpg" },
  ".png": { mime: "image/png", ext: "png" },
  ".webp": { mime: "image/webp", ext: "webp" },
  ".gif": { mime: "image/gif", ext: "gif" },
  ".heic": { mime: "image/heic", ext: "heic" },
  ".heif": { mime: "image/heif", ext: "heif" },
  ".avif": { mime: "image/avif", ext: "avif" },
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

  if (mime === "image/jpg" || mime === "image/pjpeg" || mime === "image/x-cis-jpg") {
    mime = "image/jpeg";
  }

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

/** Detect image format from file header when browsers omit `type` / filename (common on iOS, Windows). */
export function sniffImageMimeFromBuffer(buf: Uint8Array): { contentType: string; ext: string } | null {
  if (buf.length < 12) return null;

  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { contentType: "image/jpeg", ext: "jpg" };
  }
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { contentType: "image/png", ext: "png" };
  }
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return { contentType: "image/gif", ext: "gif" };
  }
  // WebP: RIFF....WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { contentType: "image/webp", ext: "webp" };
  }
  // AVIF / HEIC (ISO BMFF: ....ftyp …)
  if (buf.length >= 12 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
    if (brand === "avif" || brand === "avis") {
      return { contentType: "image/avif", ext: "avif" };
    }
    if (brand === "heic" || brand === "heix" || brand === "mif1" || brand === "msf1") {
      return { contentType: "image/heic", ext: "heic" };
    }
  }

  return null;
}

/**
 * Resolve MIME + extension from metadata, then from file bytes if needed (must match uploaded buffer).
 */
export function resolveAvatarImageForUpload(
  file: Pick<File, "type" | "name">,
  bytes: ArrayBuffer
): AvatarResolved {
  const fromMeta = resolveAvatarImageFile(file);
  if (fromMeta.ok) return fromMeta;
  const sniffed = sniffImageMimeFromBuffer(new Uint8Array(bytes));
  if (sniffed) {
    return { ok: true, contentType: sniffed.contentType, ext: sniffed.ext };
  }
  return fromMeta;
}
