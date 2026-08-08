/** 表示ラベルと選択肢の一覧。UI とロジックで共有する。 */
import type { CombatSport, Goal } from "./types";

export const SPORTS: { id: CombatSport; label: string }[] = [
  { id: "boxing", label: "ボクシング" },
  { id: "kickboxing", label: "キックボクシング" },
  { id: "muaythai", label: "ムエタイ" },
  { id: "mma", label: "MMA" },
  { id: "bjj", label: "ブラジリアン柔術" },
  { id: "judo", label: "柔道" },
  { id: "wrestling", label: "レスリング" },
  { id: "karate", label: "空手" },
  { id: "taekwondo", label: "テコンドー" },
  { id: "other", label: "その他" },
  { id: "fitness", label: "フィットネス利用のみ" },
];
export const sportLabel = (id?: CombatSport | null) =>
  SPORTS.find((s) => s.id === id)?.label ?? "—";

export const GOALS: { id: Goal; label: string }[] = [
  { id: "lose_weight", label: "体重を落とす" },
  { id: "lose_fat", label: "体脂肪を落とす" },
  { id: "build_stamina", label: "体力をつける" },
  { id: "exercise_habit", label: "運動習慣を作る" },
  { id: "fight_prep", label: "試合に向けて仕上げる" },
  { id: "improve_skill", label: "格闘技を上達させる" },
  { id: "maintain_health", label: "健康を維持する" },
];
export const goalLabel = (id: Goal) => GOALS.find((g) => g.id === id)?.label ?? id;

/** 運動の種類(§16) */
export const ACTIVITIES: string[] = [
  "ボクシング", "キックボクシング", "ムエタイ", "MMA", "柔術", "柔道", "レスリング",
  "空手", "テコンドー", "ミット", "サンドバッグ", "スパーリング", "技術練習",
  "筋力トレーニング", "パーソナルトレーニング", "ウォーキング", "自転車",
  "ストレッチ", "アクティブリカバリー", "その他",
];

/** ランニングカテゴリー(§17) */
export const RUNNING_CATS: string[] = [
  "ジョギング", "一定ペース走", "ロードワーク", "テンポ走", "インターバル走",
  "ダッシュ", "坂道ダッシュ", "トレッドミル", "その他",
];

/** 日の種類(§18) */
export const DAY_TYPES: string[] = [
  "通常練習日", "高強度練習日", "軽めの練習日", "完全休養日",
  "アクティブリカバリー日", "体調不良による休養日", "痛みによる休養日", "計量日", "試合日",
];

/** 休養日にやったこと(§18) */
export const REST_ACTIONS: string[] = [
  "完全休養", "ストレッチ", "散歩", "軽い有酸素運動", "入浴", "サウナ", "施術", "鍼", "マッサージ", "その他",
];

/** その他の気になる症状（会長・スタッフが把握したい身体サイン） */
export const OTHER_SYMPTOMS: string[] = [
  "体のつり（こむら返り）", "打撲", "腫れ", "しびれ", "熱を持っている", "切り傷・擦り傷", "関節が動かしにくい",
];

/** お通じ(§32) */
export const BOWEL: { v: string; l: string }[] = [
  { v: "yes", l: "あった" },
  { v: "no", l: "なかった" },
  { v: "constipation", l: "便秘ぎみ" },
  { v: "diarrhea", l: "下痢ぎみ" },
];

/** 危険症状(§14)。軽い症状〜緊急性の高い症状まで（緊急性の高いものは EMERGENCY_SYMPTOMS で区別） */
export const DANGER_SYMPTOMS: string[] = [
  "めまい", "頭痛", "強い頭痛", "吐き気", "嘔吐", "下痢", "強い脱力", "立てない",
  "動悸", "強い動悸", "胸の痛み", "息苦しさ", "けいれん", "意識がぼんやりする", "混乱", "失神", "その他",
];

/**
 * 緊急性の高い（救急要請を検討すべき）症状。
 * 1つでもあれば「中止＋直ちに救急要請の検討」を促す。減少率が低くても赤にする。
 * DANGER_SYMPTOMS / HydrationLog.symptoms（HYDRO_SYMPTOMS）の両方から判定できる語で構成する。
 */
export const EMERGENCY_SYMPTOMS: string[] = [
  "意識がぼんやりする", "混乱", "失神", "胸の痛み", "けいれん", "筋けいれん", "立てない", "嘔吐", "強い頭痛", "強い動悸",
];

/** 水抜きの強制赤判定トリガー(§29) */
export const RED_SYMPTOMS: string[] = [
  "意識がぼんやりする", "失神またはしそう", "胸の痛み", "強い息苦しさ", "繰り返す嘔吐",
  "歩行が難しいほどの脱力", "排尿がほとんどない", "強い動悸", "強い筋けいれん", "急激な体調悪化",
];

/** パスワード再設定用「合言葉」の質問（本人がいくつかから選ぶ）。メール不要のセルフ復旧に使う。 */
export const RECOVERY_QUESTIONS = [
  "ペットの名前は？",
  "出身の小学校の名前は？",
  "母親の旧姓は？",
  "子どもの頃のあだ名は？",
  "生まれた市区町村は？",
  "初めて行った旅行先は？",
  "好きな食べ物は？",
] as const;

/** 既定の質問（未選択時・旧データ互換）。 */
export const RECOVERY_QUESTION = RECOVERY_QUESTIONS[0];

