(() => {
  "use strict";

  const state = { index: null, data: null, tab: "board", query: "" };
  const factorLabels = {
    strength_form: "实力与近期状态",
    squad_value: "阵容身价与有效比赛实力",
    availability_rotation: "伤病、停赛与轮换",
    motivation_format: "战意与赛制背景",
    tactics_matchup: "战术与对位",
    schedule_environment: "赛程与比赛环境",
    k_league_offfield: "韩职场外博弈实验",
    market_movement: "赔率与市场变化",
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char]);
  const pct = (value) => typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "—";
  const odds = (value) => typeof value === "number" ? value.toFixed(2) : "—";
  const marginalOutcome = (values) => ["H", "D", "A"].reduce(
    (best, outcome, index, outcomes) => (Number(values[index] ?? -1) > Number(values[outcomes.indexOf(best)] ?? -1) ? outcome : best),
    "H",
  );
  const hadDirection = (match) => ({ H: "胜", D: "平", A: "负" })[
    match.analysis_detail?.marginal_picks?.had || marginalOutcome([match.prob_had_h, match.prob_had_d, match.prob_had_a])
  ];
  const hhadDirection = (match) => `让${({ H: "胜", D: "平", A: "负" })[
    match.analysis_detail?.marginal_picks?.hhad || marginalOutcome([match.prob_hhad_h, match.prob_hhad_d, match.prob_hhad_a])
  ]}`;
  const executionTier = (match) => match.analysis_detail?.execution_tier || (match.no_bet ? "C" : "B");
  const executionLabel = (match) => ({ A: "A重点推荐 · 1单位", B: "B值得关注 · 0.5单位", C: "C观望 · 0单位" })[executionTier(match)];
  const executionClass = (match) => `tier-${executionTier(match).toLowerCase()}`;
  const primarySelection = (match) => {
    const saved = match.analysis_detail?.primary_selection;
    if (saved?.market && saved?.outcome) return saved;
    const hadOutcome = marginalOutcome([match.prob_had_h, match.prob_had_d, match.prob_had_a]);
    const hhadOutcome = marginalOutcome([match.prob_hhad_h, match.prob_hhad_d, match.prob_hhad_a]);
    const hadProbability = ({ H: match.prob_had_h, D: match.prob_had_d, A: match.prob_had_a })[hadOutcome] ?? -1;
    const hhadProbability = ({ H: match.prob_hhad_h, D: match.prob_hhad_d, A: match.prob_hhad_a })[hhadOutcome] ?? -1;
    return hhadProbability > hadProbability
      ? { market: "hhad", outcome: hhadOutcome }
      : { market: "had", outcome: hadOutcome };
  };
  const selectionClass = (match, market) => primarySelection(match).market === market ? `primary-selection ${executionClass(match)}` : "reference-selection";
  const isMarketBaseline = (match) => match.analysis_detail?.model_opinion_status === "market_baseline_only"
    || match.analysis_detail?.market_baseline_only
    || match.analysis_detail?.research_level === "L0"
    || match.analysis_detail?.market_clone;
  const hadAvailable = (match) => match.analysis_detail?.had_available !== false;
  const selectionCaption = (match, market, label) => {
    if (market === "had" && !hadAvailable(match)) return `模型推演 · ${label}（未开售）`;
    if (primarySelection(match).market === market) {
      return `${isMarketBaseline(match) ? "市场基线（不执行）" : "唯一核心方案"} · ${label}`;
    }
    return `概率参考 · ${label}`;
  };
  const handicap = (value) => value > 0 ? `+${value}` : String(value ?? "—");
  const hasResult = (match) => Number.isFinite(match.score_home) && Number.isFinite(match.score_away);
  const formatDate = (value) => {
    const [year, month, day] = String(value || "").split("-");
    return year && month && day ? `${year}.${month}.${day}` : "今日";
  };
  const formatTime = (value) => {
    if (!value) return "暂无";
    const clean = String(value).replace("T", " ");
    return clean.length > 16 ? clean.slice(5, 16) : clean;
  };
  const editionLabel = (match) => {
    if (!match.edition) return "未预测";
    return `${match.edition === "final" ? "终版" : "初版"} v${match.revision || 1}`;
  };
  const strategyResult = (match) => {
    const scope = match.analysis_detail?.settlement_scope === "hhad_only" ? "（仅HHAD）" : "";
    const correct = match.primary_correct ?? match.strategy_correct;
    if (correct) return { tone: "correct", symbol: "✓", label: `终版${scope}命中` };
    return { tone: "missed", symbol: "×", label: `终版${scope}错误` };
  };
  const strategyBadge = (match) => {
    const result = strategyResult(match);
    return `<span class="check ${result.tone}"><b>${result.symbol}</b><span><small>研究主成绩</small><strong>${esc(result.label)}</strong></span></span>`;
  };

  function filteredMatches() {
    const query = state.query.trim().toLowerCase();
    if (!query) return state.data?.matches || [];
    return state.data.matches.filter((match) => [
      match.match_num_str, match.league_name, match.home_team, match.away_team,
    ].some((value) => String(value || "").toLowerCase().includes(query)));
  }

  function renderMetrics() {
    const data = state.data;
    const matches = data.matches || [];
    const reviewed = matches.filter((match) => match.reviewed);
    const settled = matches.filter(hasResult);
    const primary = data.prediction_counts?.final
      ? `终版已锁 ${data.prediction_counts.final} 场`
      : `初版已完成 ${data.prediction_counts?.initial || 0} 场`;
    $("#metrics").innerHTML = `
      <article class="metric"><div><small>当日场次</small><strong class="accent">${matches.length}</strong></div><p>${esc(primary)}</p></article>
      <article class="metric"><div><small>已完赛 / 已复盘</small><strong class="green">${settled.length}<em> / ${reviewed.length}</em></strong></div><p>赛果归档后沉淀经验</p></article>
      <article class="metric"><div><small>真实资金余额</small><strong class="amber">¥${Number(data.placed_bet?.bankroll_after ?? data.placed_bet?.bankroll_before ?? 100).toFixed(2)}</strong></div><p>${data.placed_bet ? `已确认出票 · 当日净利 ${Number.isFinite(data.placed_bet.net_profit_yuan) && data.placed_bet.net_profit_yuan >= 0 ? "+" : ""}${Number.isFinite(data.placed_bet.net_profit_yuan) ? Number(data.placed_bet.net_profit_yuan).toFixed(2) : "待结算"} 元` : "当日没有确认的真实出票"}</p></article>
      <article class="metric"><div><small>官方赔率快照</small><strong>${data.latest_snapshot ? "已同步" : "暂无"}</strong></div><p>${esc(formatTime(data.latest_snapshot))}</p></article>`;
  }

  function renderBettingPlan() {
    const plan = state.data?.betting_plan;
    const root = $("#bettingPlan");
    if (!plan) {
      root.hidden = true;
      root.innerHTML = "";
      return;
    }
    const label = (outcome, hhad) => hhad
      ? ({ H: "让胜", D: "让平", A: "让负" })[outcome]
      : ({ H: "胜", D: "平", A: "负" })[outcome];
    root.hidden = false;
    root.innerHTML = `
      <header><div><small>当日投注建议</small><h2>建议方案（未确认不计资金）</h2><p>参考余额 ¥${Number(plan.bankroll_before || 0).toFixed(2)} · 建议投入 ¥${Number(plan.total_stake_yuan || 0).toFixed(2)} · 需另行确认出票</p></div><strong>风险 ${plan.bankroll_before ? (plan.total_stake_yuan / plan.bankroll_before * 100).toFixed(1) : "0.0"}%</strong></header>
      ${plan.anchor_status === "fallback_single" ? `<div class="plan-empty">用户强制单关（不计系统成绩）：${esc(plan.anchor_reason || "未说明")}</div>` : ""}
      ${plan.anchor_status === "fallback_parlay" ? `<div class="plan-empty">用户强制2串1（不计系统成绩）：${esc(plan.anchor_reason || "未说明")}</div>` : ""}
      ${plan.anchor_status === "qualified_single" ? `<div class="plan-empty">合格正EV单关：${esc(plan.anchor_reason || "未说明")}</div>` : ""}
      ${plan.anchor_status === "locked_existing" ? `<div class="plan-empty">已下注仓位保留，本次扩盘不重复出票：${esc(plan.anchor_reason || "未说明")}</div>` : ""}
      ${plan.anchor_status === "no_legal_wager" ? `<div class="plan-empty">今日没有合法可出票方案：${esc(plan.anchor_reason || "未说明")}</div>` : ""}
      ${plan.anchor_status === "no_edge" ? `<div class="plan-empty">今日无稳健正EV，建议不投注：${esc(plan.anchor_reason || "未说明")}</div>` : ""}
      <div class="ticket-grid">${(plan.tickets || []).map((ticket) => `<article>
        <div><span>${ticket.type === "single" ? (plan.anchor_status === "qualified_single" ? "正EV单关" : "用户强制单关") : ticket.type === "fallback_parlay" ? "用户强制2串1" : ticket.type === "anchor" ? "低波动" : ticket.type === "longshot" ? "高收益" : "成长"}</span><strong>${esc(ticket.label)}</strong></div>
        <p>${ticket.legs.map((leg) => `${esc(leg.match_num || leg.match_id)} ${leg.market === "had" ? "胜平负" : "让球"}${leg.selections.map((outcome) => label(outcome, leg.market === "hhad")).join("+")}`).join(" × ")}</p>
        <small>${ticket.multiplier}倍 · ${ticket.line_count}条线 · 投入 ¥${Number(ticket.stake_yuan).toFixed(2)}</small>
        <footer><span>覆盖 ${pct(ticket.combined_coverage_probability)}</span><span>压力测试EV ${Number(ticket.robust_expected_profit_yuan ?? ticket.expected_profit_yuan) >= 0 ? "+" : ""}¥${Number(ticket.robust_expected_profit_yuan ?? ticket.expected_profit_yuan).toFixed(2)}</span><span>命中利润 ¥${Number(ticket.winning_profit_min_yuan).toFixed(2)}～¥${Number(ticket.winning_profit_max_yuan).toFixed(2)}</span></footer>
      </article>`).join("")}</div>`;
  }

  const outcomeOrder = ["H", "D", "A"];
  const outcomeLabel = (market, outcome) => market === "had"
    ? ({ H: "胜", D: "平", A: "负" })[outcome]
    : ({ H: "让胜", D: "让平", A: "让负" })[outcome];
  const outcomeOdds = (match, market, outcome) => ({
    had: { H: match.had_h, D: match.had_d, A: match.had_a },
    hhad: { H: match.hhad_h, D: match.hhad_d, A: match.hhad_a },
  })[market][outcome];
  const outcomeProbability = (match, market, outcome) => ({
    had: { H: match.prob_had_h, D: match.prob_had_d, A: match.prob_had_a },
    hhad: { H: match.prob_hhad_h, D: match.prob_hhad_d, A: match.prob_hhad_a },
  })[market][outcome];
  const confidenceText = (match) => match.prediction_id
    ? (match.confidence_label || ({ high: "高", medium: "中", low: "低" })[match.confidence || "low"])
    : "待预测";

  function renderOutcomeCell(match, market, outcome) {
    const primary = match.prediction_id ? primarySelection(match) : null;
    const picked = market === "had" ? match.pick_had : match.pick_hhad;
    const isPrimary = Boolean(primary?.market === market && primary.outcome === outcome);
    const recommended = isPrimary;
    const diagnostic = Boolean(match.prediction_id && picked === outcome && !isPrimary);
    const confidence = match.prediction_id ? match.confidence || "low" : "none";
    const line = handicap(match.goal_line);
    const recommendation = isPrimary
      ? `，${isMarketBaseline(match) ? "市场基线，不执行" : `唯一核心方案，${confidenceText(match)}信心`}`
      : diagnostic ? "，联合净胜球诊断，不是推荐" : "";
    return `<div class="outcome-cell${recommended ? ` is-recommended confidence-${confidence}` : ""}${isPrimary ? " is-primary" : ""}${diagnostic ? " is-diagnostic" : ""}" aria-label="${esc(`${market === "had" ? "胜平负" : `${line} 让球`} ${outcomeLabel(market, outcome)}，赔率 ${odds(outcomeOdds(match, market, outcome))}${recommendation}`)}">
      <div class="outcome-cell-head"><span>${outcomeLabel(market, outcome)}</span>${isPrimary ? `<em>${isMarketBaseline(match) ? "基线" : "核心"}</em>` : diagnostic ? "<em>情景</em>" : ""}</div>
      <strong>${odds(outcomeOdds(match, market, outcome))}</strong>
      <small>${market === "hhad" ? `${esc(line)} · ` : ""}模型 ${pct(outcomeProbability(match, market, outcome))}</small>
    </div>`;
  }

  function renderCard(match) {
    const detail = match.analysis_detail ? "查看完整分析" : "暂无分析详情";
    const confidence = match.prediction_id ? match.confidence || "low" : "none";
    const topScores = match.analysis_detail?.top_scores || [];
    return `
      <article class="fixture-card">
        <div class="fixture-card-head">
          <div class="fixture-meta"><span>${esc(match.match_num_str)}</span><small>${esc(match.league_name)}</small><time>${esc(String(match.match_time || "").slice(0, 5))}</time></div>
          <span class="confidence-badge confidence-${confidence}">${esc(match.prediction_id ? `${confidenceText(match)}信心` : confidenceText(match))}</span>
        </div>
        <div class="fixture-teams">
          <div><small>${esc(match.home_rank || "")}</small><strong title="${esc(match.home_team)}">${esc(match.home_team)}</strong></div>
          <span>${hasResult(match) ? `${match.score_home} : ${match.score_away}` : "vs"}</span>
          <div><small>${esc(match.away_rank || "")}</small><strong title="${esc(match.away_team)}">${esc(match.away_team)}</strong></div>
        </div>
        <div class="odds-six-grid">${outcomeOrder.map((outcome) => renderOutcomeCell(match, "had", outcome)).join("")}${outcomeOrder.map((outcome) => renderOutcomeCell(match, "hhad", outcome)).join("")}</div>
        <div class="score-forecast" aria-label="最可能的三个比分">
          <small>最可能比分</small>
          ${topScores.length ? `<div>${topScores.map((item, index) => `<span><em>${index + 1}</em><strong>${esc(item.score)}</strong><small>${pct(item.probability)}</small></span>`).join("")}</div>` : `<p>${match.prediction_id ? "暂无模型比分" : "预测锁定后展示"}</p>`}
        </div>
        <div class="fixture-card-foot">
          <span class="badge blue">${esc(editionLabel(match))}</span>
          ${match.prediction_id ? `<span class="execution-badge ${executionClass(match)}">${esc(executionLabel(match))}</span>` : ""}
          ${match.reviewed ? '<span class="badge green">已复盘</span>' : ""}
          ${match.analysis_detail ? `<button class="detail-button" data-match="${match.match_id}">${esc(detail)}</button>` : `<small>${esc(detail)}</small>`}
        </div>
      </article>`;
  }

  function renderBoard(matches) {
    const locked = matches.filter((match) => match.prediction_id).length;
    return `<section class="match-board">
      <header class="match-board-head"><div><h2>比赛预测</h2><p>六宫格展示两个玩法的完整概率；只高亮唯一核心方案，“情景”仅作净胜球诊断</p></div><span>▣ 预测已锁定 · ${locked}/${matches.length} 场</span></header>
      <div class="match-board-grid">${matches.map(renderCard).join("")}</div>
    </section>`;
  }

  function renderSchedule(matches) {
    return `<section class="panel">
      <header class="panel-head"><div><h2>赛程与已锁定预测</h2><p>同屏查看开球时间、两种玩法和预测概率</p></div><span>${matches.length} 场</span></header>
      <div>${matches.map((match) => `<article class="list-row">
        <div class="list-id"><strong>${esc(match.match_num_str)}</strong><span>${esc(String(match.match_time || "").slice(0, 5))}</span><small>${esc(match.league_name)}</small></div>
        <div class="list-teams">${esc(match.home_team)} <span>vs</span> ${esc(match.away_team)}</div>
        <div class="list-picks">
          <span class="mini-pick ${selectionClass(match, "had")}"><small>${esc(selectionCaption(match, "had", "胜平负"))}</small><strong>${esc(hadDirection(match))}</strong></span>
          <span class="mini-pick ${selectionClass(match, "hhad")}"><small>${esc(selectionCaption(match, "hhad", `${handicap(match.goal_line)} 让球`))}</small><strong>${esc(hhadDirection(match))}</strong></span>
          <span class="prob-copy">胜 ${pct(match.prob_had_h)} · 平 ${pct(match.prob_had_d)} · 负 ${pct(match.prob_had_a)}</span>
        </div>
        <div class="list-state">${match.prediction_id ? `<span class="execution-badge ${executionClass(match)}">${esc(executionLabel(match))}</span>` : ""}<span class="badge blue">${esc(editionLabel(match))}</span>${hasResult(match) ? `<strong>${match.score_home} : ${match.score_away}</strong>` : ""}${match.analysis_detail ? `<button class="detail-button" data-match="${match.match_id}">完整分析</button>` : ""}</div>
      </article>`).join("") || '<div class="empty"><strong>没有匹配的比赛</strong><small>请调整搜索条件</small></div>'}</div>
    </section>`;
  }

  function movement(current, first) {
    if (!Number.isFinite(current) || !Number.isFinite(first)) return '<span class="movement">—</span>';
    const delta = current - first;
    if (Math.abs(delta) < .005) return '<span class="movement">—</span>';
    return `<span class="movement ${delta > 0 ? "up" : "down"}">${delta > 0 ? "+" : ""}${delta.toFixed(2)}</span>`;
  }

  function oddsCell(current, first) {
    return `<span class="odds-value">${odds(current)}</span>${movement(current, first)}`;
  }

  function renderOdds(matches) {
    return `<section class="panel">
      <header class="panel-head"><div><h2>中国体育彩票赔率快照</h2><p>主数值为最新锁定赔率，小字为相较首个快照的变化</p></div><span>${esc(formatTime(state.data.latest_snapshot))}</span></header>
      <div class="table-scroll"><table>
        <thead><tr><th>场次</th><th>对阵</th><th>胜</th><th>平</th><th>负</th><th>让球</th><th>让胜</th><th>让平</th><th>让负</th><th>分析</th></tr></thead>
        <tbody>${matches.map((match) => `<tr>
          <td><strong>${esc(match.match_num_str)}</strong><small>${esc(String(match.match_time || "").slice(0, 5))}</small></td>
          <td><strong>${esc(match.home_team)} vs ${esc(match.away_team)}</strong><small>${esc(match.league_name)}</small></td>
          <td>${oddsCell(match.had_h, match.first_had_h)}</td><td>${oddsCell(match.had_d, match.first_had_d)}</td><td>${oddsCell(match.had_a, match.first_had_a)}</td>
          <td><span class="handicap ${match.goal_line > 0 ? "positive" : "negative"}">${esc(handicap(match.goal_line))}</span></td>
          <td>${oddsCell(match.hhad_h, match.first_hhad_h)}</td><td>${oddsCell(match.hhad_d, match.first_hhad_d)}</td><td>${oddsCell(match.hhad_a, match.first_hhad_a)}</td>
          <td>${match.analysis_detail ? `<button class="detail-button" data-match="${match.match_id}">详情</button>` : "—"}</td>
        </tr>`).join("")}</tbody>
      </table></div>
    </section>`;
  }

  function reportItems() {
    const pdfs = (state.data.pdf_reports || []).map((report) => `
      <a class="report-link" href="${encodeURI(report.public_url || "#")}">
        <span class="report-icon pdf">PDF</span><span><strong>${esc(report.title)}</strong><small>${esc(formatTime(report.modified_at))} · ${(report.size_bytes / 1024).toFixed(0)} KB</small></span>
      </a>`);
    const reports = (state.data.reports || []).map((report) => `
      <button class="report-link" data-report="${esc(report.public_url || "")}" data-title="${esc(report.title)}">
        <span class="report-icon">文档</span><span><strong>${esc(report.title)}</strong><small>${esc(formatTime(report.modified_at))}</small></span>
      </button>`);
    return [...pdfs, ...reports].join("") || '<div class="column-empty">暂无归档报告</div>';
  }

  function renderResults(matches) {
    return `<section class="results-grid">
      <section class="panel">
        <header class="panel-head"><div><h2>赛程赛果</h2><p>Primary 是研究主成绩；联动双中仅作联合校准</p></div><span>${matches.filter(hasResult).length} 场完赛</span></header>
        <div>${matches.map((match) => `<article class="result-row">
          <div class="list-id"><strong>${esc(match.match_num_str)}</strong><small>${esc(match.league_name)} · ${esc(String(match.match_time || "").slice(0, 5))}</small></div>
          <div class="scoreline"><span>${esc(match.home_team)}</span><strong>${hasResult(match) ? `${match.score_home} : ${match.score_away}` : "未完赛"}</strong><span>${esc(match.away_team)}</span></div>
          <div class="checks">${hasResult(match) ? `
            <span class="check diagnostic"><b>·</b><span><small>HAD诊断</small><strong>${esc(match.pick_had_label)}→${esc(match.had_outcome_label)}</strong></span></span>
            <span class="check diagnostic"><b>·</b><span><small>HHAD诊断</small><strong>${esc(match.pick_hhad_label)}→${esc(match.hhad_outcome_label)}</strong></span></span>
            ${match.reviewed ? strategyBadge(match) : ""}` : '<span class="check wait">等待赛果</span>'}
            ${match.analysis_detail ? `<button class="detail-button" data-match="${match.match_id}">▣ 查看复盘</button>` : ""}</div>
        </article>`).join("")}</div>
      </section>
      <aside class="panel">
        <header class="panel-head"><div><h2>归档报告</h2><p>初版、终版、复盘与 PDF</p></div></header>
        <div class="report-list">${reportItems()}</div>
      </aside>
    </section>`;
  }

  function bindContentEvents() {
    $$('[data-match]').forEach((button) => button.addEventListener("click", () => openAnalysis(Number(button.dataset.match))));
    $$('[data-report]').forEach((button) => button.addEventListener("click", () => openReport(button.dataset.report, button.dataset.title)));
  }

  function renderContent() {
    if (!state.data) return;
    const matches = filteredMatches();
    const renderers = { board: renderBoard, schedule: renderSchedule, odds: renderOdds, results: renderResults };
    $("#content").innerHTML = matches.length
      ? renderers[state.tab](matches)
      : '<div class="empty"><strong>没有匹配的比赛</strong><small>请调整搜索条件</small></div>';
    bindContentEvents();
  }

  function renderHeader() {
    const data = state.data;
    $("#heroDate").textContent = formatDate(data.business_date);
    $("#heroMeta").textContent = `官方赔率最后快照：${formatTime(data.latest_snapshot)} · 共 ${data.matches.length} 场在册`;
    $("#syncTime").textContent = `更新 ${formatTime(data.generated_at)}`;
    document.title = `${formatDate(data.business_date)} 竞足研判｜竞足指挥台`;
  }

  async function loadDate(dateValue) {
    $("#content").innerHTML = '<div class="loading"><span></span><strong>正在读取公开档案</strong><small>同步比赛、赔率与预测记录…</small></div>';
    try {
      const response = await fetch(`data/${encodeURIComponent(dateValue)}.json`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.data = await response.json();
      $("#dateSelect").value = dateValue;
      renderHeader();
      renderMetrics();
      renderBettingPlan();
      renderContent();
      const url = new URL(window.location.href);
      url.searchParams.set("date", dateValue);
      history.replaceState(null, "", url);
    } catch (error) {
      $("#content").innerHTML = `<div class="error"><strong>公开档案读取失败</strong><small>${esc(error.message)}，请稍后刷新页面</small></div>`;
    }
  }

  function analysisProbability(title, values) {
    return `<article class="analysis-box"><h4>${title}</h4><div class="probabilities">
      <span><small>${title.includes("让球") ? "让胜" : "胜"}</small><strong>${pct(values[0])}</strong></span>
      <span><small>${title.includes("让球") ? "让平" : "平"}</small><strong>${pct(values[1])}</strong></span>
      <span><small>${title.includes("让球") ? "让负" : "负"}</small><strong>${pct(values[2])}</strong></span>
    </div></article>`;
  }

  function openAnalysis(matchId) {
    const match = state.data.matches.find((item) => item.match_id === matchId);
    if (!match?.analysis_detail) return;
    const detail = match.analysis_detail;
    const factors = Object.entries(detail.factors || {}).map(([key, value]) => `
      <article class="factor"><strong>${esc(factorLabels[key] || key)}</strong><p>${esc(value)}</p></article>`).join("");
    const risks = (detail.risks || []).map((risk) => `<li>${esc(risk)}</li>`).join("");
    const evidence = (detail.evidence || []).map((item) => {
      const body = `<span class="reliability ${item.reliability === "official" ? "official" : ""}">${esc(item.reliability || "来源")}</span><span><strong>${esc(item.source_title)}</strong><p>${esc(item.claim)}</p></span>`;
      return item.source_url ? `<a href="${esc(item.source_url)}" target="_blank" rel="noopener">${body}</a>` : `<div>${body}</div>`;
    }).join("");
    const reviewResult = strategyResult(match);
    const review = match.review_note ? `<article class="analysis-box full"><h4>赛后复盘 · ${esc(reviewResult.label)}</h4><p>${esc(match.review_note)}</p>${match.review_lesson ? `<p><strong>候选经验：</strong>${esc(match.review_lesson.replace(/^候选经验[:：]\s*/, ""))}</p>` : ""}</article>` : "";
    const combination = detail.combination ? `<article class="analysis-box full"><h4>覆盖策略</h4><p>${esc(detail.combination.selections.map((item) => `${item.label} ${item.units}注`).join(" + "))}；覆盖概率 ${pct(detail.combination.covered_probability)}。${esc(detail.combination.rationale || "")}</p></article>` : "";

    $("#modalContent").innerHTML = `
      <header class="modal-head">
        <div class="modal-kicker"><span>${esc(match.match_num_str)}</span><span>${esc(match.league_name)}</span><span>${esc(String(match.match_time || "").slice(0, 5))}</span></div>
        <h2 id="modalTitle">${esc(match.home_team)} <span>vs</span> ${esc(match.away_team)}</h2>
        <div class="modal-meta"><span class="execution-badge ${executionClass(match)}">${esc(executionLabel(match))}</span><span class="badge blue">${esc(editionLabel(match))}</span><span class="badge gray">信息截止 ${esc(formatTime(detail.info_cutoff))}</span></div>
      </header>
      <div class="modal-body">
        ${review}
        <section class="summary"><div><small>${hadAvailable(match) ? "联合净胜球诊断" : "正式预测（仅HHAD）"}</small><h3>${hadAvailable(match) ? `${esc(match.pick_had_label)} / ` : ""}${esc(handicap(match.goal_line))}让${esc(match.pick_hhad_label)}</h3><p>${hadAvailable(match) ? "该格子只用于净胜球分布校准，不是第二条推荐，不参与核心命中结算。" : "胜平负未开售，只按让球胜平负结算。"}</p></div><div class="summary-picks"><span class="${selectionClass(match, "had")}"><small>${esc(selectionCaption(match, "had", "胜平负"))}</small><strong>${esc(hadDirection(match))}</strong></span><span class="${selectionClass(match, "hhad")}"><small>${esc(selectionCaption(match, "hhad", `${handicap(match.goal_line)} 让球`))}</small><strong>${esc(hhadDirection(match))}</strong></span></div></section>
        <section class="analysis-grid">
          <article class="analysis-box full"><h4>核心判断</h4><p>${esc(detail.rationale || match.rationale)}</p></article>
          ${analysisProbability(hadAvailable(match) ? "胜平负概率" : "胜平负模型推演（未开售）", [match.prob_had_h, match.prob_had_d, match.prob_had_a])}
          ${analysisProbability(`${esc(handicap(match.goal_line))} 让球概率`, [match.prob_hhad_h, match.prob_hhad_d, match.prob_hhad_a])}
          ${combination}
          <article class="analysis-box full"><h4>关键维度</h4><div class="factor-grid">${factors || '<p>暂无维度说明</p>'}</div></article>
          <article class="analysis-box"><h4>主要风险</h4><ul class="risk-list">${risks || "<li>暂无单列风险</li>"}</ul></article>
          <article class="analysis-box"><h4>证据来源</h4><div class="evidence">${evidence || "暂无公开来源"}</div></article>
        </section>
      </div>`;
    openModal(false);
  }

  async function openReport(path, title) {
    if (!path) return;
    $("#modalContent").innerHTML = `<div class="report-viewer"><header class="modal-head"><div class="modal-kicker">归档报告</div><h2 id="modalTitle">${esc(title)}</h2></header><pre class="report-text">正在读取…</pre></div>`;
    openModal(true);
    try {
      const response = await fetch(encodeURI(path), { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      $(".report-text").textContent = await response.text();
    } catch (error) {
      $(".report-text").textContent = `报告读取失败：${error.message}`;
    }
  }

  function openModal(reportMode) {
    $("#modal").hidden = false;
    $("#modal").classList.toggle("report-viewer", reportMode);
    document.body.style.overflow = "hidden";
    $(".modal-close").focus();
  }

  function closeModal() {
    $("#modal").hidden = true;
    document.body.style.overflow = "";
  }

  async function init() {
    try {
      const response = await fetch("data/index.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.index = await response.json();
      $("#dateSelect").innerHTML = state.index.dates.map((date) => `<option value="${esc(date)}">${formatDate(date)}</option>`).join("");
      const requested = new URL(window.location.href).searchParams.get("date");
      const initial = state.index.dates.includes(requested) ? requested : state.index.default_date;
      await loadDate(initial);
    } catch (error) {
      $("#content").innerHTML = `<div class="error"><strong>站点尚未生成公开数据</strong><small>${esc(error.message)}</small></div>`;
    }
  }

  $("#dateSelect").addEventListener("change", (event) => loadDate(event.target.value));
  $("#searchInput").addEventListener("input", (event) => { state.query = event.target.value; renderContent(); });
  $$(".tabs button").forEach((button) => button.addEventListener("click", () => {
    state.tab = button.dataset.tab;
    $$(".tabs button").forEach((item) => item.classList.toggle("active", item === button));
    renderContent();
  }));
  $$('[data-close]').forEach((button) => button.addEventListener("click", closeModal));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$("#modal").hidden) closeModal(); });

  init();
})();
