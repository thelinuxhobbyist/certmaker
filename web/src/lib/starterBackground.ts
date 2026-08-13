import type { StarterPreviewKind, StarterTemplate } from "./starterTemplates";

type PaintFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function strokeInset(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  inset: number,
  color: string,
  lineWidth: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
}

const PAINT: Record<StarterPreviewKind, PaintFn> = {
  elegant(ctx, w, h) {
    ctx.fillStyle = "#FFFDF9";
    ctx.fillRect(0, 0, w, h);
    strokeInset(ctx, w, h, 36, "#E9DFCE", 2);
    strokeInset(ctx, w, h, 48, "#C9A86A", 1);
  },
  classic(ctx, w, h) {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    strokeInset(ctx, w, h, 28, "#171717", 8);
    strokeInset(ctx, w, h, 44, "#171717", 2);
  },
  modern(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#242424");
    g.addColorStop(1, "#3a3a3a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#C96F4A";
    ctx.fillRect(0, 0, 18, h);
  },
  academic(ctx, w, h) {
    ctx.fillStyle = "#F7F5F1";
    ctx.fillRect(0, 0, w, h);
    strokeInset(ctx, w, h, 32, "#6b5a3a", 3);
    strokeInset(ctx, w, h, 44, "#6b5a3a", 1);
    strokeInset(ctx, w, h, 52, "#6b5a3a", 1);
  },
  minimal(ctx, w, h) {
    ctx.fillStyle = "#FAFAF8";
    ctx.fillRect(0, 0, w, h);
    strokeInset(ctx, w, h, 40, "#E5E1DA", 1);
  },
  formal(ctx, w, h) {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    strokeInset(ctx, w, h, 30, "#171717", 10);
    strokeInset(ctx, w, h, 50, "#171717", 1.5);
  },
  bold(ctx, w, h) {
    ctx.fillStyle = "#1A1A1A";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#C96F4A";
    ctx.fillRect(0, 0, 28, h);
    ctx.fillRect(w - 28, 0, 28, h);
  },
  soft(ctx, w, h) {
    ctx.fillStyle = "#F6EFE6";
    ctx.fillRect(0, 0, w, h);
    strokeInset(ctx, w, h, 42, "#E4D5C1", 1.5);
  },
  contemporary(ctx, w, h) {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#C96F4A";
    ctx.fillRect(0, 0, w, 22);
    strokeInset(ctx, w, h, 0, "#E5E1DA", 2);
  },
  heritage(ctx, w, h) {
    ctx.fillStyle = "#FBF6EC";
    ctx.fillRect(0, 0, w, h);
    strokeInset(ctx, w, h, 28, "#8a6a3a", 3);
    strokeInset(ctx, w, h, 40, "#8a6a3a", 1);
    const corner = 22;
    const inset = 52;
    ctx.fillStyle = "#8a6a3a";
    for (const [x, y] of [
      [inset, inset],
      [w - inset - corner, inset],
      [inset, h - inset - corner],
      [w - inset - corner, h - inset - corner],
    ] as const) {
      ctx.fillRect(x, y, corner, 3);
      ctx.fillRect(x, y, 3, corner);
      ctx.fillRect(x + corner - 3, y, 3, corner);
      ctx.fillRect(x, y + corner - 3, corner, 3);
    }
  },
};

export function paintStarterCanvas(starter: StarterTemplate): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = starter.width;
  canvas.height = starter.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create starter background");
  PAINT[starter.preview](ctx, starter.width, starter.height);
  return canvas;
}

export async function paintStarterBackgroundFile(starter: StarterTemplate): Promise<File> {
  const canvas = paintStarterCanvas(starter);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not create background"))),
      "image/png",
    );
  });
  return new File([blob], `${starter.id}.png`, { type: "image/png" });
}

/** Prefer a dropped-in public PNG; fall back to a painted placeholder. */
export async function resolveStarterBackgroundFile(starter: StarterTemplate): Promise<File> {
  try {
    const res = await fetch(starter.backgroundSrc, { cache: "no-cache" });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0 && blob.type.startsWith("image/")) {
        const name = starter.backgroundSrc.split("/").pop() || `${starter.id}.png`;
        return new File([blob], name, { type: blob.type || "image/png" });
      }
    }
  } catch {
    // File not added yet — use the painted stand-in.
  }
  return paintStarterBackgroundFile(starter);
}
