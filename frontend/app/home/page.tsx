"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import KoreaMap from "../components/KoreaMap";

// 국가 타입 정의
type NationType = "goguryeo" | "baekje" | "silla" | null;

interface GameStats {
  finance: number;
  population: number;
  happiness: number;
  military: number;
}

interface NewsItem {
  id: number;
  title: string;
  content: string;
  type: "event" | "war" | "diplomacy" | "economy";
}

interface CommandLog {
  id: number;
  command: string;
  response: string;
  timestamp: Date;
}

// 슬롯머신 단일 자릿수 컴포넌트
function SlotDigit({ 
  digit, 
  delay = 0,
  animate = false 
}: { 
  digit: string; 
  delay?: number;
  animate?: boolean;
}) {
  const [targetDigit, setTargetDigit] = useState(digit);
  const [spinning, setSpinning] = useState(false);
  const prevDigit = useRef(digit);
  const isFirstMount = useRef(true);

  useEffect(() => {
    const shouldAnimate = animate || (prevDigit.current !== digit) || isFirstMount.current;
    
    if (shouldAnimate && /\d/.test(digit)) {
      // 애니메이션 시작 전에 targetDigit 설정
      if (prevDigit.current !== digit) {
        setTargetDigit(digit);
      }
      
      setSpinning(true);

      // 애니메이션 종료
      const endTimeout = setTimeout(() => {
        setSpinning(false);
        prevDigit.current = digit;
        isFirstMount.current = false;
      }, delay + 800);

      return () => {
        clearTimeout(endTimeout);
      };
    } else {
      setTargetDigit(digit);
      if (prevDigit.current !== digit) {
        prevDigit.current = digit;
      }
    }
  }, [digit, delay, animate]);

  // 숫자가 아닌 경우 (콤마 등)
  if (!/\d/.test(digit)) {
    return <span className="slot-separator">{digit}</span>;
  }

  const digitNum = parseInt(targetDigit, 10);
  // 슬롯 효과: 목표 숫자 위치로 이동 (2바퀴 돌고 + 목표 위치)
  // 30개 숫자 중 목표 위치 계산 (각 숫자 높이 = 전체의 1/30)
  const totalDigits = 30;
  const targetIndex = spinning ? 20 + digitNum : digitNum;
  const offset = (targetIndex / totalDigits) * 100;

  return (
    <span className="slot-digit-wrapper">
      <span 
        className={`slot-digit-reel ${spinning ? 'spinning' : ''}`}
        style={{ 
          transform: `translateY(-${offset}%)`,
          transitionDelay: spinning ? `${delay}ms` : '0ms',
        }}
      >
        {/* 3번 반복 (2바퀴 + 여유분) */}
        {[...Array(3)].map((_, cycle) => (
          <span key={cycle} className="slot-digit-cycle">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <span key={`${cycle}-${num}`} className="slot-digit-item">
                {num}
              </span>
            ))}
          </span>
        ))}
      </span>
    </span>
  );
}

