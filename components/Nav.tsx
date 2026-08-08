import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { currentUser, homePath } from "@/lib/auth";

/**
 * 利用者（プロ・一般）の下部タブ(§12)。
 * パーソナルタブは一般会員だけに表示する。プロ選手には出さない。
 */
export async function UserTabbar({ active }: { active: string }) {
  const user = await currentUser();
  const showPersonal = user?.role === "member";
  const items = [
    { href: "/u", ico: "🏠", label: "ホーム", key: "home" },
    { href: "/u/record", ico: "📝", label: "記録", key: "record" },
    { href: "/u/graphs", ico: "📈", label: "グラフ", key: "graphs" },
    ...(showPersonal ? [{ href: "/u/personal", ico: "💪", label: "パーソナル", key: "personal" }] : []),
    { href: "/u/mypage", ico: "🎯", label: "目標・設定", key: "mypage" },
  ];
  return <Tabbar items={items} active={active} />;
}

/** ジムスタッフの下部タブ(§12) */
export function StaffTabbar({ active }: { active: string }) {
  const items = [
    { href: "/staff", ico: "🏠", label: "ホーム", key: "home" },
    { href: "/staff/users", ico: "📋", label: "利用者一覧", key: "users" },
    { href: "/staff/personal", ico: "💪", label: "パーソナル", key: "personal" },
    { href: "/staff/follow", ico: "🔔", label: "フォロー", key: "follow" },
    { href: "/staff/settings", ico: "⚙️", label: "設定", key: "settings" },
  ];
  return <Tabbar items={items} active={active} />;
}

function Tabbar({ items, active }: { items: { href: string; ico: string; label: string; key: string }[]; active: string }) {
  return (
    <nav className="tabbar">
      {items.map((it) => (
        <Link key={it.key} href={it.href} className={active === it.key ? "on" : ""}>
          <span className="ico">{it.ico}</span>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

/** 共通ヘッダー。［← もどる］［ログアウト/ログイン画面］。hideBack=trueでホーム等の「自分に戻る」を消す */
export async function Hero({ title, sub, backHref, hideBack }: { title: string; sub?: string; backHref?: string; hideBack?: boolean }) {
  const user = await currentUser();
  const home = user ? homePath(user.role) : "/";
  return (
    <div className="hero">
      <div className="hero-nav">
        {hideBack ? <span /> : <Link href={backHref ?? home} className="hero-btn">← もどる</Link>}
        {user ? (
          <form action={logoutAction}>
            <button type="submit" className="hero-btn">ログアウト</button>
          </form>
        ) : (
          <Link href="/" className="hero-btn">ログイン画面</Link>
        )}
      </div>
      <h1>{title}</h1>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
