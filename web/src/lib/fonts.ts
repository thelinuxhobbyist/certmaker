/** Curated open-source certificate fonts (OFL). Family names must match TTF metadata used by resvg. */
export const CERT_FONTS = [
  {
    id: "noto-sans",
    family: "Noto Sans",
    label: "Noto Sans",
    file: "NotoSans-Regular.ttf",
    kind: "sans" as const,
  },
  {
    id: "montserrat",
    // Subsetted file ships as "Montserrat Thin" — must match resvg name table.
    family: "Montserrat Thin",
    label: "Montserrat",
    file: "Montserrat-Regular.ttf",
    kind: "sans" as const,
  },
  {
    id: "lora",
    family: "Lora",
    label: "Lora",
    file: "Lora-Regular.ttf",
    kind: "serif" as const,
  },
  {
    id: "playfair-display",
    family: "Playfair Display",
    label: "Playfair Display",
    file: "PlayfairDisplay-Regular.ttf",
    kind: "display" as const,
  },
  {
    id: "cormorant-garamond",
    // Subsetted file ships as "Cormorant Garamond Light".
    family: "Cormorant Garamond Light",
    label: "Cormorant Garamond",
    file: "CormorantGaramond-Regular.ttf",
    kind: "display" as const,
  },
  {
    id: "great-vibes",
    family: "Great Vibes",
    label: "Great Vibes",
    file: "GreatVibes-Regular.ttf",
    kind: "script" as const,
  },
] as const;

export type CertFontFamily = (typeof CERT_FONTS)[number]["family"];

export const DEFAULT_FONT_FAMILY: CertFontFamily = "Noto Sans";
export const TITLE_FONT_FAMILY: CertFontFamily = "Playfair Display";

export function isCertFontFamily(value: string | undefined): value is CertFontFamily {
  return CERT_FONTS.some((f) => f.family === value);
}

/** Load local TTFs once so Konva preview matches generated certificates. */
let fontsReady: Promise<void> | null = null;

export function ensureCertFontsLoaded(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (fontsReady) return fontsReady;

  fontsReady = (async () => {
    await Promise.all(
      CERT_FONTS.map(async (font) => {
        const face = new FontFace(font.family, `url(/fonts/${font.file})`);
        await face.load();
        document.fonts.add(face);
      }),
    );
  })().catch((err) => {
    fontsReady = null;
    throw err;
  });

  return fontsReady;
}