// 슬롯머신 숫자 컴포넌트
function RollingNumber({
  value,
  prefix = "",
  suffix = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
}) {
  const [triggerAnimation, setTriggerAnimation] = useState(false);
  const prevValue = useRef(value);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      // 첫 렌더링 시 애니메이션
      isFirstRender.current = false;
      setTriggerAnimation(true);
      const timer = setTimeout(() => setTriggerAnimation(false), 1500);
      return () => clearTimeout(timer);
    }

    if (prevValue.current !== value) {
      // 값 변경 시 애니메이션
      setTriggerAnimation(true);
      prevValue.current = value;
      const timer = setTimeout(() => setTriggerAnimation(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [value]);

  const formattedValue = value.toLocaleString();
  const digits = formattedValue.split('');

  return (
    <span className="slot-number">
      {prefix && <span className="slot-prefix">{prefix}</span>}
      <span className="slot-digits">
        {digits.map((digit, index) => (
          <SlotDigit
            key={`${index}-${digits.length}`}
            digit={digit}
            delay={index * 80}
            animate={triggerAnimation}
          />
        ))}
      </span>
      {suffix && <span className="slot-suffix">{suffix}</span>}
    </span>
  );
}

// 상태 바 아이템 컴포넌트
function StatItem({
  icon,
  label,
  value,
  prefix = "",
  suffix = "",
}: {
  icon: string;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 glass-panel rounded-lg hover:border-[#C9A227]/50 transition-all duration-300">
      <span className="text-xl">{icon}</span>
      <div className="flex flex-col">
        <span className="text-[10px] text-[#A89F91] uppercase tracking-wider">
          {label}
        </span>
        <span className="font-bold text-[#F5F5DC] font-serif">
          <RollingNumber value={value} prefix={prefix} suffix={suffix} />
        </span>
      </div>
    </div>
  );
}

// 뉴스 카드 컴포넌트
function NewsCard({ news, index }: { news: NewsItem; index: number }) {
  const typeColors = {
    event: "border-[#FBBF24]",
    war: "border-[#F87171]",
    diplomacy: "border-[#4ADE80]",
    economy: "border-[#60A5FA]",
  };

  const typeIcons = {
    event: "📜",
    war: "⚔️",
    diplomacy: "🤝",
    economy: "💰",
  };

  return (
    <div
      className={`glass-panel rounded-xl p-4 card-hover ${typeColors[news.type]} animate-fade-in-up opacity-0`}
      style={{ animationDelay: `${index * 150}ms`, animationFillMode: "forwards" }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{typeIcons[news.type]}</span>
        <div className="flex-1">
          <h4 className="font-bold text-[#F5F5DC] font-serif mb-1">
            {news.title}
          </h4>
          <p className="text-sm text-[#A89F91] leading-relaxed">
            {news.content}
          </p>
        </div>
      </div>
    </div>
  );
}

// 외교 정보 컴포넌트
function DiplomacyInfo({ selectedNation }: { selectedNation: NationType }) {
  const relations = {
    goguryeo: [
      { nation: "백제", status: "적대", favorability: -60 },
      { nation: "신라", status: "중립", favorability: 10 },
    ],
    baekje: [
      { nation: "고구려", status: "적대", favorability: -60 },
      { nation: "신라", status: "경쟁", favorability: -30 },
    ],
    silla: [
      { nation: "고구려", status: "중립", favorability: 10 },
      { nation: "백제", status: "경쟁", favorability: -30 },
    ],
  };

  if (!selectedNation) return null;

  return (
    <div className="space-y-2">
      {relations[selectedNation].map((rel, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between p-2 glass-panel rounded-lg"
        >
          <span className="text-sm text-[#F5F5DC]">{rel.nation}</span>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-1 rounded ${
                rel.favorability > 0
                  ? "bg-green-900/50 text-green-400"
                  : rel.favorability < -30
                    ? "bg-red-900/50 text-red-400"
                    : "bg-yellow-900/50 text-yellow-400"
              }`}
            >
              {rel.status}
            </span>
            <span
              className={`text-xs font-mono ${
                rel.favorability > 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {rel.favorability > 0 ? "+" : ""}
              {rel.favorability}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// 군사 정보 컴포넌트
function MilitaryInfo({ selectedNation }: { selectedNation: NationType }) {
  const military = {
    goguryeo: [
      { name: "철기병", count: 5000, icon: "🐎" },
      { name: "궁병대", count: 8000, icon: "🏹" },
      { name: "보병", count: 15000, icon: "⚔️" },
    ],
    baekje: [
      { name: "수군", count: 6000, icon: "⛵" },
      { name: "창병대", count: 7000, icon: "🗡️" },
      { name: "보병", count: 12000, icon: "⚔️" },
    ],
    silla: [
      { name: "화랑도", count: 3000, icon: "🌸" },
      { name: "기마대", count: 4000, icon: "🐎" },
      { name: "보병", count: 18000, icon: "⚔️" },
    ],
  };

  if (!selectedNation) return null;

  return (
    <div className="space-y-2">
      {military[selectedNation].map((unit, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between p-2 glass-panel rounded-lg"
        >
          <div className="flex items-center gap-2">
            <span>{unit.icon}</span>
            <span className="text-sm text-[#F5F5DC]">{unit.name}</span>
          </div>
          <span className="text-sm font-mono text-[#C9A227]">
            {unit.count.toLocaleString()}명
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const searchParams = useSearchParams();
  const nationFromUrl = searchParams.get("nation") as NationType;
  
  const [selectedNation, setSelectedNation] = useState<NationType>(nationFromUrl);
  const [turn, setTurn] = useState(1);
  const [stats, setStats] = useState<GameStats>({
    finance: 10000,
    population: 500000,
    happiness: 70,
    military: 25000,
  });
  const [commandInput, setCommandInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [commandLogs, setCommandLogs] = useState<CommandLog[]>([]);
  const [financeIncrease, setFinanceIncrease] = useState(0);
  const prevFinanceRef = useRef(stats.finance);
  const [news, setNews] = useState<NewsItem[]>([
    {
      id: 1,
      title: "북방 유목민족의 동향",
      content:
        "북쪽 변경에서 유목민족의 움직임이 포착되었습니다. 경계를 강화해야 할 것으로 보입니다.",
      type: "war",
    },
    {
      id: 2,
      title: "풍년의 조짐",
      content:
        "올해 농사가 순조롭습니다. 곡식 수확량이 예년보다 20% 증가할 것으로 예상됩니다.",
      type: "economy",
    },
    {
      id: 3,
      title: "인접국의 사신 도착",
      content:
        "이웃 나라에서 사신이 도착했습니다. 동맹 제안 또는 협상의 기회가 될 수 있습니다.",
      type: "diplomacy",
    },
  ]);
  const [activeTab, setActiveTab] = useState<"diplomacy" | "military">("diplomacy");

  const nationInfo = {
    goguryeo: {
      name: "고구려",
      description:
        "강력한 군사력과 광활한 영토를 자랑하는 북방의 패자. 철기병과 산성 전술로 유명하다.",
      flag: "🏔️",
    },
    baekje: {
      name: "백제",
      description:
        "해상 무역과 문화 예술이 발달한 서남부의 강국. 일본, 중국과의 교류가 활발하다.",
      flag: "🌊",
    },
    silla: {
      name: "신라",
      description:
        "화랑도의 정신과 단결력으로 무장한 동남부의 신흥 강국. 금관가야를 흡수하며 성장 중이다.",
      flag: "👑",
    },
  };

  const handleCommand = useCallback(async () => {
    if (!commandInput.trim() || isLoading) return;

    setIsLoading(true);
    const command = commandInput;
    setCommandInput("");

    // 시뮬레이션된 AI 응답 (실제로는 서버 호출)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const responses = [
      "명령을 수행했습니다. 군사력이 증가했습니다.",
      "외교 사절을 파견했습니다. 다음 턴에 결과가 나올 것입니다.",
      "내정을 정비하여 백성들의 행복도가 상승했습니다.",
      "세금을 조정하여 재정이 변동되었습니다.",
    ];

    const newLog: CommandLog = {
      id: Date.now(),
      command,
      response: responses[Math.floor(Math.random() * responses.length)],
      timestamp: new Date(),
    };

    setCommandLogs((prev) => [...prev, newLog]);

    // 랜덤하게 스탯 변경
    setStats((prev) => {
      const newFinance = prev.finance + Math.floor(Math.random() * 2000) - 1000;
      const financeDiff = newFinance - prev.finance;
      
      // 재정이 증가했을 때만 애니메이션 트리거
      if (financeDiff > 0) {
        setFinanceIncrease(financeDiff);
        // 3초 후 리셋
        setTimeout(() => setFinanceIncrease(0), 3000);
      }
      
      return {
        finance: newFinance,
        population: prev.population + Math.floor(Math.random() * 10000) - 5000,
        happiness: Math.min(100, Math.max(0, prev.happiness + Math.floor(Math.random() * 20) - 10)),
        military: prev.military + Math.floor(Math.random() * 2000) - 1000,
      };
    });

    setTurn((prev) => prev + 1);
    setIsLoading(false);
  }, [commandInput, isLoading]);

  // 재정 변화 감지
  useEffect(() => {
    if (prevFinanceRef.current < stats.finance) {
      const diff = stats.finance - prevFinanceRef.current;
      if (diff > 0) {
        setFinanceIncrease(diff);
        setTimeout(() => setFinanceIncrease(0), 3000);
      }
    }
    prevFinanceRef.current = stats.finance;
  }, [stats.finance]);

  const totalScore =
    Math.floor(stats.finance / 100) +
    Math.floor(stats.population / 1000) +
    stats.happiness * 10 +
    Math.floor(stats.military / 10);

  // 초기 로딩 방지
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // URL에서 국가가 전달되면 자동으로 설정
  useEffect(() => {
    if (nationFromUrl) {
      setSelectedNation(nationFromUrl);
    }
  }, [nationFromUrl]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4" style={{ width: "40px", height: "40px" }}></div>
          <p className="text-[#C9A227]">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 국가가 선택되지 않았으면 선택 페이지로 안내
  if (!selectedNation) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#C9A227] text-xl mb-4">국가를 먼저 선택해주세요</p>
          <a href="/selection" className="px-8 py-3 bg-[#C9A227] text-[#0d0d0d] rounded-xl font-bold hover:bg-[#D4AF37] transition-all">
            국가 선택하러 가기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{
        backgroundImage: 'url(/background2.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-[#0d0d0d]/60"></div>
      <div className="relative z-10 flex flex-col min-h-screen">
      {/* ① 상단 헤더 (Status Bar) */}
      <header className="w-full glass-panel border-b border-[#C9A227]/30 px-6 py-3">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          {/* 국가 정보 */}
          <div className="flex items-center gap-4">
            <span className="text-4xl">
              {nationInfo[selectedNation].flag}
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#C9A227] font-serif">
                {nationInfo[selectedNation].name}
              </h1>
              <p className="text-xs text-[#A89F91]">
                제 {turn}대 군주
              </p>
            </div>
          </div>

          {/* 수치 데이터 */}
          <div className="flex items-center gap-3 animate-fade-in">
            <StatItem icon="💰" label="재정" value={stats.finance} prefix="$" />
            <StatItem icon="👥" label="인구" value={stats.population} />
            <StatItem icon="😊" label="행복도" value={stats.happiness} suffix="%" />
            <StatItem icon="⚔️" label="군사력" value={stats.military} />
            <div className="h-10 w-px bg-[#C9A227]/30 mx-2" />
            <StatItem icon="🏆" label="총합 점수" value={totalScore} />
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 영역 */}
      <div className="flex-1 flex overflow-hidden">
        {/* ③ 중앙 메인 화면 (Story & News) */}
        <main className="flex-1 p-6 overflow-y-auto">
            {/* 진행 중: 현재 상황, 뉴스, 명령 로그 */}
            <div className="max-w-4xl mx-auto space-y-6">
              {/* 현재 상황 요약 */}
              <section className="glass-panel rounded-xl p-6 animate-fade-in">
                <h3 className="text-xl font-bold text-[#C9A227] font-serif mb-4 flex items-center gap-2">
                  <span>📖</span> 현재 상황
                </h3>
                <p className="text-[#F5F5DC] leading-relaxed">
                  {selectedNation === "goguryeo" &&
                    "북방의 맹주 고구려의 왕좌에 오르신 것을 축하드립니다. 광개토대왕의 위업을 이어받아 만주와 한반도를 호령할 때입니다. 남쪽의 백제와 신라가 호시탐탐 영토를 노리고 있으니, 경계를 게을리하지 마소서."}
                  {selectedNation === "baekje" &&
                    "해상 강국 백제의 왕으로 즉위하셨습니다. 선왕들이 쌓아온 문화와 무역의 기반 위에서, 이제 천하 통일의 대업을 시작할 때입니다. 북쪽의 고구려와 동쪽의 신라를 경계하며 국력을 키우소서."}
                  {selectedNation === "silla" &&
                    "동방의 금관 신라의 군주가 되셨습니다. 화랑도의 충성과 백성들의 단결력이 당신의 가장 큰 자산입니다. 강대국들 사이에서 현명한 외교와 과감한 결단으로 천하를 도모하소서."}
                </p>
              </section>

              {/* 오늘의 뉴스 */}
              <section>
                <h3 className="text-xl font-bold text-[#C9A227] font-serif mb-4 flex items-center gap-2">
                  <span>📰</span> 금일의 소식
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {news.map((item, index) => (
                    <NewsCard key={item.id} news={item} index={index} />
                  ))}
                </div>
              </section>

              {/* 명령 기록 */}
              <section className="glass-panel rounded-xl p-6">
                <h3 className="text-xl font-bold text-[#C9A227] font-serif mb-4 flex items-center gap-2">
                  <span>📜</span> 명령 기록
                </h3>
                <div className="max-h-[300px] overflow-y-auto space-y-3">
                  {commandLogs.length === 0 ? (
                    <p className="text-[#6B6B6B] text-center py-8">
                      아직 내린 명령이 없습니다. 하단의 입력창에서 명령을 입력하세요.
                    </p>
                  ) : (
                    commandLogs.map((log) => (
                      <div
                        key={log.id}
                        className="border-l-2 border-[#C9A227]/50 pl-4 py-2 animate-slide-in-right"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[#C9A227]">▶</span>
                          <span className="text-[#F5F5DC] font-medium">
                            {log.command}
                          </span>
                          <span className="text-[#6B6B6B] text-xs ml-auto">
                            {log.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-[#A89F91] text-sm ml-5">
                          {log.response}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
      </main>

        {/* ② 우측 패널 (Navigation & Info) */}
        <aside className="w-[450px] glass-panel border-l border-[#C9A227]/20 flex flex-col">
          {/* 상단: 턴 수 표시 */}
          <div className="p-4 border-b border-[#C9A227]/20 glass-panel">
            <div className="text-center">
              <p className="text-xs text-[#A89F91] uppercase tracking-wider mb-1">
                현재 턴
              </p>
              <p className="text-3xl font-bold text-[#C9A227] font-serif">
                <RollingNumber value={turn} />
              </p>
            </div>
          </div>

          {/* 중앙: 지도 */}
          <div className="flex-1 p-4 border-b border-[#C9A227]/20">
            <div className="h-[350px] glass-panel rounded-xl p-2 relative">
              <KoreaMap financeIncrease={financeIncrease} selectedNation={selectedNation} />
            </div>
          </div>

          {/* 하단: 외교/군사 탭 */}
          <div className="p-4">
            {/* 탭 버튼 */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab("diplomacy")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "diplomacy"
                    ? "bg-[#C9A227] text-[#0d0d0d]"
                    : "bg-black/20 backdrop-blur-md text-[#A89F91] hover:bg-black/30 border border-white/5"
                }`}
              >
                🤝 외교
              </button>
              <button
                onClick={() => setActiveTab("military")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "military"
                    ? "bg-[#C9A227] text-[#0d0d0d]"
                    : "bg-black/20 backdrop-blur-md text-[#A89F91] hover:bg-black/30 border border-white/5"
                }`}
              >
                ⚔️ 군사
              </button>
            </div>

            {/* 탭 컨텐츠 */}
            <div className="min-h-[150px]">
              {activeTab === "diplomacy" ? (
                <DiplomacyInfo selectedNation={selectedNation} />
              ) : (
                <MilitaryInfo selectedNation={selectedNation} />
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ④ 하단 입력창 (Control) */}
        <footer className="w-full glass-panel border-t border-[#C9A227]/30 px-6 py-4 animate-fade-in">
          <div className="max-w-4xl mx-auto flex gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCommand()}
                placeholder="명령을 입력하세요... (예: 북방 경비를 강화하라, 백제와 동맹을 맺어라)"
                className="input-field w-full px-5 py-4 rounded-xl text-base pr-12"
                disabled={isLoading}
              />
              {isLoading && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="loading-spinner" />
                </div>
              )}
            </div>
            <button
              onClick={handleCommand}
              disabled={isLoading || !commandInput.trim()}
              className={`
                px-8 py-4 rounded-xl font-bold font-serif
                transition-all duration-300
                ${
                  isLoading || !commandInput.trim()
                    ? "bg-[#333] text-[#666] cursor-not-allowed"
                    : "btn-primary"
                }
              `}
            >
              {isLoading ? "처리 중..." : "명령 전달"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
