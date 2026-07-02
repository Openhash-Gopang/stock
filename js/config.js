// ── K-Stock 설정 ─────────────────────────────────────────
// school/config.js 구조 완전 동일, 도메인만 stock으로 교체

const SUPA_URL  = 'https://ebbecjfrwaswbdybbgiu.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViYmVjamZyd2Fzd2JkeWJiZ2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NjE5ODQsImV4cCI6MjA5NTEzNzk4NH0.H2ahQKtWdSke04Pdi3hDY86pdTx7UUKPUpQMlS_zciA';
const HDR = { 'apikey': SUPA_ANON, 'Authorization': 'Bearer ' + SUPA_ANON };

// AI 자산관리 전문가 시스템 프롬프트 경로
const SYSTEM_PROMPT_URL = '/prompts/system_prompt.txt';

// 서비스 식별자
// CNAME: stock.hondi.net → hostname.replace('.hondi.net','') = 'stock'
// gopang-sso.js _detectServiceId() 와 자동 일치
const SVC_ID   = 'stock';
const PROXY    = 'https://gopang-proxy.tensor-city.workers.dev';
const REPORT_V = '1.0';

// 자산군 정의 (school SCHOOL_STAGES 대응)
const ASSET_CLASSES = [
  { id:'kr_stock',  label:'국내주식',  color:'#2563eb' },
  { id:'us_stock',  label:'미국주식',  color:'#16a34a' },
  { id:'etf',       label:'ETF',       color:'#7c3aed' },
  { id:'bond',      label:'채권',      color:'#d97706' },
  { id:'reits',     label:'리츠',      color:'#dc2626' },
  { id:'commodity', label:'원자재',    color:'#b45309' },
  { id:'crypto',    label:'암호화폐',  color:'#0891b2' },
  { id:'pension',   label:'연금·IRP',  color:'#3ecf8e' },
];

// 7단계 프로세스 (school SEVEN_STAGES 1:1 대응)
const SEVEN_STAGES = [
  { n:1, title:'재무 프로파일 분석',       desc:'나이·소득·지출·부채·목표·위험성향 파악',              metric:'5차원 재무 역량: 유동성·성장성·안정성·절세·승계' },
  { n:2, title:'AI 판단 불가 영역 식별',   desc:'행동 편향·특수 상황 등 사람 판단 필요 영역 식별',     metric:'자동화 81% · 협업 14% · 전문가 판단 5%' },
  { n:3, title:'재무 균형점 탐색',         desc:'수익 극대화와 안정성이 교차하는 최적 포트폴리오 비율', metric:'U = 수익×0.40 + 안정×0.35 + 유동성×0.15 + 승계×0.10' },
  { n:4, title:'맞춤형 포트폴리오 설계',   desc:'목표·시장·세제 환경에 맞춰 자산 배분 실시간 생성',   metric:'CFA 89개 자산군 · Black-Litterman 모델' },
  { n:5, title:'매일·매주·매월 리뷰',     desc:'시장 변동마다 이탈도 체크 · 임계값 초과 시 제안',    metric:'이탈 허용 ±5% · VaR 95% 기준' },
  { n:6, title:'정기 보고 & 절세 계산',   desc:'주간·월간 수익 보고서 + 절세 시뮬레이션 자동 전송',  metric:'종합소득세·양도세·금융소득종합과세 자동' },
  { n:7, title:'목표 수정 & 재최적화',    desc:'생애 이벤트 발생 시 평균 2.3분 내 전면 재설계',      metric:'평균 처리 2.3분 · 언제든 목표 변경 가능' },
];

// AI 자산관리 전문가 (school AI_PROFESSOR 1:1 대응)
const AI_EXPERT = {
  id:      'expert-01',
  name:    'AI 자산관리 전문가',
  domains: ['국내주식·ETF', '미국·글로벌 주식', '채권·금리', '부동산·리츠',
            '원자재·달러', '암호화폐', '연금·IRP·ISA', '절세 전략',
            '리밸런싱', '30년 재무 계획'],
  desc:    '세상의 모든 자산군(89개)을 분석하며, 담당 고객 단 한 명을 전담 관리합니다.',
};

// Supabase 테이블 명세 (school_* → stock_*)
const TABLES = {
  user_profiles: 'user_profiles',
  sessions:      'stock_sessions',
  progress:      'stock_progress',
  assets:        'stock_assets',
  reports:       'stock_reports',
  assessments:   'stock_assessments',
  rebalance_log: 'stock_rebalance_log',
  tax_sim:       'stock_tax_simulations',
};
