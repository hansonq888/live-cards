// "Your model": analysts set their own rating and attribute weights; the engine runs it beside ours.
import { useEffect, useState } from "react";
import { live, useLive } from "../live/store";
import type { ModelSpec } from "../live/protocol";

interface Defaults { spec: ModelSpec; rating_labels: Record<string, string>; metric_labels: Record<string, Record<string, string>> }

export function YourModelPanel() {
  const ym = useLive((s) => s.yourModel);
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [spec, setSpec] = useState<ModelSpec | null>(null);
  useEffect(() => {
    fetch("/api/model/default").then((r) => r.json()).then((d: Defaults) => {
      setDefaults(d);
      let saved: ModelSpec | null = null;
      try { saved = JSON.parse(localStorage.getItem("livecards.model") || "null"); } catch { saved = null; }
      setSpec(saved ?? { ...d.spec, name: "My model" });
    }).catch(() => setDefaults(null));
  }, []);
  if (!defaults || !spec) return <div className="empty">Loading the default formula…</div>;
  const setW = (k: string, v: number) => setSpec({ ...spec, rating_weights: { ...spec.rating_weights, [k]: v } });
  const setA = (a: string, k: string, v: number) => setSpec({ ...spec, attr_weights: { ...spec.attr_weights, [a]: { ...spec.attr_weights[a], [k]: v } } });
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `${spec.name.replace(/\W+/g, "-").toLowerCase() || "model"}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const upload = (f: File) => f.text().then((t) => { try { setSpec(JSON.parse(t)); } catch { alert("That file isn't valid JSON."); } });
  return (
    <div className="ymodel">
      <p className="ym-intro">Disagree with our formula? Set your own weights. Your model runs on the same events next to ours, and the Analyst card shows both ratings with their working. A model is data, not code, so it's safe to share.</p>
      <div className="ym-row"><input className="ym-name" value={spec.name} maxLength={60} onChange={(e) => setSpec({ ...spec, name: e.target.value })} /></div>
      <div className="ym-h">Rating: change per event</div>
      {Object.entries(defaults.rating_labels).map(([k, label]) => (
        <label key={k} className="ym-w">
          <span>{label}</span>
          <input type="range" min={-1.5} max={2} step={0.01} value={spec.rating_weights[k] ?? defaults.spec.rating_weights[k]} onChange={(e) => setW(k, Number(e.target.value))} />
          <b className={(spec.rating_weights[k] ?? 0) !== defaults.spec.rating_weights[k] ? "changed" : ""}>{(spec.rating_weights[k] ?? defaults.spec.rating_weights[k]).toFixed(2)}</b>
        </label>
      ))}
      <div className="ym-h">Attributes: metric weights (re-normalized)</div>
      {Object.entries(defaults.metric_labels).map(([a, metrics]) => (
        <div key={a} className="ym-attr">
          <div className="ym-attr-name">{a}</div>
          {Object.entries(metrics).map(([k, label]) => (
            <label key={k} className="ym-w">
              <span>{label}</span>
              <input type="range" min={0} max={1} step={0.05} value={spec.attr_weights[a]?.[k] ?? defaults.spec.attr_weights[a][k]} onChange={(e) => setA(a, k, Number(e.target.value))} />
              <b>{(spec.attr_weights[a]?.[k] ?? defaults.spec.attr_weights[a][k]).toFixed(2)}</b>
            </label>
          ))}
        </div>
      ))}
      <div className="ym-actions">
        <button className="primary" onClick={() => live.applyModel(spec)}>Run my model</button>
        <button onClick={() => { setSpec({ ...defaults.spec, name: "My model" }); }}>Reset</button>
        <button onClick={() => live.applyModel(null)}>Turn off</button>
        <button onClick={download}>Download JSON</button>
        <label className="ym-upload">Upload JSON<input type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
      </div>
      <div className={`ym-status s-${ym.status}`}>
        {ym.status === "building" && "Replaying the match so far with your model…"}
        {ym.status === "ready" && `“${ym.name}” is live. Switch to Analyst to compare.`}
        {ym.status === "error" && `Rejected: ${ym.error}`}
        {ym.status === "off" && "Using the Footnote formula only."}
      </div>
    </div>
  );
}
