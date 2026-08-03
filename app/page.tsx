"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDot,
  ClipboardCheck,
  Clock3,
  CreditCard,
  FileText,
  FileDown,
  ExternalLink,
  Gauge,
  History,
  LoaderCircle,
  LockKeyhole,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

// The local dev server proxies /api to the localhost-only Python service.
// Keeping requests same-origin avoids browser and system-proxy differences
// between localhost and 127.0.0.1.
const API_BASE = "/api";

type JobStatus = "queued" | "running" | "succeeded" | "failed";
type Stage = "pending" | "locked" | "pending_review" | "reviewed";

type AnalysisEvidence = {
  claim: string;
  source_title: string;
  source_url?: string;
  published_at?: string;
  fetched_at?: string;
  reliability?: string;
};

type AnalysisDetail = {
  schema_version?: number;
  execution_tier?: "A" | "B" | "C";
  research_level?: "L0" | "L1" | "L2";
  market_clone?: boolean;
  market_clone_distance_pp?: number;
  market_baseline_only?: boolean;
  model_opinion_status?: "market_baseline_only" | "independent_model_view" | "legacy_unknown";
  marginal_picks?: { had?: "H" | "D" | "A"; hhad?: "H" | "D" | "A" } | null;
  directional_scenario?: string;
  directional_scenario_role?: "margin_diagnostic_only";
  had_available?: boolean;
  settlement_scope?: "directional" | "hhad_only";
  primary_selection?: {
    market: "had" | "hhad";
    outcome: "H" | "D" | "A";
  };
  rationale: string;
  risks: string[];
  factors: Record<string, string>;
  evidence: AnalysisEvidence[];
  joint_probabilities: Record<string, number>;
  adjustment_ledger?: Array<{
    adjustment_id?: string;
    source_type?: string;
    evidence_ids?: string[];
    joint_deltas?: Record<string, number>;
    reason?: string;
  }>;
  final_change_audit?: {
    change_reason?: string;
    scenario_before?: string;
    scenario_after?: string;
    new_football_evidence_ids?: string[];
    gate_result?: string;
  } | null;
  combination?: CombinationRecommendation | null;
  top_scores?: Array<{ score: string; probability: number }>;
  info_cutoff?: string;
};

type CombinationSelection = {
  market: "had" | "hhad";
  outcome: "H" | "D" | "A";
  label: string;
  odds: number;
  units: number;
  stake_yuan: number;
};

type CombinationRecommendation = {
  enabled: true;
  selections: CombinationSelection[];
  total_units: number;
  total_stake_yuan: number;
  covered_joint_outcomes: string[];
  covered_probability: number;
  branch_profits: Record<string, number>;
  min_profit_yuan: number;
  max_profit_yuan: number;
  min_roi: number;
  expected_score_single: number;
  expected_score_combination: number;
  score_advantage: number;
  rationale: string;
};

type Match = {
  match_id: number;
  business_date: string;
  match_num_str: string;
  match_date: string;
  match_time: string;
  league_name: string;
  home_team: string;
  away_team: string;
  home_rank?: string;
  away_rank?: string;
  goal_line: number;
  status?: string;
  odds_captured_at?: string;
  had_h?: number;
  had_d?: number;
  had_a?: number;
  hhad_h?: number;
  hhad_d?: number;
  hhad_a?: number;
  first_had_h?: number;
  first_had_d?: number;
  first_had_a?: number;
  first_hhad_h?: number;
  first_hhad_d?: number;
  first_hhad_a?: number;
  prediction_id?: number;
  edition?: "initial" | "final";
  revision?: number;
  predicted_at?: string;
  prob_had_h?: number;
  prob_had_d?: number;
  prob_had_a?: number;
  prob_hhad_h?: number;
  prob_hhad_d?: number;
  prob_hhad_a?: number;
  pick_had?: "H" | "D" | "A";
  pick_hhad?: "H" | "D" | "A";
  pick_had_label: string;
  pick_hhad_label: string;
  confidence?: "high" | "medium" | "low";
  confidence_label: string;
  research_status?: "complete" | "limited";
  no_bet?: number;
  rationale?: string;
  info_cutoff?: string;
  analysis_detail?: AnalysisDetail;
  result_status?: string;
  score_home?: number;
  score_away?: number;
  had_outcome_label: string;
  hhad_outcome_label: string;
  correct_had?: number;
  correct_hhad?: number;
  reviewed?: number;
  strategy_type?: "single" | "combination" | "directional";
  strategy_correct?: number;
  primary_correct?: number;
  delta_brier_had?: number;
  delta_brier_hhad?: number;
  joint_brier?: number;
  market_joint_brier?: number;
  delta_joint_brier?: number;
  clv_pp?: number;
  actual_margin_bucket?: string;
  score_points?: number;
  combo_profit_yuan?: number;
  review_category?: string;
  process_quality?: "good" | "mixed" | "bad";
  review_note?: string;
  review_lesson?: string;
  stage: Stage;
};

type Job = {
  id: string;
  action: string;
  label: string;
  business_date: string;
  status: JobStatus;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  exit_code?: number;
  detail?: string;
  log?: string;
};

type Report = { name: string; title: string; modified_at: string };
type PdfReport = Report & { size_bytes: number };

type BettingTicket = {
  ticket_id: string;
  type: "single" | "fallback_parlay" | "anchor" | "growth" | "longshot";
  label: string;
  multiplier: number;
  line_count: number;
  stake_yuan: number;
  combined_coverage_probability: number;
  expected_profit_yuan: number;
  robust_expected_profit_yuan?: number;
  winning_profit_min_yuan: number;
  winning_profit_max_yuan: number;
  legs: Array<{
    match_id: number;
    match_num?: string;
    home_team?: string;
    away_team?: string;
    market: "had" | "hhad";
    selections: Array<"H" | "D" | "A">;
  }>;
};

type BettingPlan = {
  bankroll_before: number;
  target_bankroll: number;
  anchor_status: "qualified" | "qualified_single" | "fallback_single" | "fallback_parlay" | "locked_existing" | "no_edge" | "no_legal_wager" | "user_declined";
  anchor_reason?: string;
  total_stake_yuan: number;
  max_daily_stake_yuan: number;
  status: string;
  user_explicit_force?: boolean;
  total_return_yuan?: number;
  net_profit_yuan?: number;
  bankroll_after?: number;
  anchor_hit?: boolean;
  daily_score_bonus_points?: number;
  tickets: BettingTicket[];
};

type DashboardData = {
  business_date: string;
  today_business_date: string;
  beijing_now: string;
  dates: string[];
  latest_snapshot?: string;
  matches: Match[];
  betting_plan?: BettingPlan | null;
  placed_bet?: BettingPlan | null;
  stage_counts: Record<Stage, number>;
  prediction_counts: Record<string, number>;
  jobs: Job[];
  reports: Report[];
  pdf_reports: PdfReport[];
};

