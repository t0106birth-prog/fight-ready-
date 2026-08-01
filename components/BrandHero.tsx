"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";

/** 隠し扉①：FIGHT READY ロゴを2回タップすると本部管理(HQ)へ。 */
export function BrandHero() {
  const router = useRouter();
  const taps = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onLogo = () => {
    taps.current += 1;
    if (timer.current) clearTimeout(timer.current);
    if (taps.current >= 2) {
      taps.current = 0;
      router.push("/hq");
      return;
    }
    timer.current = setTimeout(() => { taps.current = 0; }, 700);
  };

  return (
    <div className="brand-hero">
      <div className="brand-logo" onClick={onLogo} style={{ userSelect: "none" }}>
        FIGHT <span className="r">READY</span>
      </div>
      <div className="brand-tag">落とすだけでは、勝てない。</div>
      <div className="brand-sub" style={{ color: "var(--ink)", fontWeight: 800, fontSize: 17, marginTop: 10 }}>
        一人で戦わない。<span style={{ color: "var(--red-bright)" }}>チームで、仕上げる。</span>
      </div>
      <div className="brand-sub">体重・トレーニング・疲労・回復を、チームでひとつに。</div>
      <div className="brand-en">MAKE WEIGHT. STAY STRONG. FIGHT READY.</div>
    </div>
  );
}
