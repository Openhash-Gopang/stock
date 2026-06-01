// K-Stock — 서비스 설정
// school 구조 동일, svc만 'stock'으로 교체

const KSTOCK_CONFIG = {
  svc: 'stock',
  name: 'K-Stock',
  label: 'AI 자산관리 전문가',
  version: '1.0.0',

  // Gopang Proxy
  proxy: 'https://gopang-proxy.tensor-city.workers.dev',
  deepseekEndpoint: 'https://gopang-proxy.tensor-city.workers.dev/deepseek',
  pdvEndpoint:      'https://gopang-proxy.tensor-city.workers.dev/pdv/report',

  // Supabase (gopang 프로젝트 공유)
  supabaseUrl: 'https://ebbecjfrwaswbdybbgiu.supabase.co',
  supabaseAnonKey: '', // auth.js에서 설정

  // AI 모델
  model: 'deepseek-chat',
  maxTokens: 800,
  temperature: 0.5, // 금융 특성상 school(0.7)보다 낮게

  // 서비스 메타
  returnUrl: 'https://gopang.net',
  siteUrl:   'https://stock.gopang.net',
  gwpChannel: 'gopang_gwp',

  // PDV 이벤트 타입
  pdvType: 'stock_session_complete',
};

// 전역 노출
window.KSTOCK_CONFIG = KSTOCK_CONFIG;
