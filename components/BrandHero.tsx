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
      {/* デザイン版ヒーロー画像に差し替え。画像タップ2回で本部管理(HQ)へ（隠し扉①は維持） */}
      <img
        src="/brand-hero.jpg"
        alt="FIGHT READY ― 落とすだけでは、勝てない。一人で戦わない。チームで、仕上げる。体重・トレーニング・疲労・回復を、チームでひとつに。"
        onClick={onLogo}
        className="brand-hero-img"
        draggable={false}
        style={{ userSelect: "none", cursor: "pointer" }}
      />
    </div>
  );
}
