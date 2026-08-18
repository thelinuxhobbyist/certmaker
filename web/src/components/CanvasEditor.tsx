import { Stage, Layer, Image as KonvaImage, Text, Rect, Group, Transformer } from "react-konva";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type Konva from "konva";
import {
  isImageField,
  isTextField,
  type FieldConfig,
} from "../lib/api";
import { DEFAULT_FONT_FAMILY } from "../lib/fonts";

function useHtmlImage(url: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url) {
      setImage(null);
      setFailed(false);
      return;
    }

    let cancelled = false;
    const img = new window.Image();
    if (/^https?:/i.test(url)) {
      img.crossOrigin = "anonymous";
    }

    img.onload = () => {
      if (!cancelled) {
        setImage(img);
        setFailed(false);
      }
    };
    img.onerror = () => {
      if (!cancelled) {
        setImage(null);
        setFailed(true);
      }
    };
    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { image, failed };
}

export function fieldLabel(key: string, label?: string): string {
  if (label?.trim()) return label.trim();
  if (key.startsWith("custom_")) return "New field";
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

interface CanvasEditorProps {
  width: number;
  height: number;
  backgroundUrl: string | null;
  /** Solid fill while a starter has no uploaded/painted image yet. */
  backgroundFill?: string;
  fields: FieldConfig[];
  values: Record<string, string>;
  /** Local/object URLs for image fields keyed by field.key */
  imageUrls?: Record<string, string | null>;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onChangeField: (key: string, patch: Partial<FieldConfig>) => void;
  /** Multiplier on top of fit-to-pane scale. */
  zoom?: number;
}

function LogoNode({
  field,
  url,
  selected,
  scale,
  onSelect,
  onChangeField,
}: {
  field: FieldConfig;
  url: string | null;
  selected: boolean;
  scale: number;
  onSelect: (key: string) => void;
  onChangeField: (key: string, patch: Partial<FieldConfig>) => void;
}) {
  const { image } = useHtmlImage(url);
  const shapeRef = useRef<Konva.Image>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const w = field.width ?? 160;
  const h = field.height ?? 80;

  useEffect(() => {
    if (!selected || !shapeRef.current || !trRef.current) return;
    trRef.current.nodes([shapeRef.current]);
    trRef.current.getLayer()?.batchDraw();
  }, [selected, w, h, image]);

  if (!image && !selected) return null;

  return (
    <>
      <KonvaImage
        ref={shapeRef}
        image={image ?? undefined}
        x={field.x}
        y={field.y}
        width={w}
        height={h}
        draggable
        onMouseDown={() => onSelect(field.key)}
        onTouchStart={() => onSelect(field.key)}
        onClick={() => onSelect(field.key)}
        onTap={() => onSelect(field.key)}
        onDragStart={() => onSelect(field.key)}
        onDragEnd={(e) => {
          onChangeField(field.key, {
            x: Math.round(e.target.x()),
            y: Math.round(e.target.y()),
          });
        }}
        onTransformEnd={() => {
          const node = shapeRef.current;
          if (!node) return;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChangeField(field.key, {
            x: Math.round(node.x()),
            y: Math.round(node.y()),
            width: Math.max(40, Math.round(node.width() * scaleX)),
            height: Math.max(24, Math.round(node.height() * scaleY)),
          });
        }}
      />
      {selected && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
          borderStroke="#c93900"
          anchorStroke="#c93900"
          anchorFill="#fff"
          anchorSize={Math.max(8, 10 / scale)}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 40 || newBox.height < 24) return oldBox;
            return newBox;
          }}
        />
      )}
      {selected && !image && (
        <Rect
          x={field.x}
          y={field.y}
          width={w}
          height={h}
          stroke="#c93900"
          dash={[6, 4]}
          strokeWidth={Math.max(1.5, 2 / scale)}
          fill="rgba(201, 57, 0, 0.08)"
          listening={false}
        />
      )}
    </>
  );
}

