/**
 * FIGHT READY データモデル。
 *
 * 設計方針: 試作段階は「ドキュメント型ストア」（DB オブジェクト1つに全配列を持つ）で持ち、
 * ローカルJSONファイル or Supabase の1行(JSONB)に保存する。本格運用時に §45 の正規化
 * テーブルへ移す。型はその正規化テーブルの列名にできるだけ寄せてある。
 *
 * 削除項目(§5): ニックネーム / 階級 / 担当コーチ / 担当トレーナー / チャット・コメント は持たない。
 */

/** 利用区分。ジムスタッフ間で権限差は作らない(§4-3, §47)。 */
export type Role = "pro" | "member" | "staff";
export type UserType = "pro" | "member";

/** 格闘技の種類(§10)。fitness=フィットネス利用のみ */
export type CombatSport =
  | "boxing" | "kickboxing" | "muaythai" | "mma" | "bjj"
  | "judo" | "wrestling" | "karate" | "taekwondo" | "other" | "fitness";

/** 主な目標(§11) */
export type Goal =
  | "lose_weight" | "lose_fat" | "build_stamina" | "exercise_habit"
  | "fight_prep" | "improve_skill" | "maintain_health";

export interface Gym {
  id: string;
  name: string;
  /** スタッフ登録・所属確認用のジムコード */
  code: string;
  /** 基本情報（設定から手動で登録・編集） */
  address?: string;
  phone?: string;
  note?: string;
  suspended?: boolean;
  /** 課金（Stripe）。未契約のジムは未設定のまま（後方互換）。 */
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  billingStatus?: "none" | "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "unpaid";
  billingQuantity?: number;   // Stripeに反映済みの請求人数（表示・差分検知用）
  billingUpdatedAt?: string;
  createdAt: string;
}

export interface User {
  id: string;
  gymId: string;
  email: string;
  passwordHash: string;
  role: Role;
  name: string;
  status: "active" | "suspended";
  /** プロフィール(§11, §46 profiles) */
  gender?: "male" | "female" | "other" | "no_answer";
  birthDate?: string;       // YYYY-MM-DD
  heightCm?: number;
  userType?: UserType;      // pro / member（staff は未設定）
  usualWeight?: number;     // 通常体重
  startWeight?: number;     // 登録時の現在体重
  /** 格闘技の種類。プロは主競技1つ必須＋副競技複数、一般は任意複数 */
  primarySport?: CombatSport;
  sports?: CombatSport[];
  /** 目標(§11) */
  goals?: Goal[];
  targetWeight?: number;    // 「体重を落とす」利用者
  targetDate?: string;      // 目標日
  weeklyPlanCount?: number; // 1週間の運動予定回数
  /** 食事の目標（自由記述・例:「夜の間食を控える」）。食事達成度はこの目標に対して評価する(§21) */
  foodGoal?: string;
  /** ONE Championship 対応(§ONE): 大会団体と契約体重 */
  promotion?: "one" | "other" | "none";
  contractWeightKg?: number;
  /**
   * ハイドレーション（尿比重/HYDRO）検査を使うか。
   * アマチュア選手は水抜きは使うが尿比重検査は不要なため false にできる。
   * false のとき水抜き画面のHYDRO欄を非表示。ONE(promotion==="one")のときは常に表示。
   * 未設定(undefined)は従来どおり表示する。
   */
  usesHydration?: boolean;
  /** プロのみ(§11): 計量・試合 */
  weighInAt?: string;       // 計量日時 ISO
  fightAt?: string;         // 試合日時 ISO
  weighInType?: "same_day" | "day_before"; // 当日/前日計量
  pastCutExperience?: string;
  maxCutKg?: number;        // 過去最大の減量幅
  /** パスワード再設定用の「合言葉」（メール不要のセルフ復旧）。答えはハッシュで保存。 */
  recoveryQuestion?: string;
  recoveryAnswerHash?: string;
  createdAt: string;
}

/* ───────── 日々の記録 ───────── */

export type Level3 = "low" | "mid" | "high";      // 疲労感など
export type SleepQ = "good" | "normal" | "bad";
export type Motivation = "yes" | "normal" | "no";
export type Sluggish = "none" | "some" | "strong"; // だるさ
export type PainLevelWord = "none" | "some" | "strong";

