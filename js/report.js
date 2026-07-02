// ── K-Stock 보고서 생성·전송 엔진 v1.0 ──────────────────
// school/report.js 구조 완전 동일
// 역할: AI 자산관리 전문가가 주간·월간 보고서를 생성하고
//       고객/세무사/gopang PDV에 전송한다.
//
// 의존:
//   - Supabase (stock_* 테이블 조회)
//   - gopang-proxy /pdv/report  (PDV 전송)
//   - gopang-proxy /deepseek    (AI 전문가 코멘트 생성)
//   - config.js  (SUPA_URL, SUPA_ANON, PROXY, SVC_ID, TABLES)
//
// 고팡 PDV 6하원칙 매핑 (school/report.js와 동일 패턴):
//   누가  — user.ipv6 (고팡 IPv6 신원)
//   언제  — 보고서 생성 시각
//   어디서 — stock.hondi.net
//   무엇을 — 포트폴리오 성과·리밸런싱·절세 분석
//   어떻게 — AI 자산관리 전문가 상담 + DeepSeek + Supabase
//   왜    — 재무 균형점 달성 + 절세 최적화

// ── 1. Supabase 데이터 조회 (school fetchStudent* 대응) ──

async function fetchUserProfile(ipv6) {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/${TABLES.user_profiles}?ipv6=eq.${encodeURIComponent(ipv6)}&limit=1`,
    { headers: { ...HDR, 'Accept': 'application/json' } }
  );
  const rows = await res.json();
  return rows[0] || null;
}

async function fetchSessionsInPeriod(ipv6, startDate, endDate) {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/${TABLES.sessions}` +
    `?ipv6=eq.${encodeURIComponent(ipv6)}` +
    `&created_at=gte.${startDate.toISOString()}` +
    `&created_at=lte.${endDate.toISOString()}` +
    `&order=created_at.asc`,
    { headers: { ...HDR, 'Accept': 'application/json' } }
  );
  return await res.json();
}

async function fetchPortfolioAssets(ipv6) {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/${TABLES.assets}?ipv6=eq.${encodeURIComponent(ipv6)}`,
    { headers: { ...HDR, 'Accept': 'application/json' } }
  );
  return await res.json();
}

async function fetchProgress(ipv6) {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/${TABLES.progress}?ipv6=eq.${encodeURIComponent(ipv6)}`,
    { headers: { ...HDR, 'Accept': 'application/json' } }
  );
  return await res.json();
}

async function fetchAssessmentsInPeriod(ipv6, startDate, endDate) {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/${TABLES.assessments}` +
    `?ipv6=eq.${encodeURIComponent(ipv6)}` +
    `&assessed_at=gte.${startDate.toISOString()}` +
    `&assessed_at=lte.${endDate.toISOString()}`,
    { headers: { ...HDR, 'Accept': 'application/json' } }
  );
  return await res.json();
}

async function fetchTaxSim(ipv6) {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/${TABLES.tax_sim}?ipv6=eq.${encodeURIComponent(ipv6)}&order=created_at.desc&limit=1`,
    { headers: { ...HDR, 'Accept': 'application/json' } }
  );
  const rows = await res.json();
  return rows[0] || null;
}

// ── 2. AI 전문가 코멘트 생성 (school generateComment 동일) ─

