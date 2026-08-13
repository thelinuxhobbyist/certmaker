import type { FieldConfig } from "./api";
import { DEFAULT_FONT_FAMILY, TITLE_FONT_FAMILY } from "./fonts";

/**
 * Built-in starter designs (10 slots).
 *
 * Real artwork is optional. Drop PNGs into `web/public/starters/`:
 *   {id}.png         — full background (typically 1200×850)
 *   {id}-thumb.png   — optional chooser thumbnail
 * Paths below already point there. Until a file exists, the chooser
 * uses a CSS mini-preview and the editor paints a matching placeholder.
 */
export const STARTER_CANVAS = { width: 1200, height: 850 } as const;

export type StarterPreviewKind =
  | "elegant"
  | "classic"
  | "modern"
  | "academic"
  | "minimal"
  | "formal"
  | "bold"
  | "soft"
  | "contemporary"
  | "heritage";

export interface StarterTemplate {
  id: string;
  name: string;
  tag: string;
  preview: StarterPreviewKind;
  featured: boolean;
  /** Public URL; 404 is fine until the file is added. */
  backgroundSrc: string;
  thumbnailSrc: string;
  width: number;
  height: number;
  backgroundColor: string;
  title: string;
  fields: FieldConfig[];
}

function fields(opts: {
  titleFont: string;
  titleColor: string;
  titleSize?: number;
  nameFont: string;
  nameColor: string;
  nameSize?: number;
  bodyFont?: string;
  bodyColor?: string;
  heading?: string;
}): FieldConfig[] {
  const heading = opts.heading ?? "Certificate of Achievement";
  const bodyFont = opts.bodyFont ?? opts.nameFont;
  const bodyColor = opts.bodyColor ?? opts.nameColor;
  return [
    {
      key: "cert_title",
      label: "Certificate title",
      type: "text",
      static: true,
      defaultValue: heading,
      x: 600,
      y: 220,
      fontSize: opts.titleSize ?? 56,
      fontColor: opts.titleColor,
      fontFamily: opts.titleFont,
      textAlign: "center",
      fontWeight: "bold",
    },
    {
      key: "student_name",
      label: "Student name",
      type: "text",
      x: 600,
      y: 400,
      fontSize: opts.nameSize ?? 64,
      fontColor: opts.nameColor,
      fontFamily: opts.nameFont,
      textAlign: "center",
      fontWeight: "bold",
    },
    {
      key: "issue_date",
      label: "Issue date",
      type: "text",
      x: 600,
      y: 620,
      fontSize: 28,
      fontColor: bodyColor,
      fontFamily: bodyFont,
      textAlign: "center",
      fontWeight: "normal",
    },
    {
      key: "cert_id",
      label: "Certificate ID",
      type: "text",
      x: 600,
      y: 700,
      fontSize: 22,
      fontColor: bodyColor,
      fontFamily: bodyFont,
      textAlign: "center",
      fontWeight: "normal",
    },
  ];
}