type Tab = "board" | "schedule" | "odds" | "results";

const actionMeta = [
  { id: "refresh", label: "刷新赔率", hint: "抓取官方在售场次", icon: RefreshCw, tone: "neutral" },
  { id: "initial", label: "生成初版", hint: "调用完整研究流程", icon: Sparkles, tone: "primary" },
  { id: "final", label: "生成终版", hint: "刷新信息并锁稿", icon: LockKeyhole, tone: "danger" },
  { id: "confirm", label: "确认出票", hint: "把当前建议记入真实资金账本", icon: CreditCard, tone: "danger" },
  { id: "pdf", label: "生成PDF", hint: "导出全部预测与分析", icon: FileDown, tone: "primary" },
  { id: "settle", label: "结算赛果", hint: "写入官方完赛结果", icon: Trophy, tone: "neutral" },
  { id: "review", label: "生成复盘", hint: "计算指标与错误归因", icon: RotateCcw, tone: "neutral" },
] as const;

const factorMeta = [
  ["strength_form", "实力与近期状态"],
  ["squad_value", "阵容身价与有效比赛实力"],
  ["availability_rotation", "伤病、停赛与轮换"],
  ["motivation_format", "战意与赛制背景"],
  ["tactics_matchup", "战术与对位"],
  ["schedule_environment", "赛程与比赛环境"],
  ["k_league_offfield", "韩职场外博弈实验"],
  ["market_movement", "赔率与市场变化"],
] as const;

