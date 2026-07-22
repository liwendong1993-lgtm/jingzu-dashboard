(() => {
  "use strict";

  const state = { index: null, data: null, tab: "board", query: "" };
  const stageMeta = {
    pending: ["待分析", "已入库，等待预测"],
    locked: ["预测已锁定", "初版或终版已归档"],
    pending_review: ["完赛待复盘", "已有赛果，等待归因"],
    reviewed: ["复盘完成", "指标与经验已沉淀"],
  };
  const factorLabels = {
    strength_form: "实力与近期状态",
    availability_rotation: "伤病、停赛与轮换",
    motivation_format: "战意与赛制背景",
    tactics_matchup: "战术与对位",
    schedule_environment: "赛程与比赛环境",
    market_movement: "赔率与市场变化",
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char]);
  const pct = (value) => typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "—";
  const odds = (value) => typeof value === "number" ? value.toFixed(2) : "—";
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
  const confidenceTone = (match) => match.confidence === "high" ? "green" : match.confidence === "low" ? "gray" : "amber";

  function filteredMatches() {
    const query = state.query.trim().toLowerCase();
    if (!query) return state.data?.matches || [];
    return state.data.matches.filter((match) => [
      match.match_num_str, match.league_name, match.home_team, match.away_team,
    ].some((value) => String(value || "").toLowerCase().includes(query)));
  }

  function probabilityBar(values) {
    return `<div class="prob-bar" aria-label="胜平负概率">${values.map((value) => `<i style="width:${Math.max(0, (value || 0) * 100)}%"></i>`).join("")}</div>`;
  }

  function renderMetrics() {
    const data = state.data;
    const matches = data.matches || [];
    const reviewed = matches.filter((match) => match.reviewed);
    const settled = matches.filter(hasResult);
    const correct = reviewed.reduce((sum, match) => sum + Number(match.strategy_correct || 0), 0);
    const score = reviewed.reduce((sum, match) => sum + Number(match.score_points || 0), 0);
    const primary = data.prediction_counts?.final
      ? `终版已锁 ${data.prediction_counts.final} 场`
      : `初版已完成 ${data.prediction_counts?.initial || 0} 场`;
    $("#metrics").innerHTML = `
      <article class="metric"><div><small>当日场次</small><strong class="accent">${matches.length}</strong></div><p>${esc(primary)}</p></article>
      <article class="metric"><div><small>已完赛 / 已复盘</small><strong class="green">${settled.length}<em> / ${reviewed.length}</em></strong></div><p>赛果归档后沉淀经验</p></article>
      <article class="metric"><div><small>策略命中率</small><strong class="amber">${reviewed.length ? pct(correct / reviewed.length) : "—"}</strong></div><p>${reviewed.length ? `累计积分 ${score >= 0 ? "+" : ""}${score.toFixed(1)}` : "等待结算样本"}</p></article>
      <article class="metric"><div><small>官方赔率快照</small><strong>${data.latest_snapshot ? "已同步" : "暂无"}</strong></div><p>${esc(formatTime(data.latest_snapshot))}</p></article>`;
  }

  function renderCard(match) {
    const detail = match.analysis_detail ? "查看完整分析" : "暂无分析详情";
    return `
      <button class="match-card" data-match="${match.match_id}" ${match.analysis_detail ? "" : "disabled"}>
        <div class="card-top"><span>${esc(match.match_num_str)}</span><small>${esc(match.league_name)} · ${esc(String(match.match_time || "").slice(0, 5))}</small></div>
        <div class="teams">
          <div><small>${esc(match.home_rank || "")}</small><strong title="${esc(match.home_team)}">${esc(match.home_team)}</strong></div>
          <span>vs</span>
          <div><small>${esc(match.away_rank || "")}</small><strong title="${esc(match.away_team)}">${esc(match.away_team)}</strong></div>
        </div>
        <div class="picks">
          <span class="pick"><small>胜平负</small><strong>${esc(match.pick_had_label || "待定")}</strong></span>
          <span class="pick"><small>${esc(handicap(match.goal_line))} 让球</small><strong>${esc(match.pick_hhad_label || "待定")}</strong></span>
        </div>
        ${probabilityBar([match.prob_had_h, match.prob_had_d, match.prob_had_a])}
        <div class="card-foot"><small>${esc(detail)}</small><span class="badge ${confidenceTone(match)}">信心 ${esc(match.confidence_label || "—")}</span></div>
      </button>`;
  }

  function renderBoard(matches) {
    return `<section class="kanban">${Object.entries(stageMeta).map(([stage, meta]) => {
      const group = matches.filter((match) => match.stage === stage);
      const className = stage.replace("_", "-");
      return `<section class="column ${className}">
        <header class="column-head"><div><h2>${meta[0]}</h2><p>${meta[1]}</p></div><strong>${group.length}</strong></header>
        <div class="column-body">${group.length ? group.map(renderCard).join("") : '<div class="column-empty">当前无比赛</div>'}</div>
      </section>`;
    }).join("")}</section>`;
  }

  function renderSchedule(matches) {
    return `<section class="panel">
      <header class="panel-head"><div><h2>赛程与已锁定预测</h2><p>同屏查看开球时间、两种玩法和预测概率</p></div><span>${matches.length} 场</span></header>
      <div>${matches.map((match) => `<article class="list-row">
        <div class="list-id"><strong>${esc(match.match_num_str)}</strong><span>${esc(String(match.match_time || "").slice(0, 5))}</span><small>${esc(match.league_name)}</small></div>
        <div class="list-teams">${esc(match.home_team)} <span>vs</span> ${esc(match.away_team)}</div>
        <div class="list-picks">
          <span class="mini-pick"><small>胜平负</small><strong>${esc(match.pick_had_label || "—")}</strong></span>
          <span class="mini-pick"><small>${esc(handicap(match.goal_line))} 让球</small><strong>${esc(match.pick_hhad_label || "—")}</strong></span>
          <span class="prob-copy">胜 ${pct(match.prob_had_h)} · 平 ${pct(match.prob_had_d)} · 负 ${pct(match.prob_had_a)}</span>
        </div>
        <div class="list-state"><span class="badge blue">${esc(editionLabel(match))}</span>${hasResult(match) ? `<strong>${match.score_home} : ${match.score_away}</strong>` : ""}${match.analysis_detail ? `<button class="detail-button" data-match="${match.match_id}">完整分析</button>` : ""}</div>
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
      <a class="report-link" href="${encodeURI(report.public_url || "#")}" target="_blank" rel="noopener">
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
        <header class="panel-head"><div><h2>赛程赛果</h2><p>完赛后核对胜平负、让球结果和策略得分</p></div><span>${matches.filter(hasResult).length} 场完赛</span></header>
        <div>${matches.map((match) => `<article class="result-row">
          <div class="list-id"><strong>${esc(match.match_num_str)}</strong><small>${esc(match.league_name)} · ${esc(String(match.match_time || "").slice(0, 5))}</small></div>
          <div class="scoreline"><span>${esc(match.home_team)}</span><strong>${hasResult(match) ? `${match.score_home} : ${match.score_away}` : "未完赛"}</strong><span>${esc(match.away_team)}</span></div>
          <div class="checks">${hasResult(match) ? `
            <span class="check ${match.correct_had ? "correct" : "missed"}"><b>${match.correct_had ? "✓" : "×"}</b><span><small>胜平负</small><strong>${esc(match.had_outcome_label)}</strong></span></span>
            <span class="check ${match.correct_hhad ? "correct" : "missed"}"><b>${match.correct_hhad ? "✓" : "×"}</b><span><small>让球</small><strong>${esc(match.hhad_outcome_label)}</strong></span></span>
            ${match.reviewed ? `<span class="check ${match.strategy_correct ? "correct" : "missed"}"><b>${match.strategy_correct ? "✓" : "×"}</b><span><small>${match.strategy_type === "combination" ? "组合" : "单选"}</small><strong>${typeof match.score_points === "number" ? `${match.score_points > 0 ? "+" : ""}${match.score_points.toFixed(1)}` : "—"}</strong></span></span>` : ""}` : '<span class="check wait">等待赛果</span>'}
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
    const review = match.review_note ? `<article class="analysis-box full"><h4>赛后复盘</h4><p>${esc(match.review_note)}</p>${match.review_lesson ? `<p><strong>候选经验：</strong>${esc(match.review_lesson.replace(/^候选经验[:：]\s*/, ""))}</p>` : ""}</article>` : "";
    const combination = detail.combination ? `<article class="analysis-box full"><h4>覆盖策略</h4><p>${esc(detail.combination.selections.map((item) => `${item.label} ${item.units}注`).join(" + "))}；覆盖概率 ${pct(detail.combination.covered_probability)}。${esc(detail.combination.rationale || "")}</p></article>` : "";

    $("#modalContent").innerHTML = `
      <header class="modal-head">
        <div class="modal-kicker"><span>${esc(match.match_num_str)}</span><span>${esc(match.league_name)}</span><span>${esc(String(match.match_time || "").slice(0, 5))}</span></div>
        <h2 id="modalTitle">${esc(match.home_team)} <span>vs</span> ${esc(match.away_team)}</h2>
        <div class="modal-meta"><span class="badge blue">${esc(editionLabel(match))}</span><span class="badge ${confidenceTone(match)}">信心 ${esc(match.confidence_label)}</span><span class="badge gray">信息截止 ${esc(formatTime(detail.info_cutoff))}</span></div>
      </header>
      <div class="modal-body">
        ${review}
        <section class="summary"><div><small>联动主情景</small><h3>${esc(match.pick_had_label)} / ${esc(handicap(match.goal_line))}让${esc(match.pick_hhad_label)}</h3><p>两种玩法来自同一可实现净胜球情景。</p></div><div class="summary-picks"><span><small>胜平负</small><strong>${esc(match.pick_had_label)}</strong></span><span><small>让球</small><strong>${esc(match.pick_hhad_label)}</strong></span></div></section>
        <section class="analysis-grid">
          <article class="analysis-box full"><h4>核心判断</h4><p>${esc(detail.rationale || match.rationale)}</p></article>
          ${analysisProbability("胜平负概率", [match.prob_had_h, match.prob_had_d, match.prob_had_a])}
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