/** 今日のチェック(§14) + 体重(§46 daily_checkins, weight_logs を1レコードに) */
export interface DailyCheckin {
  id: string;
  gymId: string;
  userId: string;
  date: string;               // YYYY-MM-DD
  weight?: number | null;     // 今日の体重
  sleepQuality?: SleepQ;
  fatigueLevel?: Level3;      // 疲労感
  sluggishnessLevel?: Sluggish; // だるさ（別項目で保存 §14）
  motivationLevel?: Motivation; // やる気（現在UIでは未使用）
  painLevel?: PainLevelWord;  // 痛み（詳細は painLogs）
  otherSymptoms?: string[];   // 体のつり・打撲・しびれ 等のチェック
  urineColor?: "light" | "normal" | "dark" | "very_dark"; // 尿の色
  hydrationThirst?: "none" | "some" | "strong"; // 水抜き中の口渇
  urineVolumeStatus?: "normal" | "low" | "very_low"; // 水抜き中の尿量
  bowel?: "yes" | "no" | "constipation" | "diarrhea";     // お通じ
  dangerSymptoms?: string[];  // 危険症状 複数選択
  /** 異常時のみ聞く追加質問(§32) */
  extra?: Record<string, string>;
  freeNote?: string;
  createdAt: string;
}

/** 痛みの場所(§15)。日付ごとに部位単位で保存 */
export interface PainLog {
  id: string;
  gymId: string;
  userId: string;
  date: string;
  locationId: string;         // 部位ID（constants の BODY_PARTS）
  painLevel: 1 | 2 | 3;
  newOrContinuing: "new" | "continuing";
  changeStatus: "improved" | "same" | "worse"; // 前日比
  createdAt: string;
}

/** 運動記録(§16)。ランニングは runningLogs へ */
export interface ActivityLog {
  id: string;
  gymId: string;
  userId: string;
  date: string;
  activityType: string;       // constants の ACTIVITIES
  durationMinutes: number;
  rpe?: number;               // きつさ1-10（ランニング以外）
  movementFeeling?: "good" | "normal" | "heavy"; // 今日の動き
  sweatLevel?: "low" | "mid" | "high"; // 汗の量（この練習で）
  load?: number;              // 裏側計算: duration × rpe
  createdAt: string;
}

/** ランニング記録(§17)。rpe は使わない */
export interface RunningLog {
  id: string;
  gymId: string;
  userId: string;
  date: string;
  category: string;           // constants の RUNNING_CATS
  durationMinutes: number;
  distanceKm?: number;
  averagePace?: string;
  dashCount?: number;
  dashDurationOrDistance?: string;
  restDuration?: string;
  legCondition?: "light" | "normal" | "heavy" | "pain";
  createdAt: string;
}

/** オフ日・休養日(§18) + 夜の回復チェック */
export interface RestDayLog {
  id: string;
  gymId: string;
  userId: string;
  date: string;
  dayType: string;            // constants の DAY_TYPES
  recovery?: "much" | "some" | "same" | "worse"; // 今日の回復状態
  actions?: string[];         // 今日行ったこと
  painChange?: "improved" | "same" | "worse";
  createdAt: string;
}

/** 食事達成度(§21) */
export interface NutritionLog {
  id: string;
  gymId: string;
  userId: string;
  date: string;
  goalAchieved: "done" | "partial" | "none";
  breakfast?: "done" | "partial" | "none";
  lunch?: "done" | "partial" | "none";
  dinner?: "done" | "partial" | "none";
  snack?: "done" | "partial" | "none";
  hydration?: "done" | "partial" | "none";
  createdAt: string;
}

/* ───────── プロ選手：水抜き ───────── */

