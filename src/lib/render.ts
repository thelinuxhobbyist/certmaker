import { PDFDocument } from "pdf-lib";
import { Resvg } from "@cf-wasm/resvg/workerd";
import type { CustomData, FieldConfig } from "./types";
import { isImageField, isTextField } from "./types";
import { escapeXml } from "./ids";

import notoSans from "../../assets/fonts/NotoSans-Regular.ttf";
import montserrat from "../../assets/fonts/Montserrat-Regular.ttf";
import lora from "../../assets/fonts/Lora-Regular.ttf";
import playfair from "../../assets/fonts/PlayfairDisplay-Regular.ttf";
import cormorant from "../../assets/fonts/CormorantGaramond-Regular.ttf";
import greatVibes from "../../assets/fonts/GreatVibes-Regular.ttf";

const FONT_BUFFERS = [
  new Uint8Array(notoSans),
  new Uint8Array(montserrat),
  new Uint8Array(lora),
  new Uint8Array(playfair),
  new Uint8Array(cormorant),
  new Uint8Array(greatVibes),
];

function anchorForAlign(align: FieldConfig["textAlign"]): string {
  if (align === "center") return "middle";
  if (align === "right") return "end";
  return "start";
}

/** Merge static defaultValue into per-cert data (title, org name, etc.). */
export function mergeStaticFieldData(
  fields: FieldConfig[],
  data: CustomData,
): CustomData {
  const out: CustomData = { ...data };
  for (const field of fields) {
    if (!isTextField(field) || !field.static) continue;
    const current = (out[field.key] || "").trim();
    if (!current && field.defaultValue?.trim()) {
      out[field.key] = field.defaultValue.trim();
    }
  }
  return out;
}

export function buildCertificateSvg(opts: {
  width: number;
  height: number;
  backgroundDataUrl: string;
  fields: FieldConfig[];
  data: CustomData;
  /** Map of image_r2_key → data URL for logo overlays. */
  imageDataUrls?: Record<string, string>;
}): string {
  const { width, height, backgroundDataUrl, fields, data, imageDataUrls = {} } =
    opts;

  const nodes = fields
    .map((field) => {
      if (isImageField(field)) {
        const key = field.image_r2_key;
        if (!key) return "";
        const href = imageDataUrls[key];
        if (!href) return "";
        const w = field.width ?? 160;
        const h = field.height ?? 80;
        return `<image href="${href}" x="${field.x}" y="${field.y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
      }

      if (!isTextField(field)) return "";

      const raw = data[field.key] ?? "";
      if (!String(raw).trim()) return "";
      const value = escapeXml(String(raw));
      const anchor = anchorForAlign(field.textAlign ?? "center");
      const weight = field.fontWeight === "bold" ? "700" : "400";
      const family = escapeXml(field.fontFamily || "Noto Sans");
      const size = field.fontSize ?? 40;
      const color = escapeXml(field.fontColor || "#0b0b0b");
      return `<text x="${field.x}" y="${field.y}" fill="${color}" font-size="${size}" font-family="${family}" font-weight="${weight}" text-anchor="${anchor}">${value}</text>`;
    })
    .filter(Boolean)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <image href="${backgroundDataUrl}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>
  ${nodes}
</svg>`;
}

export async function renderPngFromSvg(svg: string): Promise<Uint8Array> {
  const resvg = await Resvg.async(svg, {
    fitTo: { mode: "original" },
    font: {
      fontBuffers: FONT_BUFFERS,
      defaultFontFamily: "Noto Sans",
      loadSystemFonts: false,
    },
  });
  const rendered = resvg.render();
  const png = rendered.asPng();
  rendered.free();
  resvg.free();
  return png;
}

export async function pngToPdf(
  pngBytes: Uint8Array,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(pngBytes);
  const page = pdf.addPage([width, height]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width,
    height,
  });
  return pdf.save();
}

export function arrayBufferToDataUrl(
  buffer: ArrayBuffer,
  contentType: string,
): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}
