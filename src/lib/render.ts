import { PDFDocument } from "pdf-lib";
import { Resvg } from "@cf-wasm/resvg/workerd";
import type { CustomData, FieldConfig } from "./types";
import { escapeXml } from "./ids";

// Wrangler Data module — imported as ArrayBuffer
import fontBuffer from "../../assets/fonts/NotoSans-Regular.ttf";

function anchorForAlign(align: FieldConfig["textAlign"]): string {
  if (align === "center") return "middle";
  if (align === "right") return "end";
  return "start";
}

export function buildCertificateSvg(opts: {
  width: number;
  height: number;
  backgroundDataUrl: string;
  fields: FieldConfig[];
  data: CustomData;
}): string {
  const { width, height, backgroundDataUrl, fields, data } = opts;

  const textNodes = fields
    .map((field) => {
      const raw = data[field.key] ?? "";
      const value = escapeXml(String(raw));
      const anchor = anchorForAlign(field.textAlign);
      const weight = field.fontWeight === "bold" ? "700" : "400";
      const family = escapeXml(field.fontFamily || "Noto Sans");
      return `<text x="${field.x}" y="${field.y}" fill="${escapeXml(field.fontColor)}" font-size="${field.fontSize}" font-family="${family}" font-weight="${weight}" text-anchor="${anchor}">${value}</text>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <image href="${backgroundDataUrl}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>
  ${textNodes}
</svg>`;
}

export async function renderPngFromSvg(svg: string): Promise<Uint8Array> {
  const resvg = await Resvg.async(svg, {
    fitTo: { mode: "original" },
    font: {
      fontBuffers: [new Uint8Array(fontBuffer)],
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