/** 合言葉の答えの正規化（前後空白を除き小文字化。全角空白も対象）。 */
export function normalizeRecoveryAnswer(s: string): string {
  return (s || "").replace(/[\s　]+/g, "").toLowerCase();
}

/** 計量後リカバリーで記録する症状(§31)。既存データ（symptoms: string[]）と後方互換 */
export const RECOVERY_SYMPTOMS: string[] = [
  "吐き気", "嘔吐", "下痢", "腹部膨満", "腹痛", "頭痛", "めまい", "動悸", "ぼんやりする", "だるさ", "その他",
];

/** 水分状態の自己確認 症状(§28) */
export const HYDRO_SYMPTOMS: string[] = [
  "口の渇き", "めまい", "頭痛", "吐き気", "筋けいれん", "動悸", "息苦しさ",
  "強い脱力", "意識がぼんやりする", "排尿がほとんどない",
];

/** 身体マップの部位(§15)。正面/背面と座標(0-100 の相対位置)を持つ */
export interface BodyPart {
  id: string;
  label: string;
  side: "front" | "back";
  x: number; // %
  y: number; // %
}
export const BODY_PARTS: BodyPart[] = [
  // front
  { id: "head", label: "頭", side: "front", x: 50, y: 6 },
  { id: "neck", label: "首", side: "front", x: 50, y: 14 },
  { id: "shoulder_r", label: "右肩", side: "front", x: 33, y: 20 },
  { id: "shoulder_l", label: "左肩", side: "front", x: 67, y: 20 },
  { id: "chest", label: "胸部", side: "front", x: 50, y: 26 },
  { id: "ribs", label: "肋骨", side: "front", x: 40, y: 32 },
  { id: "elbow_r", label: "右肘", side: "front", x: 26, y: 34 },
  { id: "elbow_l", label: "左肘", side: "front", x: 74, y: 34 },
  { id: "abdomen", label: "腹部", side: "front", x: 50, y: 40 },
  { id: "wrist_r", label: "右手首・手", side: "front", x: 22, y: 46 },
  { id: "wrist_l", label: "左手首・手", side: "front", x: 78, y: 46 },
  { id: "knuckle_r", label: "右拳（こぶし）", side: "front", x: 18, y: 50 },
  { id: "knuckle_l", label: "左拳（こぶし）", side: "front", x: 82, y: 50 },
  { id: "hip_r", label: "右股関節・鼠径部", side: "front", x: 42, y: 50 },
  { id: "hip_l", label: "左股関節・鼠径部", side: "front", x: 58, y: 50 },
  { id: "thigh_r", label: "右太もも", side: "front", x: 43, y: 62 },
  { id: "thigh_l", label: "左太もも", side: "front", x: 57, y: 62 },
  { id: "knee_r", label: "右膝", side: "front", x: 44, y: 74 },
  { id: "knee_l", label: "左膝", side: "front", x: 56, y: 74 },
  { id: "shin_r", label: "右すね・ふくらはぎ", side: "front", x: 44, y: 85 },
  { id: "shin_l", label: "左すね・ふくらはぎ", side: "front", x: 56, y: 85 },
  { id: "ankle_r", label: "右足首", side: "front", x: 45, y: 94 },
  { id: "ankle_l", label: "左足首", side: "front", x: 55, y: 94 },
  { id: "foot_r", label: "右足部", side: "front", x: 45, y: 98 },
  { id: "foot_l", label: "左足部", side: "front", x: 55, y: 98 },
  // back（人が後ろ向き。右＝見る側の右）
  { id: "neck_back", label: "首の後ろ", side: "back", x: 50, y: 14 },
  { id: "upper_back", label: "背中上部", side: "back", x: 50, y: 26 },
  { id: "elbow_back_r", label: "右肘の裏", side: "back", x: 74, y: 34 },
  { id: "elbow_back_l", label: "左肘の裏", side: "back", x: 26, y: 34 },
  { id: "lower_back", label: "腰", side: "back", x: 50, y: 42 },
  { id: "knee_back_r", label: "右膝の裏", side: "back", x: 56, y: 74 },
  { id: "knee_back_l", label: "左膝の裏", side: "back", x: 44, y: 74 },
  { id: "other", label: "その他", side: "back", x: 50, y: 55 },
];
export const bodyPartLabel = (id: string) => BODY_PARTS.find((p) => p.id === id)?.label ?? id;

/** ラベル辞書（汎用） */
export const LV3: Record<string, string> = { low: "少ない", mid: "普通", high: "強い" };
export const SLEEP: Record<string, string> = { good: "良い", normal: "普通", bad: "悪い" };
export const SLUGGISH: Record<string, string> = { none: "なし", some: "少しある", strong: "強い" };
export const SWEAT: Record<string, string> = { low: "少ない", mid: "普通", high: "多い" };
export const MOTIV: Record<string, string> = { yes: "ある", normal: "普通", no: "ない" };
export const PAINW: Record<string, string> = { none: "なし", some: "少しある", strong: "強い" };
export const MOVE: Record<string, string> = { good: "良かった", normal: "普通", heavy: "重かった" };
export const LEG: Record<string, string> = { light: "軽い", normal: "普通", heavy: "重い", pain: "痛みがある" };
export const RECOVERY: Record<string, string> = { much: "かなり回復した", some: "少し回復した", same: "変わらない", worse: "悪化した" };
export const ACHIEVE: Record<string, string> = { done: "できた", partial: "一部できた", none: "できなかった" };
export const URINE_COLOR: Record<string, string> = { light: "薄い", normal: "普通", dark: "濃い", very_dark: "非常に濃い" };
