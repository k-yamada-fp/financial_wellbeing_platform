/* =============================================================
   2026-v22 採用数値（簡易版デモ専用コピー）
   -------------------------------------------------------------
   出典: 2026-v22_数字一覧_20261028.md ／ 採用数値抜粋_2026-v22
   本ファイルは「本格版 reference-data/2026-v22.js」の数値のうち、
   簡易版で使用する分だけを独立コピーしたデモ専用データです。
   本格版の正本ファイルは参照・変更していません。
   ※これは数値の台帳からの抜粋であり、法令適合の監査済みデータではありません。
   ============================================================= */
(function (global) {
  'use strict';

  var DATA = {
    meta: {
      id: '2026-v22',
      baseYear: 2026,
      label: '2026-v22（2026 制度・モデル統合版）',
      source: '2026-v22_数字一覧_20261028.md',
      note: '提案用デモの費用モデル・初期値として採用。法令上の権利額ではありません。'
    },

    /* --- 幼稚園〜高校（円） -------------------------------- */
    education: {
      preUniversity: {
        kindergarten_public:  { label: '幼稚園（公立）', years: 3, admission: 50000,   tuition: 0,       nonTuition: 165000, exam: 0 },
        kindergarten_private: { label: '幼稚園（私立）', years: 3, admission: 80000,   tuition: 200000,  nonTuition: 108000, exam: 0 },
        elementary_public:    { label: '小学校（公立）', years: 6, admission: 120000,  tuition: 0,       nonTuition: 110000, exam: 300000 },
        elementary_private:   { label: '小学校（私立）', years: 6, admission: 300000,  tuition: 900000,  nonTuition: 300000, exam: 0 },
        junior_high_public:   { label: '中学校（公立）', years: 3, admission: 200000,  tuition: 0,       nonTuition: 140000, exam: 400000 },
        junior_high_private:  { label: '中学校（私立）', years: 3, admission: 300000,  tuition: 600000,  nonTuition: 300000, exam: 0 },
        high_public:          { label: '高校（公立）',   years: 3, admission: 300000,  tuition: 118800,  nonTuition: 390000, exam: 600000 },
        high_private:         { label: '高校（私立）',   years: 3, admission: 300000,  tuition: 457000,  nonTuition: 600000, exam: 600000 }
      },

      /* --- 大学（円） ------------------------------------- */
      university: {
        national:           { label: '国立大学',       years: 4, admission: 282000,  tuition: 535800, nonTuition: 100000 },
        private_humanities: { label: '私立大学（文系）', years: 4, admission: 250000,  tuition: 700000, nonTuition: 300000 },
        private_science:    { label: '私立大学（理系）', years: 4, admission: 250000,  tuition: 900000, nonTuition: 400000 },
        medicine:           { label: '私立医学部',     years: 6, admission: 1000000, tuition: 4000000, nonTuition: 500000 },
        dentistry:          { label: '私立歯学部',     years: 6, admission: 800000,  tuition: 3500000, nonTuition: 400000 },
        pharmacy:           { label: '私立薬学部',     years: 6, admission: 400000,  tuition: 1800000, nonTuition: 300000 }
      },

      /* --- 塾・習い事（円／月） --------------------------- */
      activity: {
        kindergarten: { none: 0, standard: 8000,  high: 15000 },
        elementary:   { none: 0, standard: 20000, high: 40000 },
        junior_high:  { none: 0, standard: 30000, high: 50000 },
        high:         { none: 0, standard: 40000, high: 70000 }
      },

      /* --- 大学生活費（円） ------------------------------- */
      studentLiving: {
        home: { monthly: 30000 },
        away: { monthly: 100000, initial: 300000 }
      }
    },

    /* --- 公的年金（2026年度） ----------------------------- */
    pension: {
      basicFullMonths: 480,
      basicAnnual: 847300,        // 1956-04-02以降生まれ
      basicAnnualOld: 844900,     // 1956-04-01以前生まれ
      earningsCoefficient: 0.005481, // 2003-04以降加入分
      standardClaimAge: 65,
      standardMonthlyCap: 650000  // デモ用の仮定（標準報酬月額の上限を仮置き）
    },

    /* --- 初期値・運用参考値 -------------------------------- */
    defaults: {
      endAge: 90,
      retirementAge: 65,
      livingMonthly: 25,        // 万円/月（v22 新規プラン初期値）
      postRetireLiving: 20,     // 万円/月（v22 退職後の生活費）
      rates: { cash: 0.1, living: 0, education: 0, pessimistic: 2, expected: 5, optimistic: 7 }
    },

    /* --- 制度値（表示・上限チェックのみ／自動計算には未使用） --- */
    limits: {
      nisaAnnual: 3600000,
      nisaLifetime: 18000000,
      dcMonthlyFrom202612: 62000
    }
  };

  global.HCS_DATA = DATA;
})(window);
