import { Stage, Layer, Image as KonvaImage, Text, Rect, Group } from "react-konva";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FieldConfig } from "../lib/api";

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
    // crossOrigin breaks some blob: loads; only set for http(s)
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
  if (label) return label;
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

interface CanvasEditorProps {
  width: number;
  height: number;
  backgroundUrl: string | null;
  fields: FieldConfig[];
  values: Record<string, string>;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onChangeField: (key: string, patch: Partial<FieldConfig>) => void;
}

export function CanvasEditor({
  width,
  height,
  backgroundUrl,
  fields,
  values,
  selectedKey,
  onSelect,
  onChangeField,
}: CanvasEditorProps) {
  const { image, failed } = useHtmlImage(backgroundUrl);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const update = () => {
      const available = Math.max(200, el.clientWidth - 8);
      setScale(Math.min(1, available / width));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width, height]);

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
              <KonvaImage image={image} x={0} y={0} width={width} height={height} />
            ) : (
              <Rect x={0} y={0} width={width} height={height} fill="#fbfbf7" />
            )}

            {fields.map((field) => {
              const filled = (values[field.key] || "").trim();
              const isEmpty = !filled;
              const selected = selectedKey === field.key;
              // Optional fields (everything except student name) stay off the
              // preview until typed or selected — matches final render behavior.
              const alwaysShowPlaceholder = field.key === "student_name";
              if (isEmpty && !alwaysShowPlaceholder && !selected) return null;

              const label = fieldLabel(field.key, field.label);
              const display = filled || label;
              const textWidth = Math.max(
                Math.round(field.fontSize * 4.5),
                Math.round(display.length * field.fontSize * 0.58),
              );
              const x =
                field.textAlign === "center"
                  ? field.x - textWidth / 2
                  : field.textAlign === "right"
                    ? field.x - textWidth
                    : field.x;
              const y = field.y - field.fontSize;

              return (
                <Group
                  key={field.key}
                  x={x}
                  y={y}
                  draggable
                  onClick={() => onSelect(field.key)}
                  onTap={() => onSelect(field.key)}
                  onDragEnd={(e) => {
                    const node = e.target;
                    const nx = node.x();
                    const ny = node.y();
                    const anchorX =
                      field.textAlign === "center"
                        ? nx + textWidth / 2
                        : field.textAlign === "right"
                          ? nx + textWidth
                          : nx;
                    onChangeField(field.key, {
                      x: Math.round(anchorX),
                      y: Math.round(ny + field.fontSize),
                    });
                  }}
                >
                  {selected && (
                    <Rect
                      x={-10}
                      y={-8}
                      width={textWidth + 20}
                      height={field.fontSize + 22}
                      stroke="#d97757"
                      strokeWidth={Math.max(2, 2 / scale)}
                      cornerRadius={6}
                      fill="rgba(217, 119, 87, 0.08)"
                    />
                  )}
                  {isEmpty && (
                    <Rect
                      x={0}
                      y={field.fontSize + 4}
                      width={textWidth}
                      height={Math.max(2, Math.round(field.fontSize * 0.06))}
                      fill="rgba(11, 11, 11, 0.28)"
                      cornerRadius={1}
                    />
                  )}
                  <Text
                    text={display}
                    fontSize={field.fontSize}
                    fill={isEmpty ? "rgba(11, 11, 11, 0.35)" : field.fontColor}
                    fontFamily={
                      field.fontFamily || "Instrument Sans, Avenir Next, sans-serif"
                    }
                    fontStyle={field.fontWeight === "bold" ? "bold" : "normal"}
                    align={field.textAlign}
                    width={textWidth}
                    listening={false}
                  />
                </Group>
              );
            })}
          </Layer>
        </Stage>
      </div>
      {!backgroundUrl && (
        <p className="canvas-hint muted">Upload a background to see it here. You can still place text now.</p>
      )}
      {backgroundUrl && failed && (
        <p className="canvas-hint muted">Could not load the background image. Try uploading again.</p>
      )}
    </div>
  );
}
