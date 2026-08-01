import type { Tile } from "@/lib/derive";

const toneClass: Record<string, string> = {
  green: "tile-green", yellow: "tile-yellow", red: "tile-red", blue: "tile-blue",
};

export function StatusTile({ tile }: { tile: Tile }) {
  const ready = tile.lbl === "FIGHT READY" || tile.lbl === "BODY READY";
  return (
    <div className={`status-tile ${toneClass[tile.tone]} ${ready ? "ready-tile" : ""}`}>
      <div className="lbl">{tile.lbl}</div>
      <div className="val">{tile.val}</div>
    </div>
  );
}