/** 水抜き期間(§23) */
export interface WaterCutPeriod {
  id: string;
  gymId: string;
  userId: string;
  startDatetime: string;
  baselineWeight: number;     // 水抜き開始時基準体重
  targetWeight: number;       // 計量目標体重
  weighInDatetime: string;
  fightDatetime?: string;
  status: "active" | "recovery" | "done";
  // フェーズ: ローディング(cutStartedAt未設定) → 水抜き(cutStartedAt設定) → 計量/リカバリー(status)。
  plan?: "full" | "cutonly" | "loadingonly"; // 進め方: フル / 水抜きのみ(ローディングなし) / ローディングのみ(水抜きなし)
  loadingTargetLiters?: number; // ウォーターローディングの1日の水分目標(L)。本人が選ぶ
  cutStartedAt?: string;        // 「水抜きを開始する」を押した日時（ローディング→水抜きの切替）
  cutBaselineWeight?: number;   // 水抜き開始時の体重（ローディングで増えた"山"。水抜きの%はここから測る）
  weighInStartedAt?: string;
  actualWeighInWeight?: number;
  weighedInAt?: string;
  /** 終了時の任意の振り返りメモ(§4-1)。未入力の旧データは undefined のまま（後方互換） */
  reviewWentWell?: string;      // うまくいったこと
  reviewDifficulties?: string;  // 困ったこと
  reviewNextChanges?: string;   // 次回変えること
  createdAt: string;
}

/** 水抜きログ(§24-25) */
export interface WaterCutLog {
  id: string;
  gymId: string;
  userId: string;
  periodId: string;
  currentWeight: number;
  acuteLossKg: number;
  acuteLossPercentage: number;
  waterIntakeLiters?: number;  // その日の水分摂取量(L)。ローディングで多く、水抜きで絞る
  tookElectrolyte?: boolean;   // 電解質（経口補水・塩分等）を摂ったか
  source?: "manual" | "morning";
  recordedDatetime: string;
  createdAt: string;
}

/** HYDRO / 水分状態(§27-28) + ONE Championship(§ONE) */
export interface HydrationLog {
  id: string;
  gymId: string;
  userId: string;
  periodId?: string;
  urineSpecificGravity?: number | null; // 尿比重（小数第4位）
  urineColor?: "light" | "normal" | "dark" | "very_dark";
  urineVolumeStatus?: "normal" | "low" | "very_low";
  thirst?: "none" | "some" | "strong";
  symptoms?: string[];
  /** ONE: 尿比重と同時測定した体重・機器情報 */
  simultaneousWeight?: number;
  weightMeasuredAt?: string;
  refractometerName?: string;
  calibrationChecked?: boolean;
  measuredBy?: string;
  gapMinutes?: number;        // 尿比重→体重測定の経過時間
  note?: string;
  recordedDatetime: string;
  createdAt: string;
}

/** 計量後の回復記録(§31) プロのみ */
export interface WeighInRecovery {
  id: string;
  gymId: string;
  userId: string;
  periodId?: string;          // 旧データ互換。新規保存では必須
  weighInWeight: number;
  currentWeight: number;
  hoursSinceWeighIn: number;
  tookWater: boolean;
  tookFood: boolean;
  symptoms?: string[];        // 吐き気/腹痛/頭痛/だるさ
  sleep?: SleepQ;
  preFightCondition?: "good" | "normal" | "bad";
  isFightDay?: boolean;       // 試合当日の体重として記録したか
  recordedAt: string;         // 記録した日時（体重の戻りを時系列で見る）
  createdAt: string;
}

/* ───────── 一般会員：キャンプ & パーソナル ───────── */

/** キャンプ(§19) */
export interface Camp {
  id: string;
  gymId: string;
  userId: string;
  name: string;
  startDate: string;
  endDate: string;
  goal?: string;
  startWeight?: number;
  targetWeight?: number;
  startWaist?: number;
  targetWorkoutCount?: number; // 目標運動回数(週)
  nutritionGoal?: string;
  status: "active" | "done";
  createdAt: string;
}

/** パーソナルトレーニングのプラン(§20)。担当トレーナーは持たない */
export interface PtPlan {
  id: string;
  gymId: string;
  userId: string;
  planName: string;
  startDate: string;
  endDate?: string;
  totalSessions: number;
  completedSessions: number;
  nextSessionDate?: string;
  status: "active" | "trial_wanted" | "trial_done" | "paused" | "done";
  createdAt: string;
}