function formatTime(value?: string) {
  if (!value) return "暂无";
  const clean = value.replace("T", " ");
  return clean.length > 16 ? clean.slice(5, 16) : clean;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function pickLabel(outcome: "H" | "D" | "A", hhad = false) {
  return hhad
    ? ({ H: "让胜", D: "让平", A: "让负" } as const)[outcome]
    : ({ H: "胜", D: "平", A: "负" } as const)[outcome];
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function odds(value?: number) {
  return typeof value === "number" ? value.toFixed(2) : "—";
}

function pct(value?: number) {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "—";
}

const outcomeLabels = { H: "胜", D: "平", A: "负" } as const;

function marginalOutcome(values: Array<number | undefined>): "H" | "D" | "A" {
  const outcomes = ["H", "D", "A"] as const;
  return outcomes.reduce((best, outcome, index) => (
    (values[index] ?? -1) > (values[outcomes.indexOf(best)] ?? -1) ? outcome : best
  ), "H");
}

function hadDirection(match: Match) {
  return outcomeLabels[match.analysis_detail?.marginal_picks?.had || marginalOutcome([match.prob_had_h, match.prob_had_d, match.prob_had_a])];
}

function hhadDirection(match: Match) {
  return `让${outcomeLabels[match.analysis_detail?.marginal_picks?.hhad || marginalOutcome([match.prob_hhad_h, match.prob_hhad_d, match.prob_hhad_a])]}`;
}

function isMarketBaseline(match: Match) {
  return match.analysis_detail?.model_opinion_status === "market_baseline_only"
    || match.analysis_detail?.market_baseline_only
    || match.analysis_detail?.research_level === "L0"
    || match.analysis_detail?.market_clone;
}

function executionTier(match: Match): "A" | "B" | "C" {
  return match.analysis_detail?.execution_tier || (match.no_bet ? "C" : "B");
}

function executionLabel(match: Match) {
  return {
    A: "A重点推荐 · 1单位",
    B: "B值得关注 · 0.5单位",
    C: "C观望 · 0单位",
  }[executionTier(match)];
}

function executionClass(match: Match) {
  return `tier-${executionTier(match).toLowerCase()}`;
}

function primarySelection(match: Match): { market: "had" | "hhad"; outcome: "H" | "D" | "A" } {
  const saved = match.analysis_detail?.primary_selection;
  if (saved?.market && saved?.outcome) return saved;
  const hadOutcome = marginalOutcome([match.prob_had_h, match.prob_had_d, match.prob_had_a]);
  const hhadOutcome = marginalOutcome([match.prob_hhad_h, match.prob_hhad_d, match.prob_hhad_a]);
  const hadProbability = { H: match.prob_had_h, D: match.prob_had_d, A: match.prob_had_a }[hadOutcome] ?? -1;
  const hhadProbability = { H: match.prob_hhad_h, D: match.prob_hhad_d, A: match.prob_hhad_a }[hhadOutcome] ?? -1;
  return hhadProbability > hadProbability
    ? { market: "hhad", outcome: hhadOutcome }
    : { market: "had", outcome: hadOutcome };
}

function selectionClass(match: Match, market: "had" | "hhad") {
  return primarySelection(match).market === market ? `primary-selection ${executionClass(match)}` : "reference-selection";
}

function selectionCaption(match: Match, market: "had" | "hhad", label: string) {
  if (market === "had" && match.analysis_detail?.had_available === false) {
    return `模型推演 · ${label}（未开售）`;
  }
  if (primarySelection(match).market === market) {
    return `${isMarketBaseline(match) ? "市场基线（不执行）" : "唯一核心方案"} · ${label}`;
  }
  return `概率参考 · ${label}`;
}

function movement(current?: number, first?: number) {
  if (typeof current !== "number" || typeof first !== "number") return null;
  const delta = current - first;
  if (Math.abs(delta) < 0.005) return { label: "—", className: "flat" };
  return { label: `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`, className: delta > 0 ? "up" : "down" };
}

function editionLabel(match: Match) {
  if (!match.edition) return "未预测";
  return match.edition === "final" ? `终版 v${match.revision}` : `初版 v${match.revision}`;
}

function hasResult(match: Match) {
  return typeof match.score_home === "number" && typeof match.score_away === "number";
}

function strategyResultMeta(match: Match) {
  const hhadOnly = match.analysis_detail?.settlement_scope === "hhad_only";
  const scope = hhadOnly ? "（仅HHAD）" : "";
  const correct = match.primary_correct ?? match.strategy_correct;
  if (correct) return { className: "correct", label: `终版${scope}命中` };
  return { className: "missed", label: `终版${scope}错误` };
}

function StrategyResultBadge({ match }: { match: Match }) {
  const meta = strategyResultMeta(match);
  const Icon = meta.className === "correct" ? Check : meta.className === "partial" ? CircleDot : X;
  return <span className={meta.className}><Icon size={13} /> {meta.label}</span>;
}

const reviewCategoryLabels: Record<string, string> = {
  good_process_variance: "过程合理但结果方差",
  lineup_missed: "首发判断遗漏",
  injury_suspension_missed: "伤停遗漏",
  rotation_misread: "轮换误判",
  motivation_misread: "战意误判",
  tactical_mismatch: "战术对位误判",
  schedule_fatigue_missed: "赛程体能误判",
  market_signal_missed: "市场信号遗漏",
  stale_or_bad_data: "数据陈旧或错误",
  red_card_penalty_variance: "红牌/点球方差",
  finishing_variance: "终结效率方差",
  lucky_correct: "幸运命中",
  other: "其他",
};

const processQualityLabels = { good: "好", mixed: "一般", bad: "差" } as const;

function jobLabel(status: JobStatus) {
  return { queued: "排队中", running: "执行中", succeeded: "已完成", failed: "失败" }[status];
}

function jointLabel(value: string) {
  const [had, hhad] = value.split("/");
  const hadLabel = { H: "胜", D: "平", A: "负" }[had] || had;
  const hhadLabel = { H: "让胜", D: "让平", A: "让负" }[hhad] || hhad;
  return `${hadLabel} / ${hhadLabel}`;
}

function ProbabilityStrip({ values, labels = ["胜", "平", "负"] }: { values: Array<number | undefined>; labels?: string[] }) {
  return (
    <div className="probability-strip" aria-label="预测概率">
      {values.map((value, index) => (
        <div className={`prob-segment prob-${index}`} style={{ width: `${(value ?? 0) * 100}%` }} key={labels[index]}>
          {(value ?? 0) >= 0.2 && <span>{labels[index]} {pct(value)}</span>}
        </div>
      ))}
    </div>
  );
}

function OddsCell({ current, first }: { current?: number; first?: number }) {
  const delta = movement(current, first);
  return (
    <div className="odds-cell">
      <strong>{odds(current)}</strong>
      {delta && <span className={`movement ${delta.className}`}>{delta.label}</span>}
    </div>
  );
}

function AnalysisButton({ match, onOpen, compact = false }: { match: Match; onOpen: (match: Match) => void; compact?: boolean }) {
  if (!match.analysis_detail) return null;
  const label = match.review_note ? (compact ? "查看复盘" : "查看分析与复盘") : "查看分析";
  return <button className={`analysis-link ${compact ? "compact" : ""}`} onClick={() => onOpen(match)}><BookOpen size={compact ? 12 : 13} />{label}</button>;
}

type PredictionMarket = "had" | "hhad";
type PredictionOutcome = "H" | "D" | "A";

const marketOutcomes: PredictionOutcome[] = ["H", "D", "A"];

function outcomeOdds(match: Match, market: PredictionMarket, outcome: PredictionOutcome) {
  return {
    had: { H: match.had_h, D: match.had_d, A: match.had_a },
    hhad: { H: match.hhad_h, D: match.hhad_d, A: match.hhad_a },
  }[market][outcome];
}

function outcomeProbability(match: Match, market: PredictionMarket, outcome: PredictionOutcome) {
  return {
    had: { H: match.prob_had_h, D: match.prob_had_d, A: match.prob_had_a },
    hhad: { H: match.prob_hhad_h, D: match.prob_hhad_d, A: match.prob_hhad_a },
  }[market][outcome];
}

function confidenceText(match: Match) {
  if (!match.prediction_id) return "待预测";
  return match.confidence_label || ({ high: "高", medium: "中", low: "低" } as const)[match.confidence || "low"];
}

function OutcomeCell({ match, market, outcome }: { match: Match; market: PredictionMarket; outcome: PredictionOutcome }) {
  const primary = match.prediction_id ? primarySelection(match) : null;
  const pickedOutcome = market === "had" ? match.pick_had : match.pick_hhad;
  const isPrimary = Boolean(primary?.market === market && primary.outcome === outcome);
  const isRecommended = isPrimary;
  const isDiagnostic = Boolean(match.prediction_id && pickedOutcome === outcome && !isPrimary);
  const confidence = match.prediction_id ? match.confidence || "low" : "none";
  const label = market === "had" ? pickLabel(outcome) : pickLabel(outcome, true);
  const handicapLabel = match.goal_line > 0 ? `+${match.goal_line}` : `${match.goal_line}`;

  return (
    <div
      className={`outcome-cell${isRecommended ? ` is-recommended confidence-${confidence}` : ""}${isPrimary ? " is-primary" : ""}${isDiagnostic ? " is-diagnostic" : ""}`}
      aria-label={`${market === "had" ? "胜平负" : `${handicapLabel} 让球`} ${label}，赔率 ${odds(outcomeOdds(match, market, outcome))}${isPrimary ? `，${isMarketBaseline(match) ? "市场基线，不执行" : `唯一核心方案，${confidenceText(match)}信心`}` : isDiagnostic ? "，联合净胜球诊断，不是推荐" : ""}`}
    >
      <div className="outcome-cell-head">
        <span>{label}</span>
        {isPrimary ? <em>{isMarketBaseline(match) ? "基线" : "核心"}</em> : isDiagnostic ? <em>情景</em> : null}
      </div>
      <strong>{odds(outcomeOdds(match, market, outcome))}</strong>
      <small>{market === "hhad" ? `${handicapLabel} · ` : ""}模型 {pct(outcomeProbability(match, market, outcome))}</small>
    </div>
  );
}

function MatchBoardCard({ match, onOpenAnalysis }: { match: Match; onOpenAnalysis: (match: Match) => void }) {
  const confidence = match.prediction_id ? match.confidence || "low" : "none";
  const topScores = match.analysis_detail?.top_scores || [];
  return (
    <article className="fixture-card">
      <div className="fixture-card-head">
        <div className="fixture-meta">
          <span className="match-number">{match.match_num_str}</span>
          <span className="league-pill">{match.league_name}</span>
          <span className="kickoff"><Clock3 size={13} /> {match.match_time}</span>
        </div>
        <span className={`confidence-badge confidence-${confidence}`}>
          {match.prediction_id ? `${confidenceText(match)}信心` : confidenceText(match)}
        </span>
      </div>
      <div className="fixture-teams">
        <div><span>{match.home_team}</span><small>{match.home_rank || "主队"}</small></div>
        <strong>{hasResult(match) ? `${match.score_home} : ${match.score_away}` : "VS"}</strong>
        <div><span>{match.away_team}</span><small>{match.away_rank || "客队"}</small></div>
      </div>
      <div className="odds-six-grid">
        {marketOutcomes.map((outcome) => <OutcomeCell match={match} market="had" outcome={outcome} key={`had-${outcome}`} />)}
        {marketOutcomes.map((outcome) => <OutcomeCell match={match} market="hhad" outcome={outcome} key={`hhad-${outcome}`} />)}
      </div>
      <div className="score-forecast" aria-label="最可能的三个比分">
        <small>最可能比分</small>
        {topScores.length ? (
          <div>{topScores.map((item, index) => <span key={item.score}><em>{index + 1}</em><strong>{item.score}</strong><small>{pct(item.probability)}</small></span>)}</div>
        ) : <p>{match.prediction_id ? "暂无模型比分" : "预测锁定后展示"}</p>}
      </div>
      <div className="fixture-card-foot">
        <span className={`edition-badge ${match.edition || "none"}`}>{editionLabel(match)}</span>
        {match.prediction_id ? <span className={`execution-badge ${executionClass(match)}`}>{executionLabel(match)}</span> : null}
        {match.reviewed ? <span className="reviewed-badge"><Check size={12} /> 已复盘</span> : null}
        {match.analysis_detail?.combination ? <span className="combo-badge">组合</span> : null}
        <AnalysisButton match={match} onOpen={onOpenAnalysis} />
      </div>
    </article>
  );
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [activeTab, setActiveTab] = useState<Tab>("board");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [query, setQuery] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [confirmFinal, setConfirmFinal] = useState(false);
  const [confirmBet, setConfirmBet] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedReport, setSelectedReport] = useState<{ name: string; content: string } | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const fetchDashboard = useCallback(async (date?: string, quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/dashboard${date ? `?date=${date}` : ""}`);
      if (!response.ok) throw new Error("本地数据服务未连接");
      const payload: DashboardData = await response.json();
      setData(payload);
      setSelectedDate(payload.business_date);
      setError("");
      if (selectedJob) {
        const fresh = payload.jobs.find((job) => job.id === selectedJob.id);
        if (fresh) setSelectedJob((old) => ({ ...old, ...fresh } as Job));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [selectedJob]);

  useEffect(() => {
    // Initial data hydration is the effect's external synchronization boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchDashboard();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const hasActiveJob = data?.jobs.some((job) => job.status === "queued" || job.status === "running");
    if (!hasActiveJob) return;
    const timer = window.setInterval(() => void fetchDashboard(selectedDate, true), 3000);
    return () => window.clearInterval(timer);
  }, [data?.jobs, fetchDashboard, selectedDate]);

  const filteredMatches = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return data.matches;
    return data.matches.filter((match) =>
      [match.match_num_str, match.league_name, match.home_team, match.away_team].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [data, query]);

  const runAction = async (action: string) => {
    setPendingAction(action);
    setConfirmFinal(false);
    setConfirmBet(false);
    try {
      const isTodayAction = action === "refresh" || action === "initial" || action === "final" || action === "confirm";
      const response = await fetch(`${API_BASE}/actions/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: isTodayAction ? null : selectedDate }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "指令启动失败");
      const jobDate = payload.business_date || (isTodayAction ? data?.today_business_date : selectedDate);
      await fetchDashboard(jobDate, true);
      const jobResponse = await fetch(`${API_BASE}/jobs/${payload.id}`);
      if (jobResponse.ok) setSelectedJob(await jobResponse.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "指令启动失败");
    } finally {
      setPendingAction(null);
    }
  };

  const openJob = async (job: Job) => {
    const response = await fetch(`${API_BASE}/jobs/${job.id}`);
    if (response.ok) setSelectedJob(await response.json());
  };

  const openReport = async (report: Report) => {
    try {
      const response = await fetch(`${API_BASE}/reports/${encodeURIComponent(report.name)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "报告加载失败");
      setSelectedReport(payload);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "报告加载失败");
    }
  };

  const openPdf = (report: PdfReport) => {
    window.location.assign(`${API_BASE}/pdfs/${encodeURIComponent(report.name)}`);
  };

  const handleAction = (action: string) => {
    if (action === "final") setConfirmFinal(true);
    else if (action === "confirm") setConfirmBet(true);
    else void runAction(action);
  };

  const runningJob = data?.jobs.find((job) => job.status === "queued" || job.status === "running");
  const reviewed = data?.stage_counts.reviewed ?? 0;
  const settled = (data?.stage_counts.pending_review ?? 0) + reviewed;
  const total = data?.matches.length ?? 0;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Gauge size={24} /></div>
          <div><h1>竞足指挥台</h1><p>赔率监控 · 预测锁稿 · 赛后复盘</p></div>
        </div>
        <div className="topbar-meta">
          <div className="live-status"><span /> 本地数据在线</div>
          <div className="beijing-time"><Clock3 size={16} /><span>北京时间</span><strong>{data ? formatTime(data.beijing_now) : "同步中"}</strong></div>
        </div>
      </header>

      <section className="workspace-head">
        <div>
          <span className="eyebrow">DAILY MATCH OPERATIONS</span>
          <h2>{selectedDate ? formatDate(selectedDate) : "今日"} 比赛工作区</h2>
          <p>官方赔率最后快照：{formatTime(data?.latest_snapshot)} · 共 {total} 场在册</p>
        </div>
        <div className="workspace-controls">
          <div className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索球队、联赛、场次" /></div>
          <label className="date-select"><CalendarDays size={16} /><select value={selectedDate} onChange={(event) => void fetchDashboard(event.target.value)} aria-label="选择比赛日期">{data?.dates.map((date) => <option value={date} key={date}>{formatDate(date)}</option>)}</select><ChevronDown size={14} /></label>
        </div>
      </section>

      {error && <div className="error-banner"><AlertTriangle size={17} /><span>{error}。请确认本地启动器仍在运行。</span><button onClick={() => setError("")} aria-label="关闭"><X size={16} /></button></div>}

      <section className="command-center">
        <div className="command-copy">
          <span className="section-label"><Play size={14} /> 手动指令</span>
          <h3>把关键动作握在你手里</h3>
          <p>初版、终版均由完整研究 agent 执行。初版、终版、复盘和PDF成功后会自动同步公开网站。</p>
          {runningJob && <button className="running-task" onClick={() => void openJob(runningJob)}><LoaderCircle size={16} className="spin" /><span><strong>{runningJob.label}</strong>{jobLabel(runningJob.status)} · 点击查看进度</span></button>}
        </div>
        <div className="action-grid">
          {actionMeta.map(({ id, label, hint, icon: Icon, tone }) => {
            const unavailableConfirm = id === "confirm" && (
              !data?.betting_plan?.tickets.length
              || Boolean(data?.placed_bet)
              || Boolean(data?.betting_plan?.user_explicit_force)
            );
            const disabled = Boolean(runningJob) || pendingAction !== null || unavailableConfirm;
            return (
              <button className={`action-button ${tone}`} disabled={disabled} onClick={() => handleAction(id)} key={id} title={hint}>
                <span className="action-icon">{pendingAction === id ? <LoaderCircle size={19} className="spin" /> : <Icon size={19} />}</span>
                <span><strong>{label}</strong><small>{hint}</small></span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="metric-grid">
        <article><span className="metric-icon blue"><CalendarDays size={18} /></span><div><small>今日场次</small><strong>{total}</strong><p>{data?.prediction_counts.final ? `终版已锁 ${data.prediction_counts.final} 场` : `初版已完成 ${data?.prediction_counts.initial ?? 0} 场`}</p></div></article>
        <article><span className="metric-icon green"><ClipboardCheck size={18} /></span><div><small>已复盘</small><strong>{reviewed}<em> / {settled || "—"}</em></strong><p>完赛后沉淀经验</p></div></article>
        <article><span className="metric-icon amber"><BarChart3 size={18} /></span><div><small>真实资金余额</small><strong>¥{(data?.placed_bet?.bankroll_after ?? data?.placed_bet?.bankroll_before ?? 100).toFixed(2)}</strong><p>{data?.placed_bet ? `已确认出票 · 当日净利 ${data.placed_bet.net_profit_yuan !== undefined && data.placed_bet.net_profit_yuan >= 0 ? "+" : ""}${data.placed_bet.net_profit_yuan?.toFixed(2) ?? "待结算"} 元` : "当日没有确认的真实出票"}</p></div></article>
        <article><span className="metric-icon violet"><Activity size={18} /></span><div><small>赔率数据</small><strong>{data?.latest_snapshot ? "已同步" : "待刷新"}</strong><p>{data?.latest_snapshot ? formatTime(data.latest_snapshot) : "暂无快照"}</p></div></article>
      </section>

      {data?.betting_plan && (
        <section className="betting-plan-panel">
          <div className="betting-plan-head">
            <div><span className="section-label"><ShieldCheck size={14} /> 当日投注建议</span><h3>建议方案（未确认不计资金）</h3><p>参考余额 ¥{data.betting_plan.bankroll_before.toFixed(2)} · 建议投入 ¥{data.betting_plan.total_stake_yuan.toFixed(2)} · 需另行确认出票</p></div>
            <strong>风险 {(data.betting_plan.total_stake_yuan / data.betting_plan.bankroll_before * 100 || 0).toFixed(1)}%</strong>
          </div>
          {data.betting_plan.anchor_status === "fallback_single" && <div className="betting-plan-empty"><AlertTriangle size={17} /><span>用户强制单关（不计系统成绩）：{data.betting_plan.anchor_reason}</span></div>}
          {data.betting_plan.anchor_status === "fallback_parlay" && <div className="betting-plan-empty"><AlertTriangle size={17} /><span>用户强制普通2串1（不计系统成绩）：{data.betting_plan.anchor_reason}</span></div>}
          {data.betting_plan.anchor_status === "qualified_single" && <div className="betting-plan-empty"><ShieldCheck size={17} /><span>合格正EV单关：{data.betting_plan.anchor_reason}</span></div>}
          {data.betting_plan.anchor_status === "locked_existing" && <div className="betting-plan-empty"><ShieldCheck size={17} /><span>已下注仓位保留，本次扩盘不重复出票：{data.betting_plan.anchor_reason}</span></div>}
          {data.betting_plan.anchor_status === "no_legal_wager" && <div className="betting-plan-empty"><AlertTriangle size={17} /><span>今日没有合法可出票方案：{data.betting_plan.anchor_reason}</span></div>}
          {data.betting_plan.anchor_status === "no_edge" && <div className="betting-plan-empty"><ShieldCheck size={17} /><span>今日无稳健正EV，建议不投注：{data.betting_plan.anchor_reason}</span></div>}
          <div className="betting-ticket-grid">
            {data.betting_plan.tickets.map((ticket) => (
              <article key={ticket.ticket_id}>
                <div><span>{ticket.type === "single" ? (data.betting_plan?.anchor_status === "qualified_single" ? "正EV单关" : "用户强制单关") : ticket.type === "fallback_parlay" ? "用户强制2串1" : ticket.type === "anchor" ? "低波动" : ticket.type === "longshot" ? "高收益" : "成长"}</span><strong>{ticket.label}</strong></div>
                <p>{ticket.legs.map((leg) => `${leg.match_num || leg.match_id} ${leg.market === "had" ? "胜平负" : "让球"}${leg.selections.map((outcome) => pickLabel(outcome, leg.market === "hhad")).join("+")}`).join(" × ")}</p>
                <small>{ticket.multiplier}倍 · {ticket.line_count}条线 · 投入 ¥{ticket.stake_yuan.toFixed(2)}</small>
                <footer><span>覆盖 {pct(ticket.combined_coverage_probability)}</span><span>压力测试EV {(ticket.robust_expected_profit_yuan ?? ticket.expected_profit_yuan) >= 0 ? "+" : ""}¥{(ticket.robust_expected_profit_yuan ?? ticket.expected_profit_yuan).toFixed(2)}</span><span>命中利润 ¥{ticket.winning_profit_min_yuan.toFixed(2)}～¥{ticket.winning_profit_max_yuan.toFixed(2)}</span></footer>
              </article>
            ))}
          </div>
        </section>
      )}

      <nav className="tabbar" aria-label="看板视图">
        {([
          ["board", "今日比赛", Gauge],
          ["schedule", "赛程与预测", CalendarDays],
          ["odds", "赔率走势", Activity],
          ["results", "赛果与复盘", Trophy],
        ] as const).map(([id, label, Icon]) => (
          <button className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)} key={id}><Icon size={16} />{label}</button>
        ))}
      </nav>

      {loading ? (
        <section className="loading-state"><LoaderCircle className="spin" /><strong>正在读取竞足档案</strong><span>同步比赛、赔率与预测记录…</span></section>
      ) : !data || !data.matches.length ? (
        <section className="empty-state"><CalendarDays size={28} /><h3>该日期暂无比赛</h3><p>点击“刷新赔率”获取官方在售场次。</p></section>
      ) : (
        <>
          {activeTab === "board" && (
            <section className="match-board">
              <div className="match-board-head">
                <div><h3>比赛预测</h3><p>六宫格展示两个玩法的完整概率；只高亮唯一核心方案，“情景”仅作净胜球诊断</p></div>
                <span><LockKeyhole size={13} /> 预测已锁定 · {filteredMatches.filter((match) => match.prediction_id).length}/{filteredMatches.length} 场</span>
              </div>
              <div className="match-board-grid">
                {filteredMatches.map((match) => <MatchBoardCard match={match} onOpenAnalysis={setSelectedMatch} key={match.match_id} />)}
              </div>
            </section>
          )}

          {activeTab === "schedule" && (
            <section className="data-panel">
              <div className="panel-head"><div><h3>赛程与已锁定预测</h3><p>同屏查看开球时间、两种玩法和预测概率</p></div><span>{filteredMatches.length} 场</span></div>
              <div className="schedule-list">
                {filteredMatches.map((match) => (
                  <article className="schedule-row" key={match.match_id}>
                    <div className="schedule-id"><strong>{match.match_num_str}</strong><span>{match.match_time}</span><small>{match.league_name}</small></div>
                    <div className="schedule-teams"><div><small>{match.home_rank}</small><strong>{match.home_team}</strong></div><span>vs</span><div><small>{match.away_rank}</small><strong>{match.away_team}</strong></div></div>
                    <div className="schedule-prediction">
                      {match.prediction_id ? <><div className={`pick-chip ${selectionClass(match, "had")}`}><small>{selectionCaption(match, "had", "胜平负")}</small><strong>{hadDirection(match)}</strong></div><div className={`pick-chip ${selectionClass(match, "hhad")}`}><small>{selectionCaption(match, "hhad", `${match.goal_line > 0 ? `+${match.goal_line}` : match.goal_line} 让球`)}</small><strong>{hhadDirection(match)}</strong></div><div className="prob-stack"><ProbabilityStrip values={[match.prob_had_h, match.prob_had_d, match.prob_had_a]} /><small>胜 {pct(match.prob_had_h)} · 平 {pct(match.prob_had_d)} · 负 {pct(match.prob_had_a)}</small></div></> : <span className="not-ready">等待预测</span>}
                    </div>
                    <div className="schedule-status">{match.prediction_id && <span className={`execution-badge ${executionClass(match)}`}>{executionLabel(match)}</span>}<span className={`edition-badge ${match.edition || "none"}`}>{editionLabel(match)}</span>{hasResult(match) && <strong>{match.score_home} : {match.score_away}</strong>}<AnalysisButton match={match} onOpen={setSelectedMatch} compact /></div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {activeTab === "odds" && (
            <section className="data-panel">
              <div className="panel-head"><div><h3>官方赔率与快照变化</h3><p>数值为最新赔率；右侧小字显示相较首个快照的变化</p></div><span>更新 {formatTime(data.latest_snapshot)}</span></div>
              <div className="table-scroll">
                <table className="odds-table">
                  <thead><tr><th>场次</th><th>对阵</th><th colSpan={3}>胜平负</th><th>让球</th><th colSpan={3}>让球胜平负</th><th>状态</th></tr><tr className="subhead"><th /><th /><th>胜</th><th>平</th><th>负</th><th /><th>让胜</th><th>让平</th><th>让负</th><th /></tr></thead>
                  <tbody>{filteredMatches.map((match) => <tr key={match.match_id}><td><strong>{match.match_num_str}</strong><small>{match.match_time}</small></td><td><strong>{match.home_team}</strong><span> vs </span><strong>{match.away_team}</strong><small>{match.league_name}</small></td><td><OddsCell current={match.had_h} first={match.first_had_h} /></td><td><OddsCell current={match.had_d} first={match.first_had_d} /></td><td><OddsCell current={match.had_a} first={match.first_had_a} /></td><td><span className={`handicap ${match.goal_line > 0 ? "positive" : "negative"}`}>{match.goal_line > 0 ? `+${match.goal_line}` : match.goal_line}</span></td><td><OddsCell current={match.hhad_h} first={match.first_hhad_h} /></td><td><OddsCell current={match.hhad_d} first={match.first_hhad_d} /></td><td><OddsCell current={match.hhad_a} first={match.first_hhad_a} /></td><td><div className="table-actions"><span className="fresh-badge"><span /> 最新</span><AnalysisButton match={match} onOpen={setSelectedMatch} compact /></div></td></tr>)}</tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === "results" && (
            <section className="results-layout">
              <div className="data-panel result-list-panel">
                <div className="panel-head"><div><h3>赛程赛果</h3><p>Primary 是研究主成绩；联动双中仅作联合校准</p></div><span>{settled} 场完赛</span></div>
                <div className="result-list">
                  {filteredMatches.map((match) => <article key={match.match_id}><div className="result-meta"><strong>{match.match_num_str}</strong><small>{match.league_name} · {match.match_time}</small></div><div className="result-teams"><span>{match.home_team}</span><strong>{hasResult(match) ? `${match.score_home} : ${match.score_away}` : "未完赛"}</strong><span>{match.away_team}</span></div><div className="result-checks">{hasResult(match) ? <><span className="diagnostic"><CircleDot size={13} /> HAD {match.pick_had_label}→{match.had_outcome_label}</span><span className="diagnostic"><CircleDot size={13} /> HHAD {match.pick_hhad_label}→{match.hhad_outcome_label}</span>{match.reviewed ? <StrategyResultBadge match={match} /> : null}</> : <span className="waiting"><Clock3 size={13} /> 等待赛果</span>}<AnalysisButton match={match} onOpen={setSelectedMatch} compact /></div></article>)}
                </div>
              </div>
              <aside className="side-stack">
                <section className="data-panel reports-panel"><div className="panel-head"><div><h3>归档报告</h3><p>PDF、终版、复盘与统计</p></div><FileText size={18} /></div>{data.pdf_reports.length || data.reports.length ? <div className="report-list">{data.pdf_reports.map((report) => <button onClick={() => openPdf(report)} key={report.name}><span className="report-icon pdf"><FileDown size={17} /></span><span><strong>{report.title}</strong><small>PDF · {formatBytes(report.size_bytes)} · {formatTime(report.modified_at)}</small></span></button>)}{data.reports.map((report) => <button onClick={() => void openReport(report)} key={report.name}><span className="report-icon"><FileText size={17} /></span><span><strong>{report.title}</strong><small>{formatTime(report.modified_at)}</small></span></button>)}</div> : <div className="mini-empty">暂无归档报告</div>}</section>
                <section className="data-panel jobs-panel"><div className="panel-head"><div><h3>执行记录</h3><p>最近 20 次手动任务</p></div><History size={18} /></div>{data.jobs.length ? <div className="job-list">{data.jobs.slice(0, 8).map((job) => <button onClick={() => void openJob(job)} key={job.id}><span className={`job-dot ${job.status}`} /> <span><strong>{job.label}</strong><small>{formatTime(job.created_at)}</small></span><em>{jobLabel(job.status)}</em></button>)}</div> : <div className="mini-empty">尚未执行看板任务</div>}</section>
              </aside>
            </section>
          )}
        </>
      )}

      <footer><ShieldCheck size={15} /> 数据保存在本机 · 指令仅限白名单动作 · 预测不构成投注承诺</footer>

      {confirmFinal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setConfirmFinal(false)}>
          <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="final-title">
            <button className="modal-close" onClick={() => setConfirmFinal(false)} aria-label="关闭"><X size={18} /></button>
            <span className="modal-symbol danger"><LockKeyhole size={24} /></span>
            <h3 id="final-title">确认生成 {formatDate(data?.today_business_date || selectedDate)} 终版？</h3>
            <p>此操作会重新抓取临场信息、调用完整研究 agent，并将输出作为新的终版修订锁定。点击确认即代表你已明确下达终版指令。</p>
            <div className="confirm-note"><AlertTriangle size={16} /><span>若当天已有终版，会生成更高 revision，不会覆盖旧版本。</span></div>
            <div className="modal-actions"><button className="button-secondary" onClick={() => setConfirmFinal(false)}>取消</button><button className="button-danger" onClick={() => void runAction("final")}><LockKeyhole size={16} />确认并运行</button></div>
          </section>
        </div>
      )}

      {confirmBet && data?.betting_plan && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setConfirmBet(false)}>
          <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="bet-title">
            <button className="modal-close" onClick={() => setConfirmBet(false)} aria-label="关闭"><X size={18} /></button>
            <span className="modal-symbol danger"><CreditCard size={24} /></span>
            <h3 id="bet-title">确认真实出票 ¥{data.betting_plan.total_stake_yuan.toFixed(2)}？</h3>
            <p>确认后，这份建议会成为不可变的真实资金记录并进入后续结算。系统不会替你在购彩平台下单，请只在你已经按该方案实际出票后确认。</p>
            <div className="confirm-note"><AlertTriangle size={16} /><span>每个业务日只允许一份真实出票记录；用户强制票需通过命令行额外确认，不可在看板直接记账。</span></div>
            <div className="modal-actions"><button className="button-secondary" onClick={() => setConfirmBet(false)}>取消</button><button className="button-danger" onClick={() => void runAction("confirm")}><CreditCard size={16} />我已实际出票，确认记账</button></div>
          </section>
        </div>
      )}

      {selectedMatch?.analysis_detail && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedMatch(null)}>
          <section className="analysis-modal" role="dialog" aria-modal="true" aria-labelledby="analysis-title">
            <button className="modal-close" onClick={() => setSelectedMatch(null)} aria-label="关闭"><X size={18} /></button>
            <header className="analysis-head">
              <div className="analysis-kicker"><span>{selectedMatch.match_num_str}</span><span>{selectedMatch.league_name}</span><span>{selectedMatch.match_time}</span></div>
              <h3 id="analysis-title">{selectedMatch.home_team} <small>vs</small> {selectedMatch.away_team}</h3>
              <div className="analysis-meta"><span className={`execution-badge ${executionClass(selectedMatch)}`}>{executionLabel(selectedMatch)}</span><span className={`edition-badge ${selectedMatch.edition || "none"}`}>{editionLabel(selectedMatch)}</span>{selectedMatch.analysis_detail.research_level && <span>研究 {selectedMatch.analysis_detail.research_level}</span>}{selectedMatch.analysis_detail.market_clone && <span>市场克隆 · 自动C</span>}<span>信息截止 {formatTime(selectedMatch.analysis_detail.info_cutoff)}</span><span className={selectedMatch.research_status === "complete" ? "research-complete" : "research-limited"}>{selectedMatch.research_status === "complete" ? "研究完整" : "信息有限"}</span></div>
            </header>
            <div className="analysis-scroll">
              {selectedMatch.review_note && <section className="analysis-section review-section">
                <div className="analysis-section-title"><RotateCcw size={17} /><h4>赛后复盘</h4></div>
                <div className="review-summary">
                  <span>赛果 <strong>{selectedMatch.score_home} : {selectedMatch.score_away}</strong></span>
                  <span>归因 <strong>{reviewCategoryLabels[selectedMatch.review_category || ""] || selectedMatch.review_category || "未分类"}</strong></span>
                  <span>过程质量 <strong>{selectedMatch.process_quality ? processQualityLabels[selectedMatch.process_quality] : "未评估"}</strong></span>
                  <span>研究主成绩 <strong>{strategyResultMeta(selectedMatch).label}</strong></span>
                </div>
                <p className="analysis-rationale">{selectedMatch.review_note}</p>
                {selectedMatch.review_lesson && <div className="review-lesson"><strong>候选经验</strong><p>{selectedMatch.review_lesson.replace(/^候选经验[:：]\s*/, "")}</p></div>}
              </section>}
              <section className="analysis-summary">
                <div><small>{selectedMatch.analysis_detail.had_available === false ? "正式预测（仅HHAD）" : "联合净胜球诊断"}</small><strong>{selectedMatch.analysis_detail.had_available === false ? "" : `${selectedMatch.pick_had_label} / `}让{selectedMatch.pick_hhad_label}</strong><p>{selectedMatch.analysis_detail.had_available === false ? "胜平负未开售，只按让球胜平负结算。" : "该格子只用于净胜球分布校准，不是第二条推荐，不参与核心命中结算。"}</p></div>
                <div className="analysis-picks"><span className={selectionClass(selectedMatch, "had")}><small>{selectionCaption(selectedMatch, "had", "胜平负")}</small><strong>{hadDirection(selectedMatch)}</strong></span><span className={selectionClass(selectedMatch, "hhad")}><small>{selectionCaption(selectedMatch, "hhad", `${selectedMatch.goal_line > 0 ? `+${selectedMatch.goal_line}` : selectedMatch.goal_line} 让球`)}</small><strong>{hhadDirection(selectedMatch)}</strong></span><span><small>执行</small><strong>{executionLabel(selectedMatch)}</strong></span></div>
              </section>

              {selectedMatch.analysis_detail.combination && (() => {
                const combination = selectedMatch.analysis_detail.combination;
                return <section className="combination-section">
                  <div className="combination-head"><div><span>可盈利覆盖策略</span><h4>{combination.selections.map((selection) => selection.label).join(" + ")}</h4></div><strong>覆盖 {pct(combination.covered_probability)}</strong></div>
                  <div className="combination-allocation">{combination.selections.map((selection) => <article key={`${selection.market}-${selection.outcome}`}><small>{selection.market === "had" ? "胜平负" : `${selectedMatch.goal_line > 0 ? `+${selectedMatch.goal_line}` : selectedMatch.goal_line} 让球`} · 赔率 {selection.odds.toFixed(2)}</small><strong>{selection.label} {selection.units}注</strong><span>{selection.stake_yuan.toFixed(0)} 元</span></article>)}<article className="combination-return"><small>总投入 {combination.total_stake_yuan.toFixed(0)} 元</small><strong>最低盈利 {combination.min_profit_yuan.toFixed(2)} 元</strong><span>最低收益率 {pct(combination.min_roi)}</span></article></div>
                  <p>{combination.rationale}</p>
                  <div className="branch-profit-list">{Object.entries(combination.branch_profits).map(([key, profit]) => <span key={key}>{jointLabel(key)}命中：<strong>+{profit.toFixed(2)}元</strong></span>)}</div>
                  <small className="combination-warning">这里只保证所列覆盖赛果按锁定赔率为正收益；未覆盖赛果会损失全部投入。金额为25注标准化示例。</small>
                </section>;
              })()}

              <section className="analysis-section"><div className="analysis-section-title"><BookOpen size={17} /><h4>核心判断</h4></div><p className="analysis-rationale">{selectedMatch.analysis_detail.rationale}</p></section>

              <section className="analysis-probabilities">
                <article><div><h4>{selectedMatch.analysis_detail.had_available === false ? "胜平负模型推演（未开售）" : "胜平负概率"}</h4><span>概率最高项 {hadDirection(selectedMatch)}</span></div><ProbabilityStrip values={[selectedMatch.prob_had_h, selectedMatch.prob_had_d, selectedMatch.prob_had_a]} /><p>胜 {pct(selectedMatch.prob_had_h)} · 平 {pct(selectedMatch.prob_had_d)} · 负 {pct(selectedMatch.prob_had_a)}</p></article>
                <article><div><h4>{selectedMatch.goal_line > 0 ? `+${selectedMatch.goal_line}` : selectedMatch.goal_line} 让球概率</h4><span>概率最高项 {hhadDirection(selectedMatch)}</span></div><ProbabilityStrip labels={["让胜", "让平", "让负"]} values={[selectedMatch.prob_hhad_h, selectedMatch.prob_hhad_d, selectedMatch.prob_hhad_a]} /><p>让胜 {pct(selectedMatch.prob_hhad_h)} · 让平 {pct(selectedMatch.prob_hhad_d)} · 让负 {pct(selectedMatch.prob_hhad_a)}</p></article>
              </section>

              {Object.keys(selectedMatch.analysis_detail.joint_probabilities).length > 0 && <section className="analysis-section"><div className="analysis-section-title"><BarChart3 size={17} /><h4>可同时命中的联合情景</h4></div><div className="joint-grid">{Object.entries(selectedMatch.analysis_detail.joint_probabilities).sort((a, b) => b[1] - a[1]).map(([key, value], index) => <div className={index === 0 ? "top" : ""} key={key}><span>{jointLabel(key)}</span><strong>{pct(value)}</strong></div>)}</div></section>}

              {(selectedMatch.analysis_detail.adjustment_ledger?.length ?? 0) > 0 && <section className="analysis-section"><div className="analysis-section-title"><Gauge size={17} /><h4>证据调权账本</h4></div><div className="factor-grid">{selectedMatch.analysis_detail.adjustment_ledger?.map((entry, index) => <article key={entry.adjustment_id || index}><h5>{entry.source_type || "证据调整"}</h5><p>{entry.reason || "未说明调整原因"}</p><small>引用证据：{entry.evidence_ids?.join("、") || "未列"}</small></article>)}</div></section>}

              {selectedMatch.analysis_detail.final_change_audit && <section className="analysis-section"><div className="analysis-section-title"><LockKeyhole size={17} /><h4>终版变更审计</h4></div><p className="analysis-rationale">{selectedMatch.analysis_detail.final_change_audit.scenario_before || "—"} → {selectedMatch.analysis_detail.final_change_audit.scenario_after || "—"}；{selectedMatch.analysis_detail.final_change_audit.change_reason || "方向未变化，仅刷新市场。"}</p><small>新增足球证据：{selectedMatch.analysis_detail.final_change_audit.new_football_evidence_ids?.join("、") || "无"} · 门禁 {selectedMatch.analysis_detail.final_change_audit.gate_result === "accepted" ? "通过" : "待校验"}</small></section>}

              <section className="analysis-section"><div className="analysis-section-title"><ClipboardCheck size={17} /><h4>分析维度</h4></div><div className="factor-grid">{factorMeta.filter(([key]) => key !== "k_league_offfield" || Boolean(selectedMatch.analysis_detail?.factors[key])).map(([key, label]) => <article key={key}><h5>{label}</h5><p>{selectedMatch.analysis_detail?.factors[key] || "本场暂无单独记录。"}</p></article>)}</div></section>

              <div className="analysis-bottom-grid">
                <section className="analysis-section risk-section"><div className="analysis-section-title"><AlertTriangle size={17} /><h4>主要风险</h4></div>{selectedMatch.analysis_detail.risks.length ? <ul>{selectedMatch.analysis_detail.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul> : <p className="analysis-empty">暂无单独风险记录。</p>}</section>
                <section className="analysis-section evidence-section"><div className="analysis-section-title"><ShieldCheck size={17} /><h4>来源与证据</h4></div>{selectedMatch.analysis_detail.evidence.length ? <div>{selectedMatch.analysis_detail.evidence.map((source, index) => <article key={`${source.source_url}-${index}`}><span className={`reliability ${source.reliability}`}>{source.reliability === "official" ? "官方" : "参考"}</span><div><strong>{source.source_title}</strong><p>{source.claim}</p><small>{source.published_at ? `发布 ${source.published_at}` : `抓取 ${formatTime(source.fetched_at)}`}</small></div>{source.source_url && <a href={source.source_url} target="_blank" rel="noreferrer" aria-label={`打开${source.source_title}`}><ExternalLink size={15} /></a>}</article>)}</div> : <p className="analysis-empty">暂无可展示的来源记录。</p>}</section>
              </div>
            </div>
          </section>
        </div>
      )}

      {selectedJob && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedJob(null)}>
          <section className="log-modal" role="dialog" aria-modal="true" aria-labelledby="job-title">
            <button className="modal-close" onClick={() => setSelectedJob(null)} aria-label="关闭"><X size={18} /></button>
            <div className="log-head"><span className={`modal-symbol ${selectedJob.status}`} >{selectedJob.status === "succeeded" ? <Check size={24} /> : selectedJob.status === "failed" ? <X size={24} /> : <LoaderCircle size={24} className="spin" />}</span><div><small>任务 {selectedJob.id}</small><h3 id="job-title">{selectedJob.label}</h3><p>{formatDate(selectedJob.business_date)} · {jobLabel(selectedJob.status)}</p></div></div>
            <pre>{selectedJob.log || "任务已入队，等待输出…"}</pre>
            <div className="log-foot"><span>{selectedJob.detail}</span><button className="button-secondary" onClick={() => void openJob(selectedJob)}><RefreshCw size={14} />刷新日志</button></div>
          </section>
        </div>
      )}

      {selectedReport && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedReport(null)}>
          <section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
            <button className="modal-close" onClick={() => setSelectedReport(null)} aria-label="关闭"><X size={18} /></button>
            <div className="report-modal-head"><FileText size={21} /><div><small>归档报告</small><h3 id="report-title">{selectedReport.name}</h3></div></div>
            <pre>{selectedReport.content}</pre>
          </section>
        </div>
      )}
    </main>
  );
}
