// ?page=avatars: every player's avatar, with and without the background (for checking cut-outs).
import { useSummary } from "./summary";
import { Avatar } from "../ui/Avatar";

export function AvatarSheet() {
  const s = useSummary();
  if (!s) return null;
  const colour = (c: string) => (c === s.meta.home.code ? s.meta.home.color : s.meta.away.color);
  return (
    <div className="av-sheet">
      {s.players.slice(0, 8).map((p) => (
        <figure key={p.id}>
          <div className="av-pair">
            <Avatar player={p} color={colour(p.team)} size={120} />
            <div className="av-checker"><Avatar player={p} color={colour(p.team)} size={120} bare /></div>
          </div>
          <figcaption>{p.short}</figcaption>
        </figure>
      ))}
    </div>
  );
}