/** パーソナルセッション記録(§20) */
export interface PtSession {
  id: string;
  gymId: string;
  userId: string;
  planId: string;
  date: string;
  durationMinutes?: number;
  category?: string;
  attended: "done" | "absent";
  weight?: number;
  condition?: Level3;
  painNote?: string;
  afterState?: "good" | "normal" | "heavy";
  createdAt: string;
}

/** 体験希望(§20) */
export interface PtInquiry {
  id: string;
  gymId: string;
  userId: string;
  status: "wanted" | "contacted" | "done" | "declined";
  createdAt: string;
}

/* ───────── 運用系 ───────── */

/** 来館ログ(§45 attendance_logs) */
export interface AttendanceLog {
  id: string;
  gymId: string;
  userId: string;
  date: string;
  createdAt: string;
}

/** フォロー対応履歴(§42) */
export interface FollowupLog {
  id: string;
  gymId: string;
  userId: string;
  action: string;            // 連絡済み / 電話済み / 来館予定あり ...
  staffId: string;
  note?: string;
  createdAt: string;
}

/** 変更履歴・監査(§47) */
export interface HistoryRecord {
  id: string;
  gymId: string;
  actorId?: string;
  action: string;
  resource?: string;
  detail?: string;
  createdAt: string;
}

export interface LoginRecord {
  id: string;
  email: string;
  result: "success" | "fail";
  gymId?: string; // どのジムの利用者か（スタッフ設定の履歴を自ジムだけに絞るため）
  createdAt: string;
}

/* ───────── マルチロール基盤（Phase 1・追加のみ / 既存Role・gymIdは非削除） ───────── */

/**
 * スペース（所属の器）。ジム or 個人パーソナル。
 * 既存 Gym は削除せず、type:"gym" の Workspace として後方互換に扱える。
 */
export interface Workspace {
  id: string;
  name: string;
  type: "gym" | "personal";
  ownerId: string;              // このスペースの持ち主(User.id)
  status: "active" | "suspended";
  inviteCode: string;           // 顧客/スタッフ招待用（十分なランダム性）
  legacyGymId?: string;         // 既存Gymから作った場合の元GymId（互換用）
  /** 課金（Stripe）。未契約は未設定のまま。ジムのシート課金と同型。今回は未使用。 */
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  billingStatus?: Gym["billingStatus"];
  billingQuantity?: number;
  billingUpdatedAt?: string;
  createdAt: string;
}

/** 人 × スペース × 権限。同じUserが複数持てる。 */
export interface Membership {
  id: string;
  userId: string;
  workspaceId: string;
  role: "client" | "coach" | "staff" | "owner";
  status: "invited" | "active" | "suspended";
  createdAt: string;
}

/** 共有する記録の範囲（本人が同意した範囲だけコーチが見られる）。 */
export type CoachScope = "weight" | "activity" | "nutrition" | "condition" | "pain";

/** コーチ ↔ 担当顧客の紐付け。承認前は status:"invited"。 */
export interface CoachClientAssignment {
  id: string;
  workspaceId: string;
  coachUserId: string;
  clientUserId: string;
  status: "invited" | "active" | "revoked";
  sharedScopes: CoachScope[];
  createdAt: string;
}

/** ストア全体 */
export interface DB {
  gyms: Gym[];
  users: User[];
  dailyCheckins: DailyCheckin[];
  painLogs: PainLog[];
  activityLogs: ActivityLog[];
  runningLogs: RunningLog[];
  restDayLogs: RestDayLog[];
  nutritionLogs: NutritionLog[];
  waterCutPeriods: WaterCutPeriod[];
  waterCutLogs: WaterCutLog[];
  hydrationLogs: HydrationLog[];
  weighInRecoveries: WeighInRecovery[];
  camps: Camp[];
  ptPlans: PtPlan[];
  ptSessions: PtSession[];
  ptInquiries: PtInquiry[];
  attendanceLogs: AttendanceLog[];
  followupLogs: FollowupLog[];
  history: HistoryRecord[];
  logins: LoginRecord[];
  /** マルチロール基盤（Phase 1・後方互換で追加）。既存保存データには無いので store 側で [] 補完する。 */
  workspaces: Workspace[];
  memberships: Membership[];
  coachAssignments: CoachClientAssignment[];
}
