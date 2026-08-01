/**
 * フォームに「このフォームを表示した利用者ID」を埋める hidden フィールド。
 * Server Action 側の assertOwner() が、送信時点のログイン利用者と一致するか検証する。
 * 別タブで他ユーザーにログインし直した状態で古いフォームを送っても、他人のデータに保存されないようにする(P0)。
 */
export function OwnerField({ id }: { id: string }) {
  return <input type="hidden" name="ownerId" value={id} />;
}