const W = STARTER_CANVAS.width;
const H = STARTER_CANVAS.height;

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "elegant",
    name: "Elegant",
    tag: "Serif · gold rule",
    preview: "elegant",
    featured: true,
    backgroundSrc: "/starters/elegant.png",
    thumbnailSrc: "/starters/elegant-thumb.png",
    width: W,
    height: H,
    backgroundColor: "#FFFDF9",
    title: "Elegant",
    fields: fields({
      titleFont: TITLE_FONT_FAMILY,
      titleColor: "#3c2e17",
      nameFont: "Cormorant Garamond Light",
      nameColor: "#5b4a2f",
      bodyFont: TITLE_FONT_FAMILY,
      bodyColor: "#8a6a3a",
    }),
  },
  {
    id: "classic",
    name: "Classic",
    tag: "Bordered · formal",
    preview: "classic",
    featured: true,
    backgroundSrc: "/starters/classic.png",
    thumbnailSrc: "/starters/classic-thumb.png",
    width: W,
    height: H,
    backgroundColor: "#FFFFFF",
    title: "Classic",
    fields: fields({
      heading: "Certificate",
      titleFont: "Lora",
      titleColor: "#171717",
      titleSize: 52,
      nameFont: "Lora",
      nameColor: "#171717",
      bodyFont: "Lora",
      bodyColor: "#171717",
    }),
  },
  {
    id: "modern",
    name: "Modern",
    tag: "Dark · bold accent",
    preview: "modern",
    featured: true,
    backgroundSrc: "/starters/modern.png",
    thumbnailSrc: "/starters/modern-thumb.png",
    width: W,
    height: H,
    backgroundColor: "#242424",
    title: "Modern",
    fields: fields({
      heading: "Achievement",
      titleFont: DEFAULT_FONT_FAMILY,
      titleColor: "#C96F4A",
      titleSize: 48,
      nameFont: DEFAULT_FONT_FAMILY,
      nameColor: "#e8e5df",
      nameSize: 56,
      bodyFont: DEFAULT_FONT_FAMILY,
      bodyColor: "#c2beb6",
    }),
  },
  {
    id: "academic",
    name: "Academic",
    tag: "Double rule · seal",
    preview: "academic",
    featured: true,
    backgroundSrc: "/starters/academic.png",
    thumbnailSrc: "/starters/academic-thumb.png",
    width: W,
    height: H,
    backgroundColor: "#F7F5F1",
    title: "Academic",
    fields: fields({
      heading: "Certificate",
      titleFont: "Cormorant Garamond Light",
      titleColor: "#4a3d24",
      nameFont: "Cormorant Garamond Light",
      nameColor: "#4a3d24",
      bodyFont: "Lora",
      bodyColor: "#6b5a3a",
    }),
  },
  {
    id: "minimal",
    name: "Minimal",
    tag: "Clean · open space",
    preview: "minimal",
    featured: false,
    backgroundSrc: "/starters/minimal.png",
    thumbnailSrc: "/starters/minimal-thumb.png",
    width: W,
    height: H,
    backgroundColor: "#FAFAF8",
    title: "Minimal",
    fields: fields({
      titleFont: DEFAULT_FONT_FAMILY,
      titleColor: "#171717",
      titleSize: 44,
      nameFont: DEFAULT_FONT_FAMILY,
      nameColor: "#242424",
      nameSize: 52,
      bodyFont: DEFAULT_FONT_FAMILY,
      bodyColor: "#73706B",
    }),
  },
  {
    id: "formal",
    name: "Formal",
    tag: "Traditional · centered",
    preview: "formal",
    featured: false,
    backgroundSrc: "/starters/formal.png",
    thumbnailSrc: "/starters/formal-thumb.png",
    width: W,
    height: H,
    backgroundColor: "#FFFFFF",
    title: "Formal",
    fields: fields({
      titleFont: "Lora",
      titleColor: "#171717",
      nameFont: TITLE_FONT_FAMILY,
      nameColor: "#171717",
      bodyFont: "Lora",
      bodyColor: "#242424",
    }),
  },
  {
    id: "bold",
    name: "Bold",
    tag: "Strong type · high contrast",
    preview: "bold",
    featured: false,
    backgroundSrc: "/starters/bold.png",
    thumbnailSrc: "/starters/bold-thumb.png",
    width: W,
    height: H,
    backgroundColor: "#1A1A1A",
    title: "Bold",
    fields: fields({
      heading: "Certificate of Achievement",
      titleFont: DEFAULT_FONT_FAMILY,
      titleColor: "#FFFFFF",
      titleSize: 48,
      nameFont: DEFAULT_FONT_FAMILY,
      nameColor: "#F7F5F1",
      nameSize: 58,
      bodyFont: DEFAULT_FONT_FAMILY,
      bodyColor: "#C96F4A",
    }),
  },
  {
    id: "soft",
    name: "Soft",
    tag: "Warm · light serif",
    preview: "soft",
    featured: false,
    backgroundSrc: "/starters/soft.png",
    thumbnailSrc: "/starters/soft-thumb.png",
    width: W,
    height: H,
    backgroundColor: "#F6EFE6",
    title: "Soft",
    fields: fields({
      titleFont: "Cormorant Garamond Light",
      titleColor: "#5b4a2f",
      nameFont: "Cormorant Garamond Light",
      nameColor: "#3c2e17",
      bodyFont: "Lora",
      bodyColor: "#8a6a3a",
    }),
  },
  {
    id: "contemporary",
    name: "Contemporary",
    tag: "Sans · geometric accent",
    preview: "contemporary",
    featured: false,
    backgroundSrc: "/starters/contemporary.png",
    thumbnailSrc: "/starters/contemporary-thumb.png",
    width: W,
    height: H,
    backgroundColor: "#FFFFFF",
    title: "Contemporary",
    fields: fields({
      heading: "Certificate of Achievement",
      titleFont: DEFAULT_FONT_FAMILY,
      titleColor: "#171717",
      titleSize: 46,
      nameFont: TITLE_FONT_FAMILY,
      nameColor: "#171717",
      bodyFont: DEFAULT_FONT_FAMILY,
      bodyColor: "#73706B",
    }),
  },
  {
    id: "heritage",
    name: "Heritage",
    tag: "Ornate · classic seal",
    preview: "heritage",
    featured: false,
    backgroundSrc: "/starters/heritage.png",
    thumbnailSrc: "/starters/heritage-thumb.png",
    width: W,
    height: H,
    backgroundColor: "#FBF6EC",
    title: "Heritage",
    fields: fields({
      titleFont: TITLE_FONT_FAMILY,
      titleColor: "#3c2e17",
      nameFont: "Lora",
      nameColor: "#4a3d24",
      bodyFont: "Lora",
      bodyColor: "#6b5a3a",
    }),
  },
];

export function getStarterTemplate(id: string): StarterTemplate | undefined {
  return STARTER_TEMPLATES.find((t) => t.id === id);
}

export function featuredStarters(): StarterTemplate[] {
  return STARTER_TEMPLATES.filter((t) => t.featured);
}
