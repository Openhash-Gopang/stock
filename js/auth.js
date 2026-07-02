// ── K-Stock 인증 (gopang-sso.js 위임) ────────────────────
// school/auth.js 구조 완전 동일
// 백서 §12.11: K-Stock 최소 인증 레벨 L0 (조회)
// 중요 기능(포트폴리오 변경, 목표 수정): L1

let gopangAuth = null;
let _user = null;

async function _loadSSO() {
  if (gopangAuth) return;
  try {
    // hondi.net에서 중앙 SSO 라이브러리 동적 로드
    const mod = await import('https://hondi.net/auth/gopang-sso.js');
    gopangAuth = mod.gopangAuth;
  } catch(e) {
    console.warn('[Auth] gopang-sso.js 로드 실패, 로컬 폴백:', e.message);
    gopangAuth = _localFallback();
  }
}

// ── 공개 API (school/auth.js와 동일 시그니처) ────────────

async function initAuth() {
  await _loadSSO();
  _user = await gopangAuth.require('L0');
  if (!_user) return null;   // 리다이렉트 중 → 이하 코드 실행 안 됨
  renderAuthBadge();
  return _user;
}

async function requireLevel(level) {
  await _loadSSO();
  const result = await gopangAuth.require(level);
  if (result) { _user = result; renderAuthBadge(); }
  return result;
}

// ── 배지 렌더링 ──────────────────────────────────────────
function renderAuthBadge() {
  const el = document.getElementById('auth-badge') ||
             document.getElementById('level-badge');
  if (!el || !_user) return;

  const cfg = {
    L0: { label:'L0', color:'var(--txt-3,#9ca3af)' },
    L1: { label:'L1', color:'#00bcd4' },
    L2: { label:'L2', color:'#3ecf8e' },
    L3: { label:'L3', color:'#ff9800' },
  };
  const c = cfg[_user.level] || cfg.L0;
  el.style.color = c.color;
  el.textContent = c.label;
  el.title       = _user.ipv6 || '';
  el.onclick     = showAuthPanel;
}

// ── 인증 패널 (school/auth.js showAuthPanel 동일) ────────
function showAuthPanel() {
  const modal   = document.getElementById('auth-modal');
  const content = document.getElementById('auth-modal-content');
  if (!modal || !content) return;

  content.innerHTML = `
    <div style="text-align:center;padding:8px 0 16px">
      <div style="font-size:32px;margin-bottom:8px">🔑</div>
      <div style="font-size:16px;font-weight:700;color:var(--txt-1,#1c1c1c);margin-bottom:4px">고팡 인증</div>
    </div>
    <div style="font-size:12px;color:var(--txt-2,#6b7280);line-height:1.8;margin-bottom:16px">
      K-Stock은 고팡(hondi.net) 인증을 사용합니다.<br>
      현재 레벨: <strong style="color:#2563eb">${_user?.level || 'L0'}</strong>
      &nbsp;|&nbsp; IPv6: <code style="font-size:10px;color:var(--txt-3,#9ca3af)">${(_user?.ipv6||'').slice(0,24)}…</code>
    </div>
    <a href="https://hondi.net" target="_blank"
       style="display:block;text-align:center;padding:9px;border-radius:6px;background:#2563eb;color:#fff;font-size:13px;font-weight:600;text-decoration:none;margin-bottom:8px">
       고팡 앱 열기
    </a>
    <button onclick="closeAuthModal()"
       style="display:block;width:100%;padding:8px;border-radius:6px;background:none;border:1px solid var(--border,#e5e7eb);font-size:13px;color:var(--txt-2,#6b7280);cursor:pointer">
       닫기
    </button>
  `;
  modal.classList.add('open');
}

function closeAuthModal() {
  document.getElementById('auth-modal')?.classList.remove('open');
}

// ── 로컬 폴백 (school/auth.js _localFallback 동일) ───────
function _localFallback() {
  const STORE   = 'gopang_user_v3';     // gopang_v2와 공유 키
  const SESSION = 'gopang_sso_token';   // gopang-sso.js와 공유 키
  const LVL     = { L0:0, L1:1, L2:2, L3:3 };

  return {
    async require(level) {
      // 1) sessionStorage 캐시 확인
      try {
        const s = JSON.parse(sessionStorage.getItem(SESSION) || 'null');
        if (s?.exp && Date.now() / 1000 < s.exp && LVL[s.level] >= LVL[level])
          return { ...s, via: 'session' };
      } catch {}

      // 2) localStorage gopang_user_v3 확인
      const stored = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!stored?.ipv6) { _showLoginPrompt(); return null; }

      const exp   = Math.floor(Date.now() / 1000) + 3600;
      const token = { ipv6: stored.ipv6, level: stored.authLevel || 'L0', exp };
      sessionStorage.setItem(SESSION, JSON.stringify(token));

      if (LVL[token.level] < LVL[level]) { _showLoginPrompt(level); return null; }
      return { ...token, via: 'local' };
    },

    async verify(level) { return this.require(level); },

    session() {
      try { return JSON.parse(sessionStorage.getItem(SESSION) || 'null'); }
      catch { return null; }
    },

    logout() { sessionStorage.removeItem(SESSION); },
  };
}

function _showLoginPrompt(level) {
  const modal   = document.getElementById('auth-modal');
  const content = document.getElementById('auth-modal-content');
  if (!modal || !content) {
    // auth-modal이 없으면 body에 간단 오버레이 표시
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
    overlay.innerHTML = `
      <div style="background:#fff;width:100%;max-width:480px;border-radius:16px 16px 0 0;padding:24px;text-align:center">
        <div style="font-size:24px;margin-bottom:8px">🔒</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:8px">고팡 인증 필요</div>
        <div style="font-size:12px;color:#6b7280;margin-bottom:16px">
          K-Stock은 고팡(hondi.net) 인증을 사용합니다.${level ? '<br>' + level + ' 인증이 필요합니다.' : ''}
        </div>
        <a href="https://hondi.net" target="_blank" style="display:block;padding:10px;border-radius:8px;background:#2563eb;color:#fff;font-size:13px;font-weight:600;text-decoration:none;margin-bottom:8px">hondi.net 열기</a>
        <button onclick="location.reload()" style="width:100%;padding:9px;border-radius:8px;background:none;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;cursor:pointer">인증 후 새로고침</button>
      </div>`;
    document.body.appendChild(overlay);
    return;
  }

  content.innerHTML = `
    <div style="text-align:center;padding:8px 0 16px">
      <div style="font-size:32px;margin-bottom:8px">🔒</div>
      <div style="font-size:16px;font-weight:700;color:var(--txt-1,#1c1c1c);margin-bottom:4px">고팡 인증 필요</div>
    </div>
    <div style="font-size:12px;color:var(--txt-2,#6b7280);line-height:1.7;margin-bottom:16px;padding:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px">
      ⚠️ K-Stock은 고팡(hondi.net) 인증을 사용합니다.
      ${level ? '<br><strong>' + level + '</strong> 인증이 필요합니다.' : ''}
    </div>
    <a href="https://hondi.net" target="_blank"
       style="display:block;text-align:center;padding:9px;border-radius:6px;background:#2563eb;color:#fff;font-size:13px;font-weight:600;text-decoration:none;margin-bottom:8px">
       hondi.net 열기
    </a>
    <button onclick="location.reload()"
       style="display:block;width:100%;padding:8px;border-radius:6px;background:none;border:1px solid var(--border,#e5e7eb);font-size:13px;color:var(--txt-2,#6b7280);cursor:pointer">
       인증 후 새로고침
    </button>
  `;
  modal.classList.add('open');
}
