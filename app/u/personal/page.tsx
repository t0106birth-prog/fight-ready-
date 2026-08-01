import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { Hero, UserTabbar } from "@/components/Nav";
import { SubmitButton } from "@/components/SubmitButton";
import { requestPtTrialAction } from "@/app/u/actions";
import { daysBetween, round1, todayStr } from "@/lib/calc";

export default async function PersonalPage({ searchParams }: { searchParams: Promise<{ requested?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user || user.role === "staff") redirect("/");
  if (user.role === "pro") redirect("/u"); // パーソナルは選手には提供しない
  const db = await getDb();

  const camp = db.camps.find((c) => c.userId === user.id && c.status === "active");
  const inquiry = db.ptInquiries.find((i) => i.userId === user.id && (i.status === "wanted" || i.status === "contacted"));

  return (
    <>
      <Hero title="パーソナル・キャンプ" sub="キャンプ進捗とパーソナル体験" backHref="/u" />
      <div className="shell">
        {sp.requested && <div className="alert-band alert-green"><b>✓</b> 体験希望を受け付けました。ジムスタッフからご案内します。</div>}

        {/* キャンプ */}
        {camp && (() => {
          const total = Math.max(1, daysBetween(camp.startDate, camp.endDate));
          const elapsed = Math.min(total, Math.max(0, daysBetween(camp.startDate, todayStr())));
          const prog = Math.round((elapsed / total) * 100);
          const cw = db.dailyCheckins.filter((c) => c.userId === user.id && c.weight != null).sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.weight;
          const remain = cw != null && camp.targetWeight != null ? round1(cw - camp.targetWeight) : null;
          return (
            <>
              <p className="kicker">FIGHT CAMP</p>
              <div className="card">
                <b>{camp.name}</b>
                <div className="progress-row"><span>{elapsed}日目</span><b>進捗 {prog}%</b></div>
                {remain != null && <div className="progress-row"><span>目標まで</span><b>残り {remain > 0 ? remain : 0}kg</b></div>}
                {camp.targetWorkoutCount && <div className="progress-row"><span>今週の運動目標</span><b>{camp.targetWorkoutCount}回</b></div>}
              </div>
            </>
          );
        })()}

        {/* パーソナルは「体験希望」ボタンのみ（ジムはプラン管理をしない） */}
        <p className="kicker">パーソナルトレーニング体験</p>
        <div className="card">
          {inquiry ? (
            <div className="alert-band alert-blue" style={{ margin: 0 }}>体験希望を受付済みです。ジムスタッフからご案内します。</div>
          ) : (
            <>
              <b>プロと同じ管理で、さらに身体を仕上げる</b>
              <p className="meta">気になる方は、ボタンひとつでジムスタッフに伝わります。</p>
              <form action={requestPtTrialAction}>
                <SubmitButton className="btn btn-green" pendingLabel="送信中…">体験に興味がある</SubmitButton>
              </form>
              <p className="info-note" style={{ marginBottom: 0 }}>この画面では決済や予約確定は行いません。ジムスタッフが体験のご案内をします。</p>
            </>
          )}
        </div>
      </div>
      <UserTabbar active="personal" />
    </>
  );
}
