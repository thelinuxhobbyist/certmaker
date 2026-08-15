import { useEffect, useState } from "react";

export function ZipProgress({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    if (!active) {
      setPercent(0);
      return;
    }
    setPercent(10);
    const id = window.setInterval(() => {
      setPercent((current) => Math.min(92, current + Math.max(0.4, (92 - current) * 0.05)));
    }, 280);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active) return null;

  const shown = Math.round(percent);

  return (
    <div
      className="zip-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={shown}
      aria-label={label}
    >
      <div className="zip-progress-track">
        <div className="zip-progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="zip-progress-label">
        {label} {shown}%
      </p>
    </div>
  );
}