function CertTextNode({
  field,
  display,
  placeholder,
  selected,
  scale,
  canvasWidth,
  onSelect,
  onChangeField,
}: {
  field: FieldConfig;
  display: string;
  placeholder: boolean;
  selected: boolean;
  scale: number;
  canvasWidth: number;
  onSelect: (key: string) => void;
  onChangeField: (key: string, patch: Partial<FieldConfig>) => void;
}) {
  const textRef = useRef<Konva.Text>(null);
  const [box, setBox] = useState({ width: 200, height: 48 });
  const fontSize = field.fontSize ?? 40;
  const align = field.textAlign ?? "center";
  const multiline = Boolean(field.multiline) || display.includes("\n");
  const wrapWidth =
    field.maxWidth ??
    (multiline ? Math.round(canvasWidth * 0.7) : undefined);
  const textWidth =
    wrapWidth ??
    Math.max(Math.round(fontSize * 4.5), Math.round(display.length * fontSize * 0.58));

  useLayoutEffect(() => {
    const node = textRef.current;
    if (!node) return;
    setBox({
      width: Math.max(textWidth, node.width()),
      height: Math.max(fontSize, node.height()),
    });
  }, [display, fontSize, textWidth, field.fontFamily, field.fontWeight, wrapWidth]);

  const x =
    align === "center"
      ? field.x - textWidth / 2
      : align === "right"
        ? field.x - textWidth
        : field.x;
  const y = field.y - fontSize;

  function selectThis() {
    onSelect(field.key);
  }

  function setCursor(cursor: string, node: Konva.Node) {
    const stage = node.getStage();
    if (stage) stage.container().style.cursor = cursor;
  }

  return (
    <Group
      x={x}
      y={y}
      draggable
      onMouseDown={selectThis}
      onTouchStart={selectThis}
      onClick={selectThis}
      onTap={selectThis}
      onMouseEnter={(e) => setCursor("grab", e.target)}
      onMouseLeave={(e) => setCursor("default", e.target)}
      onDragStart={(e) => {
        selectThis();
        setCursor("grabbing", e.target);
      }}
      onDragEnd={(e) => {
        const node = e.target;
        const nx = node.x();
        const ny = node.y();
        const anchorX =
          align === "center"
            ? nx + textWidth / 2
            : align === "right"
              ? nx + textWidth
              : nx;
        onChangeField(field.key, {
          x: Math.round(anchorX),
          y: Math.round(ny + fontSize),
        });
        setCursor("grab", node);
      }}
    >
      <Rect
        x={-10}
        y={-8}
        width={box.width + 20}
        height={box.height + 16}
        stroke={selected ? "#c93900" : "transparent"}
        strokeWidth={Math.max(2, 2 / scale)}
        cornerRadius={6}
        fill={selected ? "rgba(201, 57, 0, 0.08)" : "rgba(0,0,0,0.001)"}
      />
      {placeholder && (
        <Rect
          x={0}
          y={fontSize + 4}
          width={textWidth}
          height={Math.max(2, Math.round(fontSize * 0.06))}
          fill="rgba(11, 11, 11, 0.28)"
          cornerRadius={1}
          listening={false}
        />
      )}
      <Text
        ref={textRef}
        text={display}
        fontSize={fontSize}
        fill={placeholder ? "rgba(11, 11, 11, 0.35)" : field.fontColor || "#0b0b0b"}
        fontFamily={field.fontFamily || DEFAULT_FONT_FAMILY}
        fontStyle={field.fontWeight === "bold" ? "bold" : "normal"}
        align={align}
        width={textWidth}
        wrap={multiline ? "word" : "none"}
        lineHeight={multiline ? 1.3 : 1}
      />
    </Group>
  );
}

export function CanvasEditor({
  width,
  height,
  backgroundUrl,
  backgroundFill = "#ffffff",
  fields,
  values,
  imageUrls = {},
  selectedKey,
  onSelect,
  onChangeField,
  zoom = 1,
}: CanvasEditorProps) {
  const { image, failed } = useHtmlImage(backgroundUrl);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const update = () => {
      const availableW = Math.max(200, el.clientWidth - 8);
      const availableH = Math.max(160, el.clientHeight - 8);
      setFitScale(Math.min(1, availableW / width, availableH / height));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width, height]);

  const scale = Math.max(0.2, fitScale * zoom);

  const stageWidth = Math.max(1, Math.round(width * scale));
  const stageHeight = Math.max(1, Math.round(height * scale));
  const pixelRatio =
    typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;

  return (
    <div className="canvas-frame">
      <div className="canvas-wrap" ref={wrapRef}>
        <Stage
          width={stageWidth}
          height={stageHeight}
          scaleX={scale}
          scaleY={scale}
          pixelRatio={pixelRatio}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) onSelect(null);
          }}
        >
          <Layer>
            {image ? (
              <KonvaImage
                image={image}
                x={0}
                y={0}
                width={width}
                height={height}
                listening={false}
              />
            ) : (
              <Rect
                x={0}
                y={0}
                width={width}
                height={height}
                fill={backgroundFill}
                listening={false}
              />
            )}

            {fields.map((field) => {
              if (isImageField(field)) {
                return (
                  <LogoNode
                    key={field.key}
                    field={field}
                    url={imageUrls[field.key] ?? null}
                    selected={selectedKey === field.key}
                    scale={scale}
                    onSelect={onSelect}
                    onChangeField={onChangeField}
                  />
                );
              }

              if (!isTextField(field)) return null;

              const raw = values[field.key] || field.defaultValue || "";
              const filled = raw.trim();
              const selected = selectedKey === field.key;
              const keepPlaceholder =
                field.key === "student_name" ||
                field.key === "cert_title" ||
                (!field.static && field.key !== "issue_date" && field.key !== "cert_id");
              if (!filled && !selected && !keepPlaceholder) return null;

              return (
                <CertTextNode
                  key={field.key}
                  field={field}
                  display={filled || fieldLabel(field.key, field.label) || "New field"}
                  placeholder={!filled}
                  selected={selected}
                  scale={scale}
                  canvasWidth={width}
                  onSelect={onSelect}
                  onChangeField={onChangeField}
                />
              );
            })}
          </Layer>
        </Stage>
      </div>
      {!backgroundUrl && (
        <p className="canvas-hint muted">
          Upload a background to see it here. You can still place text now.
        </p>
      )}
      {backgroundUrl && failed && (
        <p className="canvas-hint muted">
          Could not load the background image. Try uploading again.
        </p>
      )}
    </div>
  );
}
