import type { Signal } from "@/lib/judge";

const cls: Record<Signal, string> = { green: "sig-green", yellow: "sig-yellow", red: "sig-red", blue: "sig-blue" };
const label: Record<Signal, string> = { green: "READY", yellow: "CAUTION", red: "STOP", blue: "—" };

export function SigBadge({ level, text }: { level: Signal; text?: string }) {
  return <span className={`sig ${cls[level]}`}>{text ?? label[level]}</span>;
}
