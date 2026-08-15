import { useEffect, useRef, useState } from "react";
import { api, type Template } from "../lib/api";
import { uniqueSavedTemplates, savedDesignName } from "../lib/savedTemplates";
import { STARTER_TEMPLATES, type StarterTemplate } from "../lib/starterTemplates";
import { MiniCert } from "./MiniCert";

interface TemplateChooserProps {
  selectedId: string | null;
  onChooseStarter: (starter: StarterTemplate) => void;
  onChooseOwnFile: (file: File) => void;
  onChooseSaved?: (template: Template) => void;
}

export function TemplateChooser({
  selectedId,
  onChooseStarter,
  onChooseOwnFile,
  onChooseSaved,
}: TemplateChooserProps) {
  const [showAll, setShowAll] = useState(false);
  const [saved, setSaved] = useState<Template[]>([]);
  const ownInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .listTemplates()
      .then((res) => setSaved(uniqueSavedTemplates(res.templates)))
      .catch(() => setSaved([]));
  }, []);

  const visible = showAll
    ? STARTER_TEMPLATES
    : STARTER_TEMPLATES.filter((t) => t.featured);

  return (
    <div id="chooser" className="chooser">
      <h1 className="chooser-title">
        Create professional certificates in seconds —{" "}
        <em>individually or in bulk</em>.
      </h1>
      <p className="chooser-sub">
        Pick a design to start from, or bring your own background. You can change
        everything once you&apos;re in the editor.
      </p>
      <p className="chooser-eyebrow">Step 1 of 2</p>

      <div className="template-grid">
        {visible.map((starter) => {
          const selected = selectedId === starter.id;
          return (
            <button
              key={starter.id}
              type="button"
              className={`template-card${selected ? " selected" : ""}`}
              onClick={() => onChooseStarter(starter)}
            >
              {selected && <span className="check">✓</span>}
              <MiniCert starter={starter} />
              <div className="template-name">{starter.name}</div>
              <div className="template-tag">{starter.tag}</div>
            </button>
          );
        })}
      </div>

      <div className="see-all-row">
        <button type="button" className="see-all-link" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer designs" : `See all ${STARTER_TEMPLATES.length} designs →`}
        </button>
      </div>

      <div className="chooser-divider">or</div>

      <button
        type="button"
        className="upload-own"
        onClick={() => ownInputRef.current?.click()}
      >
        <div className="icon" aria-hidden="true">
          ⇧
        </div>
        <div className="label">Use your own design</div>
        <div className="sub">Upload a background image</div>
        <input
          ref={ownInputRef}
          type="file"
          accept="image/*"
          className="file-input-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onChooseOwnFile(file);
            e.target.value = "";
          }}
        />
      </button>

      {onChooseSaved && saved.length > 0 && (
        <section className="saved-designs">
          <h2 className="saved-heading">Your saved designs</h2>
          <div className="saved-list">
            {saved.map((t) => (
              <button
                key={t.id}
                type="button"
                className="saved-card"
                onClick={() => onChooseSaved(t)}
              >
                <img src={t.background_url} alt="" />
                <span>{savedDesignName(t)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
