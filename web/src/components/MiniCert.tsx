import { useState } from "react";
import type { StarterTemplate } from "../lib/starterTemplates";

export function MiniCert({ starter }: { starter: StarterTemplate }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const thumbSrc = starter.thumbnailSrc || starter.backgroundSrc;
  const showImage = Boolean(thumbSrc) && !thumbFailed;

  return (
    <div className={`mini-cert tpl-${starter.preview}`}>
      {showImage && (
        <img
          className="mini-cert-img"
          src={thumbSrc}
          alt=""
          onError={() => setThumbFailed(true)}
        />
      )}
      {!showImage && (
        <>
          <div className="mtitle">
            {starter.fields.find((f) => f.key === "cert_title")?.defaultValue ||
              "CERTIFICATE"}
          </div>
          <div className="mline" />
          <div className="mname">Student Name</div>
        </>
      )}
    </div>
  );
}
