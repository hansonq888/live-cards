// Broadcast or coach's tablet. In broadcast mode the tablet is a small live map in the corner;
// click it to make it the main view (and the "Broadcast" chip to switch back).
import { live, useLive } from "../live/store";
import { TacticalBoard } from "./TacticalBoard";

export function BoardSwitch() {
  const tactical = useLive((s) => s.tactical);
  return tactical ? (
    <div className="board-main">
      <TacticalBoard />
      <button className="board-chip" onClick={() => live.toggleTactical()}>Broadcast view</button>
    </div>
  ) : (
    <button className="board-mini" onClick={() => live.toggleTactical()} aria-label="Switch to the tactical view">
      <TacticalBoard mini />
      <span>Tactical view</span>
    </button>
  );
}