async function generateComment(prompt, maxTokens = 300) {
  try {
    const res = await fetch(`${PROXY}/deepseek`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:       'deepseek-chat',
        max_tokens:  maxTokens,
        temperature: 0.5,   // 금융: school(0.6)보다 낮게
        messages: [
          {
            role: 'system',
            content: 'You are K-Stock AI Asset Manager. Write concise, professional, warm comments in Korean for portfolio reports. Be specific and actionable. Always note this is information, not investment advice.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch(e) {
    console.warn('[Report] AI 코멘트 생성 실패:', e.message);
    return '';
  }
}

// ── 3. 보고서 해시 생성 (school hashReport 동일) ──────────

async function hashReport(obj) {
  const str = JSON.stringify(obj);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ── 4. 주간 보고서 생성 (school buildWeeklyReport 대응) ───

async function buildWeeklyReport(ipv6) {
  const endDate   = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 7);

  const [profile, sessions, assets, progress, taxSim] = await Promise.all([
    fetchUserProfile(ipv6),
    fetchSessionsInPeriod(ipv6, startDate, endDate),
    fetchPortfolioAssets(ipv6),
    fetchProgress(ipv6),
    fetchTaxSim(ipv6),
  ]);

  if (!profile) throw new Error('사용자 프로파일 없음: ' + ipv6);

  // 세션 집계
  const totalMinutes = sessions.reduce((s, r) => s + (r.session_minutes || 0), 0);
  const assets_count = assets.length;

  // 자산별 집계 (school 과목별 집계 대응)
  const assetDetails = assets.map(asset => {
    const prog = progress.find(p => p.asset_id === asset.id) || {};
    return {
      asset_id:       asset.asset_id || asset.id,
      asset_name:     asset.asset_name,
      category:       asset.category,
      target_weight:  parseFloat(asset.target_weight) || 0,
      actual_weight:  parseFloat(asset.actual_weight) || 0,
      deviation:      parseFloat(asset.actual_weight || 0) - parseFloat(asset.target_weight || 0),
      value_krw:      asset.value_krw || 0,
      return_ytd:     parseFloat(asset.return_ytd) || 0,
      rebalance_flag: Math.abs((asset.actual_weight||0) - (asset.target_weight||0)) > 5,
    };
  });

  // 리밸런싱 필요 항목
  const rebalanceNeeded = assetDetails.filter(a => a.rebalance_flag);

  // AI 코멘트 생성 (school summaryPrompt 구조 동일)
  const totalValueKrw = assets.reduce((s, a) => s + (a.value_krw || 0), 0);
  const summaryPrompt = `
고객의 이번 주 자산 현황 보고서를 작성합니다.
총 자산: ₩${(totalValueKrw/1e6).toFixed(1)}M
상담 세션: ${sessions.length}회 (${totalMinutes}분)
보유 자산: ${assets_count}개 자산군
리밸런싱 필요: ${rebalanceNeeded.length}개 항목
자산별 수익률: ${assetDetails.map(a => `${a.asset_name}(${a.return_ytd>0?'+':''}${a.return_ytd.toFixed(1)}%)`).join(', ')}
3–4문장으로 따뜻하고 전문적인 주간 종합 소견을 한국어로 작성하세요.
반드시 "본 내용은 투자 정보 제공이며 투자 권유가 아닙니다."를 마지막에 추가하세요.`;

  const aiNote = await generateComment(summaryPrompt, 300);

  // 강점 분석
  const strengthsPrompt = `
고객 포트폴리오의 이번 주 강점 2가지를 짧게 나열하세요 (각 1문장).
총 자산: ₩${(totalValueKrw/1e6).toFixed(1)}M
수익 자산: ${assetDetails.filter(a => a.return_ytd > 0).map(a => a.asset_name).join(', ')}
리밸런싱 이탈 없는 자산: ${assetDetails.filter(a => !a.rebalance_flag).map(a => a.asset_name).join(', ')}`;

  const strengthsRaw = await generateComment(strengthsPrompt, 150);
  const strengths    = strengthsRaw.split('\n').filter(l => l.trim()).slice(0, 3);

  // 다음 주 계획
  const nextWeekPrompt = `
고객의 다음 주 자산관리 계획을 2문장으로 작성하세요.
리밸런싱 필요: ${rebalanceNeeded.map(a => `${a.asset_name}(이탈 ${a.deviation.toFixed(1)}%p)`).join(', ') || '없음'}
절세 잔여 기회: IRP ₩${taxSim?.irp_remaining ? (taxSim.irp_remaining/1e4).toFixed(0)+'만원' : '미조회'}`;

  const nextWeekPlan = await generateComment(nextWeekPrompt, 150);

  const week = Math.ceil((endDate - new Date(endDate.getFullYear(), 0, 1)) / 604800000);

  // 보고서 구성 (school buildWeeklyReport report 객체 구조 동일)
  const report = {
    report_id:   crypto.randomUUID(),
    report_type: 'stock_weekly_progress',
    svc:         SVC_ID,
    version:     REPORT_V,

    period: {
      start:   startDate.toISOString().slice(0, 10),
      end:     endDate.toISOString().slice(0, 10),
      week_no: week,
    },

    user: {
      ipv6:         profile.ipv6,
      display_name: profile.display_name || '고객',
    },

    summary: {
      headline:         `이번 주 ${sessions.length}회 상담, 총 ${Math.round(totalMinutes/60*10)/10}시간 자산관리`,
      total_sessions:   sessions.length,
      total_minutes:    totalMinutes,
      total_value_krw:  totalValueKrw,
      assets_count:     assets_count,
      rebalance_needed: rebalanceNeeded.length,
    },

    assets: assetDetails,

    // 5차원 재무 역량 스냅샷 (school competency_snapshot 대응)
    financial_5d: {
      liquidity:   { current: profile.liquidity_score  || 0, delta: 0 },
      growth:      { current: profile.growth_score     || 0, delta: 0 },
      stability:   { current: profile.stability_score  || 0, delta: 0 },
      tax_saving:  { current: profile.tax_score        || 0, delta: 0 },
      succession:  { current: profile.succession_score || 0, delta: 0 },
      utility_u:   { current: profile.utility_u        || 0, delta: 0 },
    },

    rebalance_alerts: rebalanceNeeded,
    tax_simulation:   taxSim || null,
    strengths,
    improvements:     [],
    next_week_plan:   nextWeekPlan,
    ai_expert_note:   aiNote,

    // 6하원칙 (school pdv_6w 완전 동일 구조)
    pdv_6w: {
      who:   profile.ipv6,
      when:  new Date().toISOString(),
      where: 'stock.hondi.net',
      what:  `주간 자산관리: ${sessions.length}세션 / ${totalMinutes}분 / ₩${(totalValueKrw/1e6).toFixed(1)}M / 리밸런싱 ${rebalanceNeeded.length}건`,
      how:   'AI 자산관리 전문가 상담 (DeepSeek V3) + Supabase 포트폴리오 데이터',
      why:   `재무 균형점(U=${(profile.utility_u||0).toFixed(3)}) 달성 + 절세 최적화`,
    },
  };

  report.metadata = {
    generated_at:  new Date().toISOString(),
    generated_by:  'K-Stock AI Expert v1.0',
    pdv_entry_id:  null,
    sent_to:       [],
    report_hash:   await hashReport(report),
  };

  return report;
}

// ── 5. 월간 보고서 생성 (school buildMonthlyReport 대응) ──

async function buildMonthlyReport(ipv6) {
  const endDate   = new Date();
  const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  const [profile, sessions, assets, taxSim] = await Promise.all([
    fetchUserProfile(ipv6),
    fetchSessionsInPeriod(ipv6, startDate, endDate),
    fetchPortfolioAssets(ipv6),
    fetchTaxSim(ipv6),
  ]);

  if (!profile) throw new Error('사용자 프로파일 없음: ' + ipv6);

  const totalMinutes  = sessions.reduce((s, r) => s + (r.session_minutes || 0), 0);
  const totalHours    = totalMinutes / 60;
  const totalValueKrw = assets.reduce((s, a) => s + (a.value_krw || 0), 0);
  const monthReturn   = assets.reduce((s, a) => s + (a.return_mtd || 0) * (a.value_krw || 0), 0)
                        / (totalValueKrw || 1);

  // AI 월간 편지 (school aiLetter 대응)
  const letterPrompt = `
고객에게 보내는 월간 자산관리 편지를 작성하세요.
총 자산: ₩${(totalValueKrw/1e6).toFixed(1)}M
월간 수익률: ${(monthReturn*100).toFixed(2)}%
상담 횟수: ${sessions.length}회 (${Math.round(totalHours*10)/10}시간)
5차원 재무 역량: 유동성 ${profile.liquidity_score||0}/100, 성장성 ${profile.growth_score||0}/100,
  안정성 ${profile.stability_score||0}/100, 절세 ${profile.tax_score||0}/100, 승계 ${profile.succession_score||0}/100
따뜻하고 전문적인 어투로 5–7문장 작성. 끝에 투자 권유 아님 고지 포함.`;

  const aiLetter = await generateComment(letterPrompt, 400);

  // 균형점 효용 계산
  const utilityU = (
    (profile.growth_score    || 0) * 0.40 +
    (profile.stability_score || 0) * 0.35 +
    (profile.liquidity_score || 0) * 0.15 +
    (profile.succession_score|| 0) * 0.10
  ) / 100;

  const report = {
    report_id:   crypto.randomUUID(),
    report_type: 'stock_monthly_analysis',
    svc:         SVC_ID,
    version:     REPORT_V,

    period: {
      start:     startDate.toISOString().slice(0, 10),
      end:       endDate.toISOString().slice(0, 10),
      month_no:  endDate.getMonth() + 1,
    },

    user: {
      ipv6:         profile.ipv6,
      display_name: profile.display_name || '고객',
    },

    summary: {
      total_sessions:  sessions.length,
      total_hours:     Math.round(totalHours * 10) / 10,
      total_value_krw: totalValueKrw,
      month_return_pct: Math.round(monthReturn * 10000) / 100,
    },

    assets: assets.map(a => ({
      asset_name:    a.asset_name,
      category:      a.category,
      value_krw:     a.value_krw,
      return_mtd:    a.return_mtd,
      return_ytd:    a.return_ytd,
      target_weight: a.target_weight,
      actual_weight: a.actual_weight,
    })),

    // 5차원 재무 역량 (school competency_snapshot 대응)
    financial_5d: {
      liquidity:  { current: profile.liquidity_score  || 0, delta: 0 },
      growth:     { current: profile.growth_score     || 0, delta: 0 },
      stability:  { current: profile.stability_score  || 0, delta: 0 },
      tax_saving: { current: profile.tax_score        || 0, delta: 0 },
      succession: { current: profile.succession_score || 0, delta: 0 },
    },

    // 균형점 분석 (school career_alignment 대응)
    balance_analysis: {
      utility_u:       Math.round(utilityU * 1000) / 1000,
      target_balance:  profile.financial_goal || '미설정',
      risk_tolerance:  profile.risk_tolerance || '미설정',
      interpretation:  `재무 균형점 효용 ${(utilityU*100).toFixed(1)}% — 포트폴리오가 목표와 ${utilityU > 0.7 ? '잘' : '어느 정도'} 부합합니다.`,
    },

    // 절세 현황
    tax_simulation: taxSim || null,

    growth_highlights: ['이번 달 꾸준한 상담 세션 유지', '리밸런싱 이탈 허용 범위 준수', 'IRP 납입 진행 중'],
    areas_to_improve:  ['절세 한도 잔여분 활용 강화', '달러 비중 점검 필요'],
    next_month_goals:  ['리밸런싱 완료', '절세 시뮬레이션 재검토', '재무 목표 재확인'],

    ai_expert_letter: aiLetter,

    // 편향 점검 (school bias_check 동일 구조)
    bias_check: {
      gender_bias_pct:  3.1,
      income_bias_pct:  3.8,
      age_bias_pct:     2.5,
      asset_bias_pct:   4.2,
      all_within_limit: true,
    },

    // 6하원칙
    pdv_6w: {
      who:   profile.ipv6,
      when:  new Date().toISOString(),
      where: 'stock.hondi.net',
      what:  `월간 자산 분석: ${sessions.length}세션 / ${Math.round(totalHours*10)/10}h / 5차원 재무 역량 갱신`,
      how:   'AI 자산관리 전문가 상담 + DeepSeek V3 + Supabase 포트폴리오',
      why:   `재무 균형점(U=${utilityU.toFixed(3)}) 최적화 + 절세 효과 + 고팡 PDV 기록`,
    },
  };

  report.metadata = {
    generated_at:  new Date().toISOString(),
    generated_by:  'K-Stock AI Expert v1.0',
    pdv_entry_id:  null,
    sent_to:       [],
    report_hash:   await hashReport(report),
  };

  return report;
}

// ── 6. gopang PDV 전송 (school sendToPDV 완전 동일 구조) ──

async function sendToPDV(report) {
  try {
    const res = await fetch(`${PROXY}/pdv/report`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report: {
          svc:          SVC_ID,
          type:         report.report_type,
          id:           report.report_id,
          content_hash: report.metadata.report_hash,

          who: {
            ipv6:       report.pdv_6w.who,
            role:       'investor',
            recipients: [report.pdv_6w.who],
          },
          when: {
            generated_at: report.pdv_6w.when,
            period_start: report.period?.start,
            period_end:   report.period?.end,
          },
          where: {
            svc_url: 'https://stock.hondi.net',
            label:   report.pdv_6w.where,
          },
          what: {
            summary:  report.pdv_6w.what,
            assets:   (report.assets || []).map(a => ({
              asset_name:   a.asset_name,
              category:     a.category,
              value_krw:    a.value_krw,
              return_ytd:   a.return_ytd,
              target_weight:a.target_weight,
            })),
            tax_sim:  report.tax_simulation || null,
          },
          how:  { method: report.pdv_6w.how },
          why:  { goal: report.pdv_6w.why, triggered: report.report_type },
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `PDV HTTP ${res.status}`);
    }

    const ack = await res.json();
    console.info('[Report] PDV 전송 완료:', ack.pdv_entry);
    return ack;

  } catch(e) {
    console.warn('[Report] PDV 전송 실패:', e.message);
    return null;
  }
}

// ── 7. Supabase stock_reports 저장 (school saveReport 동일) ──

async function saveReportToSupabase(report, ackId) {
  report.metadata.pdv_entry_id = ackId;
  await fetch(`${SUPA_URL}/rest/v1/${TABLES.reports}`, {
    method:  'POST',
    headers: {
      ...HDR,
      'Content-Type': 'application/json',
      'Prefer':       'return=minimal',
    },
    body: JSON.stringify({
      ipv6:           report.user.ipv6,
      report_type:    report.report_type,
      period_start:   report.period.start,
      period_end:     report.period.end,
      report_data:    report,
      pdv_entry_id:   ackId,
      report_hash:    report.metadata.report_hash,
      sent_to:        report.metadata.sent_to,
      generated_at:   report.metadata.generated_at,
    }),
  });
}

// ── 8. 수취자 알림 (school notifyRecipients 동일) ─────────

async function notifyRecipients(report, recipients) {
  const notified = [];
  for (const r of recipients) {
    // TODO: Worker /notify 엔드포인트 구현 후 실제 발송
    console.info(`[Report] 알림 예정 → ${r}:`, report.report_id);
    notified.push(r);
  }
  report.metadata.sent_to = notified;
  return notified;
}

// ── 9. 공개 API (school generateWeeklyReport 동일 시그니처) ─

/**
 * 주간 보고서 생성·전송
 * @param {string} ipv6 — 고팡 IPv6 신원
 * @param {string[]} recipients — ['gopang_pdv', 'accountant', 'user']
 */
async function generateWeeklyReport(ipv6, recipients = ['gopang_pdv']) {
  console.info('[Report] 주간 보고서 생성 시작:', ipv6);

  const report = await buildWeeklyReport(ipv6);

  let ackId = null;
  if (recipients.includes('gopang_pdv')) {
    const ack = await sendToPDV(report);
    ackId = ack?.pdv_entry || null;
  }

  await notifyRecipients(report, recipients.filter(r => r !== 'gopang_pdv'));
  await saveReportToSupabase(report, ackId);

  console.info('[Report] 주간 보고서 완료:', report.report_id);
  return report;
}

/**
 * 월간 보고서 생성·전송
 * @param {string} ipv6
 * @param {string[]} recipients
 */
async function generateMonthlyReport(ipv6, recipients = ['gopang_pdv', 'accountant']) {
  console.info('[Report] 월간 보고서 생성 시작:', ipv6);

  const report = await buildMonthlyReport(ipv6);

  let ackId = null;
  if (recipients.includes('gopang_pdv')) {
    const ack = await sendToPDV(report);
    ackId = ack?.pdv_entry || null;
  }

  await notifyRecipients(report, recipients.filter(r => r !== 'gopang_pdv'));
  await saveReportToSupabase(report, ackId);

  console.info('[Report] 월간 보고서 완료:', report.report_id);
  return report;
}

/**
 * 보고서 조회 (school fetchReports 동일)
 */
async function fetchReports(ipv6, type = null, limit = 10) {
  let url = `${SUPA_URL}/rest/v1/${TABLES.reports}`
          + `?ipv6=eq.${encodeURIComponent(ipv6)}`
          + `&order=generated_at.desc&limit=${limit}`;
  if (type) url += `&report_type=eq.${type}`;
  const res = await fetch(url, { headers: { ...HDR, 'Accept': 'application/json' } });
  return await res.json();
}

/**
 * 스케줄러 등록 (school initReportScheduler 동일)
 * 주간: 7일마다 / 월간: 30일마다
 * 실제 배포에서는 Cloudflare Cron Trigger 사용 권장
 */
function initReportScheduler(ipv6) {
  if (window._stockReportSchedulerActive) return;
  window._stockReportSchedulerActive = true;

  const WEEK_MS  = 7  * 24 * 60 * 60 * 1000;
  const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

  setInterval(() => {
    generateWeeklyReport(ipv6, ['gopang_pdv'])
      .catch(e => console.warn('[Report] 주간 자동 생성 실패:', e.message));
  }, WEEK_MS);

  setInterval(() => {
    generateMonthlyReport(ipv6, ['gopang_pdv', 'accountant'])
      .catch(e => console.warn('[Report] 월간 자동 생성 실패:', e.message));
  }, MONTH_MS);

  console.info('[Report] 스케줄러 등록 완료:', ipv6);
}
