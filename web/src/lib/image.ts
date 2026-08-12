const MAX_BACKGROUND_BYTES = 10 * 1024 * 1024;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Could not read this image. Try a different photo."));
    img.src = url;
  });
}

/** Accept photos from the camera roll (JPEG, HEIC, WebP, etc.) and normalize to PNG. */
export async function normalizeBackgroundImage(file: File): Promise<File> {
  if (file.size > MAX_BACKGROUND_BYTES) {
    throw new Error("Background must be 10MB or smaller");
  }

  const type = file.type.toLowerCase();
  if (type === "image/png") return file;

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process this image");

    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not convert image"))),
        "image/png",
      );
    });

    if (blob.size > MAX_BACKGROUND_BYTES) {
      throw new Error("Background must be 10MB or smaller");
    }

    const stem = file.name.replace(/\.[^.]+$/, "") || "background";
    return new File([blob], `${stem}.png`, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };
    img.src = url;
  });
}
