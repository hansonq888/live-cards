// Stat formulas as real maths (KaTeX). The symbols match the registry's settings, which are
// listed underneath with the values the engine uses.
import katex from "katex";
import "katex/dist/katex.min.css";

export const FORMULA_TEX: Record<string, string> = {
  xg: String.raw`\text{xG} = \dfrac{1}{1 + e^{-(\beta_0 \,+\, \beta_\theta\,\theta \,+\, \beta_d\, d)}}`,
  pass_difficulty: String.raw`\text{difficulty} = 1 + \min\!\left(4, \tfrac{\text{distance}}{10}\right) + \min\!\left(2, \tfrac{\text{gain}}{15}\right) + p + f + c`,
  space_control: String.raw`\text{control} = \dfrac{1}{1 + e^{-(t_{\text{them}} - t_{\text{us}})/\sigma}}, \qquad t = t_{\text{react}} + \dfrac{\text{distance}}{v_{\max}}`,
  sprints: String.raw`\text{sprint: } v \ge 25.2\ \text{km/h}, \qquad \text{high intensity: } v \ge 19.8\ \text{km/h}, \qquad \text{held} \ge 1\,\text{s}`,
  rating: String.raw`\text{rating} = 6.0 + \sum_{\text{events}} w_{\text{event}}, \qquad 3.0 \le \text{rating} \le 10.0`,
};

export const FORMULA_KEY: Record<string, string> = {
  xg: "θ = angle of the goal mouth from the shot, d = distance to goal, β = weights",
  pass_difficulty: "p = under pressure, f = into the final third, c = cross or through ball",
  space_control: "t = time for a player to reach a spot, σ = how decisive a head start is",
  sprints: "",
  rating: "w = the weight of each event (goal, assist, tackle…)",
};

export function Formula({ id, fallback }: { id: string; fallback: string }) {
  const tex = FORMULA_TEX[id];
  if (!tex) return <code>{fallback}</code>;
  const html = katex.renderToString(tex, { displayMode: true, throwOnError: false });
  return (
    <div className="formula">
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {FORMULA_KEY[id] && <p className="formula-key">{FORMULA_KEY[id]}</p>}
    </div>
  );
}
