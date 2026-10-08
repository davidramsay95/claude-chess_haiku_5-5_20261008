import { useState, type ReactElement } from "react";

interface ImportPanelProps {
  readonly onImportText: (text: string) => void;
  readonly onClose: () => void;
}

/** Accepts a saved game as a file or as pasted JSON. Validation happens in the caller. */
export const ImportPanel = ({ onImportText, onClose }: ImportPanelProps): ReactElement => {
  const [text, setText] = useState("");

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (file === undefined) {
      return;
    }
    onImportText(await file.text());
  };

  return (
    <section className="panel" aria-labelledby="import-heading">
      <h2 id="import-heading">Import game</h2>
      <label className="file-input">
        Choose a saved .json file
        <input
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
          }}
        />
      </label>
      <label className="stacked">
        Or paste the saved JSON
        <textarea rows={6} value={text} onChange={(event) => setText(event.target.value)} spellCheck={false} />
      </label>
      <div className="button-row">
        <button type="button" className="primary" onClick={() => onImportText(text)} disabled={text.trim() === ""}>
          Import pasted game
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  );
};
