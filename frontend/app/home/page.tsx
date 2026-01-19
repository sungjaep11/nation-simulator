"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import KoreaMap from "../components/KoreaMap";
import Character3D from "../components/Character3D";

// 국가 타입 정의
type NationType = "goguryeo" | "baekje" | "silla" | null;
type NationId = Exclude<NationType, null>;
const NATION_IDS = ["goguryeo", "baekje", "silla"] as const;
const isNationId = (value: unknown): value is NationId =>
  NATION_IDS.includes(value as NationId);

interface GameStats {
  finance: number;
  population: number;
  happiness: number;
  military: number;
}

interface NationStats {
  goguryeo: GameStats;
  baekje: GameStats;
  silla: GameStats;
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
  isLoading?: boolean;
  loadingMessageIndex?: number;
}

interface DiplomacyRelation {
  id: number;
  targetName: string;
  status: string;
  favorability: number;
}

interface MilitaryUnit {
  id: number;
  name: string;
  count: number;
  icon: string;
  unit_type?: string;
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

  useEffect(() => {
    const shouldAnimate = animate || (prevDigit.current !== digit);
    
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
  prevValue,
  showArrow = false,
  prefix = "",
  suffix = "",
  allNationStats,
  allNationScores,
  statType,
  selectedNation,
  turn,
}: {
  icon: string;
  label: string;
  value: number;
  prevValue?: number;
  showArrow?: boolean;
  prefix?: string;
  suffix?: string;
  allNationStats?: NationStats;
  allNationScores?: {
    goguryeo?: number;
    baekje?: number;
    silla?: number;
  };
  statType?: "finance" | "population" | "happiness" | "military" | "totalScore" | "turn";
  selectedNation?: NationType;
  turn?: number;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  // 이전 값과 비교하여 화살표 표시 여부 결정
  const shouldShowArrow = showArrow && prevValue !== undefined && prevValue !== value && statType !== "turn";
  const isIncreased = shouldShowArrow && value > prevValue;
  const isDecreased = shouldShowArrow && value < prevValue;

  const getRankingData = () => {
    if (!allNationStats || !statType || statType === "turn") return null;

    const scores = allNationScores || {};

    const nationData = [
      { nation: "고구려", value: statType === "totalScore" 
        ? (scores.goguryeo ?? 0)
        : allNationStats.goguryeo[statType],
        type: "goguryeo" as const },
      { nation: "백제", value: statType === "totalScore"
        ? (scores.baekje ?? 0)
        : allNationStats.baekje[statType],
        type: "baekje" as const },
      { nation: "신라", value: statType === "totalScore"
        ? (scores.silla ?? 0)
        : allNationStats.silla[statType],
        type: "silla" as const },
    ];

    return nationData.sort((a, b) => b.value - a.value);
  };

  const ranking = getRankingData();

  return (
    <div 
      className="relative flex items-center gap-2 px-4 py-2 glass-panel rounded-lg hover:border-[#C9A227]/50 transition-all duration-300 hover:z-[999999]"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{ zIndex: showTooltip ? 999999 : 'auto' }}
    >
      <span className="text-xl">{icon}</span>
      <div className="flex flex-col">
        <span className="text-[10px] text-[#A89F91] uppercase tracking-wider">
          {label}
        </span>
        <div className="flex items-center gap-1">
          <span className="font-bold text-[#F5F5DC] font-serif">
            <RollingNumber value={value} prefix={prefix} suffix={suffix} />
          </span>
          {shouldShowArrow && (
            <span 
              className={`text-xs font-bold transition-all duration-300 ${
                isIncreased ? "text-green-500" : isDecreased ? "text-red-500" : ""
              }`}
              style={{
                animation: "fadeIn 0.3s ease-in"
              }}
            >
              {isIncreased ? "▲" : isDecreased ? "▼" : ""}
            </span>
          )}
        </div>
      </div>
      
      {showTooltip && ranking && (
        <div className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-[#C9A227] rounded-lg px-3 py-2 min-w-[200px] shadow-lg" style={{ zIndex: 999999 }}>
          <p className="text-xs text-[#A89F91] mb-2 font-bold">{label} 랭킹</p>
          <div className="space-y-1.5">
            {ranking.map((item, index) => {
              const isSelected = item.type === selectedNation;
              return (
                <div 
                  key={item.type}
                  className={`flex items-center justify-between text-xs ${
                    isSelected ? "text-[#C9A227]" : "text-[#F5F5DC]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[#A89F91] font-bold w-4">
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                    </span>
                    <span className={isSelected ? "font-bold" : ""}>{item.nation}</span>
                  </div>
                  <span className="font-mono">
                    {prefix}
                    {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
                    {suffix}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
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

// 국가 ID를 한글 이름으로 변환
function getNationNameInKorean(nationIdOrName: string): string {
  const nationMap: Record<string, string> = {
    "goguryeo": "고구려",
    "baekje": "백제",
    "silla": "신라",
    "고구려": "고구려",
    "백제": "백제",
    "신라": "신라",
  };
  return nationMap[nationIdOrName.toLowerCase()] || nationIdOrName;
}

// 외교 정보 컴포넌트
function DiplomacyInfo({ 
  diplomacyData, 
  prevDiplomacyData,
  selectedNation 
}: { 
  diplomacyData: DiplomacyRelation[];
  prevDiplomacyData?: DiplomacyRelation[];
  selectedNation: NationType;
}) {
  // 모든 국가 목록 (선택된 국가 제외)
  const allNations: NationId[] = ["goguryeo", "baekje", "silla"];
  const otherNations = allNations.filter(n => n !== selectedNation);
  
  // 외교 관계 데이터를 맵으로 변환 (빠른 조회를 위해)
  const diplomacyMap = new Map<string, DiplomacyRelation>();
  (diplomacyData || []).forEach(rel => {
    // targetName이 국가 ID인지 한글 이름인지 확인하고 정규화
    const normalizedName = rel.targetName.toLowerCase();
    const nationId = normalizedName === "고구려" || normalizedName === "goguryeo" ? "goguryeo" :
                     normalizedName === "백제" || normalizedName === "baekje" ? "baekje" :
                     normalizedName === "신라" || normalizedName === "silla" ? "silla" : rel.targetName;
    diplomacyMap.set(nationId, rel);
  });

  const getPrevFavorability = (targetName: string): number | undefined => {
    if (!prevDiplomacyData) return undefined;
    const prev = prevDiplomacyData.find(d => {
      const normalized = d.targetName.toLowerCase();
      return normalized === targetName.toLowerCase() || 
             (normalized === "고구려" && targetName === "goguryeo") ||
             (normalized === "백제" && targetName === "baekje") ||
             (normalized === "신라" && targetName === "silla") ||
             (normalized === "goguryeo" && targetName === "goguryeo") ||
             (normalized === "baekje" && targetName === "baekje") ||
             (normalized === "silla" && targetName === "silla");
    });
    return prev?.favorability;
  };

  return (
    <div className="space-y-2">
      {otherNations.map((nationId) => {
        const rel = diplomacyMap.get(nationId);
        // 관계가 없으면 기본 중립 관계 생성
        const relation: DiplomacyRelation = rel || {
          id: 0,
          targetName: nationId,
          status: "중립",
          favorability: 0
        };
        
        const prevFavorability = getPrevFavorability(nationId);
        const favorabilityChanged = prevFavorability !== undefined && prevFavorability !== relation.favorability;
        const isIncreased = favorabilityChanged && relation.favorability > prevFavorability;
        const isDecreased = favorabilityChanged && relation.favorability < prevFavorability;
        
        // 국가 이름을 한글로 변환
        const displayName = getNationNameInKorean(nationId);

        return (
          <div
            key={nationId}
            className="flex items-center justify-between p-2 glass-panel rounded-lg"
          >
            <span className="text-sm text-[#F5F5DC] flex-shrink-0">{displayName}</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1 min-w-[45px] justify-end">
                <span
                  className={`text-xs font-mono ${
                    relation.favorability > 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {relation.favorability > 0 ? "+" : ""}
                  {relation.favorability}
                </span>
                {favorabilityChanged && (
                  <span 
                    className={`text-xs font-bold transition-all duration-300 ${
                      isIncreased ? "text-green-500" : isDecreased ? "text-red-500" : ""
                    }`}
                  >
                    {isIncreased ? "▲" : isDecreased ? "▼" : ""}
                  </span>
                )}
              </div>
              <span
                className={`text-xs px-2 py-1 rounded whitespace-nowrap min-w-[50px] text-center ${
                  relation.favorability > 0
                    ? "bg-green-900/50 text-green-400"
                    : relation.favorability < -30
                      ? "bg-red-900/50 text-red-400"
                      : "bg-yellow-900/50 text-yellow-400"
                }`}
              >
                {relation.status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 군사 유닛 이름 정리 함수 (불필요한 prefix 제거)
function cleanMilitaryUnitName(name: string): string {
  // "sword 백제 정예병" -> "정예병"
  // "백제 정예병" -> "정예병"
  // "sword" -> "sword" (국가명이 없으면 그대로)
  
  // 국가명 제거
  const nationNames = ["고구려", "백제", "신라", "goguryeo", "baekje", "silla"];
  let cleaned = name;
  
  // 국가명 제거
  for (const nation of nationNames) {
    cleaned = cleaned.replace(new RegExp(nation, "gi"), "").trim();
  }
  
  // 무기 타입 prefix 제거 (sword, bow, spear 등)
  const weaponPrefixes = ["sword", "bow", "spear", "shield", "arrow", "lance"];
  for (const prefix of weaponPrefixes) {
    if (cleaned.toLowerCase().startsWith(prefix + " ")) {
      cleaned = cleaned.substring(prefix.length + 1).trim();
    }
  }
  
  // 빈 문자열이면 원본 반환
  return cleaned || name;
}

// 유닛 이름에 따른 기본 이모티콘 매핑
function getUnitIcon(icon: string, unitName: string): string {
  // icon이 이미 이모티콘이면 그대로 사용
  if (icon && /[\u{1F300}-\u{1F9FF}]/u.test(icon)) {
    return icon;
  }
  
  // icon이 텍스트이거나 없으면 유닛 이름에 따라 매핑
  const cleanedName = cleanMilitaryUnitName(unitName).toLowerCase();
  
  // 유닛 타입별 이모티콘 매핑
  if (cleanedName.includes("정예") || cleanedName.includes("elite") || cleanedName.includes("sword")) {
    return "⚔️";
  } else if (cleanedName.includes("궁") || cleanedName.includes("bow") || cleanedName.includes("archer")) {
    return "🏹";
  } else if (cleanedName.includes("기마") || cleanedName.includes("horse") || cleanedName.includes("cavalry")) {
    return "🐎";
  } else if (cleanedName.includes("수군") || cleanedName.includes("navy") || cleanedName.includes("ship")) {
    return "⛵";
  } else if (cleanedName.includes("화랑") || cleanedName.includes("hwarang")) {
    return "🌸";
  } else if (cleanedName.includes("창") || cleanedName.includes("spear") || cleanedName.includes("lance")) {
    return "🗡️";
  } else if (cleanedName.includes("보병") || cleanedName.includes("infantry") || cleanedName.includes("soldier")) {
    return "⚔️";
  }
  
  // 기본값
  return "⚔️";
}

// 군사 정보 컴포넌트
function MilitaryInfo({ 
  militaryData, 
  prevMilitaryData,
  turnChanged 
}: { 
  militaryData: MilitaryUnit[];
  prevMilitaryData?: MilitaryUnit[];
  turnChanged?: boolean;
}) {
  if (!militaryData || militaryData.length === 0) {
    return (
      <p className="text-[#6B6B6B] text-center py-4 text-sm">
        군사 유닛이 없습니다.
      </p>
    );
  }

  const getPrevCount = (name: string): number | undefined => {
    if (!prevMilitaryData) return undefined;
    // 이름이 정리되기 전의 원본 이름으로 찾기
    const prev = prevMilitaryData.find(u => u.name === name);
    return prev?.count;
  };

  return (
    <div className="space-y-2">
      {militaryData.map((unit) => {
        const prevCount = getPrevCount(unit.name);
        const countChanged = turnChanged && prevCount !== undefined && prevCount !== unit.count;
        const isIncreased = countChanged && unit.count > prevCount;
        const isDecreased = countChanged && unit.count < prevCount;
        
        // 유닛 이름 정리
        const displayName = cleanMilitaryUnitName(unit.name);
        // 이모티콘 가져오기 (텍스트인 경우 기본 이모티콘 사용)
        const displayIcon = getUnitIcon(unit.icon || "", unit.name);

        return (
          <div
            key={unit.id}
            className="flex items-center justify-between p-2 glass-panel rounded-lg"
          >
            <div className="flex items-center gap-2">
              <span>{displayIcon}</span>
              <span className="text-sm text-[#F5F5DC]">{displayName}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-mono text-[#C9A227]">
                {unit.count.toLocaleString()}명
              </span>
              {countChanged && (
                <span 
                  className={`text-xs font-bold transition-all duration-300 ${
                    isIncreased ? "text-green-500" : isDecreased ? "text-red-500" : ""
                  }`}
                >
                  {isIncreased ? "▲" : isDecreased ? "▼" : ""}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router; // Keep ref updated
  const nationFromUrl = (searchParams.get("country") || searchParams.get("nation")) as NationType;
  
  const [selectedNation, setSelectedNation] = useState<NationType>(nationFromUrl);
  const [turn, setTurn] = useState(1);
  const [username, setUsername] = useState<string>("");
  const [stats, setStats] = useState<GameStats>({
    finance: 15000,
    population: 60000,
    happiness: 50,
    military: 12,
  });

  // 각 나라별 기본 stats (현재는 선택된 나라만 업데이트되고, 나머지는 기본값 사용)
  const allNationStats: NationStats = {
    goguryeo: selectedNation === "goguryeo" ? stats : {
      finance: 15000,
      population: 80000,
      happiness: 50,
      military: 15,
    },
    baekje: selectedNation === "baekje" ? stats : {
      finance: 18000,
      population: 60000,
      happiness: 50,
      military: 10,
    },
    silla: selectedNation === "silla" ? stats : {
      finance: 12000,
      population: 45000,
      happiness: 50,
      military: 12,
    },
  };
  const [commandInput, setCommandInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [commandLogs, setCommandLogs] = useState<CommandLog[]>([]);
  const [financeIncrease, setFinanceIncrease] = useState(0);
  
  // 재치있는 로딩 메시지들
  const loadingMessages = [
    "군주의 지혜를 모으는 중...",
    "신하들이 명령을 해석하는 중...",
    "천하의 기운이 움직이는 중...",
  ];
  
  // 로딩 중인 카드들의 메시지를 3초마다 순환
  useEffect(() => {
    const loadingLogs = commandLogs.filter(log => log.isLoading);
    if (loadingLogs.length === 0) return;
    
    const interval = setInterval(() => {
      setCommandLogs((prev) =>
        prev.map((log) => {
          if (log.isLoading && log.loadingMessageIndex !== undefined) {
            return {
              ...log,
              loadingMessageIndex: ((log.loadingMessageIndex ?? 0) + 1) % loadingMessages.length,
            };
          }
          return log;
        })
      );
    }, 3000);
    
    return () => clearInterval(interval);
  }, [commandLogs, loadingMessages.length]);
  const prevFinanceRef = useRef(stats.finance);
  const prevStatsRef = useRef<GameStats>({ ...stats });
  const prevTurnRef = useRef(turn);
  const [turnChanged, setTurnChanged] = useState(false);
  const bgmRef = useRef<HTMLAudioElement>(null);
  const sendSoundRef = useRef<HTMLAudioElement>(null);
  const [allNationScores, setAllNationScores] = useState<{
    goguryeo?: number;
    baekje?: number;
    silla?: number;
  }>({});
  const [currentTotalScore, setCurrentTotalScore] = useState<number>(0);
  const [currentMood, setCurrentMood] = useState<"happy" | "neutral" | "angry" | "depressed">("neutral");
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
  const [diplomacyData, setDiplomacyData] = useState<DiplomacyRelation[]>([]);
  const [militaryData, setMilitaryData] = useState<MilitaryUnit[]>([]);
  const prevDiplomacyDataRef = useRef<DiplomacyRelation[]>([]);
  const prevMilitaryDataRef = useRef<MilitaryUnit[]>([]);

  const nationInfo = {
    goguryeo: {
      name: "고구려",
      description:
        "강력한 군사력과 광활한 영토를 자랑하는 북방의 패자. 철기병과 산성 전술로 유명하다.",
      flag: "🏔️",
      color: "#DC143C",
    },
    baekje: {
      name: "백제",
      description:
        "해상 무역과 문화 예술이 발달한 서남부의 강국. 일본, 중국과의 교류가 활발하다.",
      flag: "🌊",
      color: "#1E90FF",
    },
    silla: {
      name: "신라",
      description:
        "화랑도의 정신과 단결력으로 무장한 동남부의 신흥 강국. 금관가야를 흡수하며 성장 중이다.",
      flag: "👑",
      color: "#FFD700",
    },
  };

  const handleCommand = useCallback(async () => {
    if (!commandInput.trim() || isLoading || !selectedNation) return;

    // 명령 전송 사운드 재생
    if (sendSoundRef.current) {
      sendSoundRef.current.currentTime = 0;
      sendSoundRef.current.play().catch((error) => {
        console.log("사운드 재생 실패:", error);
      });
    }

    setIsLoading(true);
    const command = commandInput;
    setCommandInput("");

    // 로딩 카드 즉시 추가
    const loadingLogId = Date.now();
    const loadingLog: CommandLog = {
      id: loadingLogId,
      command,
      response: "",
      timestamp: new Date(),
      isLoading: true,
      loadingMessageIndex: 0,
    };
    setCommandLogs((prev) => [...prev, loadingLog]);

    try {
      // Backend API 호출
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_input: command,
          country_id: selectedNation
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // 로딩 카드를 실제 응답으로 교체
      const newLog: CommandLog = {
        id: loadingLogId,
        command,
        response: data.scenario,
        timestamp: new Date(),
        isLoading: false,
      };

      setCommandLogs((prev) => 
        prev.map((log) => log.id === loadingLogId ? newLog : log)
      );

      // 뉴스 업데이트
      if (data.public_news && Array.isArray(data.public_news)) {
        setNews(data.public_news.map((n: string, i: number): NewsItem => ({
          id: Date.now() + i,
          title: "조정 통보",
          content: n,
          type: "event",
        })));
      }

      // 턴 업데이트 확인 (스탯 업데이트 전에)
      let newTurn = turn;
      if (data.updated_stats && data.updated_stats.turn) {
        newTurn = data.updated_stats.turn;
      } else {
        newTurn = turn + 1;
      }
      
      // 턴이 변경되면 이전 stats 및 외교/군사 데이터 저장
      const isTurnChanged = newTurn !== prevTurnRef.current;
      if (isTurnChanged) {
        prevStatsRef.current = { ...stats };
        prevTurnRef.current = newTurn;
        // 이전 외교/군사 데이터 저장
        prevDiplomacyDataRef.current = [...diplomacyData];
        prevMilitaryDataRef.current = [...militaryData];
        // 이전 총합 점수 저장
        prevTotalScoreRef.current = totalScore;
      }

      // 스탯 업데이트
      setStats((prev) => {
        const newStats = data.updated_stats;
        const financeDiff = newStats.finance - prev.finance;
        
        // 재정이 증가했을 때만 애니메이션 트리거
        if (financeDiff > 0) {
          setFinanceIncrease(financeDiff);
          setTimeout(() => setFinanceIncrease(0), 3000);
        }
        
        // 백엔드에서 받은 totalScore 저장
        if (newStats.totalScore !== undefined) {
          setCurrentTotalScore(newStats.totalScore);
        }
        
        // 백엔드에서 받은 mood 저장
        if (data.mood) {
          setCurrentMood(data.mood as "happy" | "neutral" | "angry" | "depressed");
        }
        
        return {
          finance: newStats.finance,
          population: newStats.population,
          happiness: newStats.happiness,
          military: newStats.military,
        };
      });

      // 턴 업데이트
      if (data.updated_stats && data.updated_stats.turn) {
        setTurn(data.updated_stats.turn);
      } else {
        setTurn((prev) => prev + 1);
      }
      
      // 모든 국가의 점수 업데이트
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const countriesResponse = await fetch(`${apiUrl}/api/countries`);
        if (countriesResponse.ok) {
          const countriesData = (await countriesResponse.json()) as Array<{
            id?: unknown;
            totalScore?: number;
          }>;
          const scores: Partial<Record<NationId, number>> = {};
          countriesData.forEach((country) => {
            if (isNationId(country.id)) {
              scores[country.id] = country.totalScore;
            }
          });
          setAllNationScores(scores);
        }
      } catch (scoresError) {
        console.warn("국가 점수 업데이트 실패:", scoresError);
      }

      // 외교/군사 데이터 업데이트
      if (selectedNation) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        
        // 외교 데이터 가져오기
        try {
          const diplomacyResponse = await fetch(`${apiUrl}/api/country/${selectedNation}/diplomacy`);
          if (diplomacyResponse.ok) {
            const diplomacyData = await diplomacyResponse.json() as DiplomacyRelation[];
            setDiplomacyData(diplomacyData);
          }
        } catch (diplomacyError) {
          console.warn("외교 데이터 업데이트 실패:", diplomacyError);
        }

        // 군사 데이터 가져오기
        try {
          const militaryResponse = await fetch(`${apiUrl}/api/country/${selectedNation}/military`);
          if (militaryResponse.ok) {
            const militaryData = await militaryResponse.json() as MilitaryUnit[];
            setMilitaryData(militaryData);
          }
        } catch (militaryError) {
          console.warn("군사 데이터 업데이트 실패:", militaryError);
        }
      }
    } catch (error) {
      console.error("API 호출 실패:", error);
      
      // 오류 발생 시 로딩 카드를 에러 메시지로 교체
      const errorLog: CommandLog = {
        id: loadingLogId,
        command,
        response: "명령 처리 중 오류가 발생했습니다. 백엔드 서버를 확인하세요.",
        timestamp: new Date(),
        isLoading: false,
      };
      setCommandLogs((prev) => 
        prev.map((log) => log.id === loadingLogId ? errorLog : log)
      );
    } finally {
      setIsLoading(false);
    }
  }, [commandInput, isLoading, selectedNation, nationInfo]);

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

  // 턴 변경 감지
  useEffect(() => {
    if (turn !== prevTurnRef.current) {
      setTurnChanged(true);
      prevTurnRef.current = turn;
    }
  }, [turn]);

  // 백엔드에서 받은 totalScore 사용
  const totalScore = currentTotalScore;

  const prevTotalScoreRef = useRef(totalScore);
  const prevTotalScore = prevTotalScoreRef.current;

  // 초기 로딩 방지
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // localStorage에서 사용자명 가져오기
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  // URL에서 국가가 전달되면 자동으로 설정 및 백엔드에서 데이터 로드
  useEffect(() => {
    if (nationFromUrl) {
      setSelectedNation(nationFromUrl);
      
      // 백엔드에서 국가 데이터 가져오기 (실패 시 알림 표시)
      const loadCountryData = async () => {
        let connectionFailed = false;
        let errorMessage = "";
        
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          
          // 타임아웃을 위한 AbortController
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃
          
          try {
            // 백엔드 상태 확인
            const statusResponse = await fetch(`${apiUrl}/status`, {
              method: 'GET',
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (!statusResponse.ok) {
              connectionFailed = true;
              errorMessage = "백엔드 서버가 응답하지 않습니다.";
              throw new Error(errorMessage);
            }
            
            // 국가 데이터 가져오기
            const countryController = new AbortController();
            const countryTimeoutId = setTimeout(() => countryController.abort(), 5000);
            
            try {
              const response = await fetch(`${apiUrl}/api/country/${nationFromUrl}`, {
                signal: countryController.signal,
              });
              
              clearTimeout(countryTimeoutId);
              
              if (!response.ok) {
                connectionFailed = true;
                errorMessage = `국가 데이터를 가져올 수 없습니다. (${response.status})`;
                throw new Error(errorMessage);
              }
              
              const data = await response.json();
              setStats({
                finance: data.finance,
                population: data.population,
                happiness: data.happiness,
                military: data.military,
              });
              if (data.turn) {
                setTurn(data.turn);
              }
              if (data.totalScore !== undefined) {
                setCurrentTotalScore(data.totalScore);
              }
              
              // 모든 국가의 점수 가져오기
              try {
                const countriesResponse = await fetch(`${apiUrl}/api/countries`, {
                  signal: countryController.signal,
                });
                if (countriesResponse.ok) {
                  const countriesData = (await countriesResponse.json()) as Array<{
                    id?: unknown;
                    totalScore?: number;
                  }>;
                  const scores: Partial<Record<NationId, number>> = {};
                  countriesData.forEach((country) => {
                    if (isNationId(country.id)) {
                      scores[country.id] = country.totalScore;
                    }
                  });
                  setAllNationScores(scores);
                }
              } catch (scoresError) {
                // 점수 로드 실패해도 계속 진행
                console.warn("국가 점수 로드 실패:", scoresError);
              }
            } catch (countryError) {
              clearTimeout(countryTimeoutId);
              if (countryError instanceof Error) {
                if (countryError.name === 'AbortError') {
                  connectionFailed = true;
                  errorMessage = "백엔드 서버 연결 시간이 초과되었습니다.";
                } else {
                  connectionFailed = true;
                  errorMessage = countryError.message || "국가 데이터를 가져오는 중 오류가 발생했습니다.";
                }
                throw countryError;
              }
            }
            
            // 뉴스 데이터 가져오기
            const newsController = new AbortController();
            const newsTimeoutId = setTimeout(() => newsController.abort(), 5000);
            
            try {
              const newsResponse = await fetch(`${apiUrl}/api/country/${nationFromUrl}/news`, {
                signal: newsController.signal,
              });
              
              clearTimeout(newsTimeoutId);
              
              if (newsResponse.ok) {
                const newsData = await newsResponse.json();
                if (Array.isArray(newsData) && newsData.length > 0) {
                  setNews(newsData.slice(0, 3).map((n: any, i: number): NewsItem => {
                    let newsType: "event" | "war" | "diplomacy" | "economy" = "event";
                    if (n.type === "war") newsType = "war";
                    else if (n.type === "diplomacy") newsType = "diplomacy";
                    else if (n.type === "economy") newsType = "economy";
                    
                    return {
                      id: n.id || Date.now() + i,
                      title: n.title,
                      content: n.content,
                      type: newsType,
                    };
                  }));
                }
              }
            } catch (newsError) {
              clearTimeout(newsTimeoutId);
              // 뉴스는 실패해도 계속 진행 (필수 데이터가 아니므로)
              console.warn("뉴스 데이터 로드 실패:", newsError);
            }
            
            // 명령기록 데이터 가져오기
            const logsController = new AbortController();
            const logsTimeoutId = setTimeout(() => logsController.abort(), 5000);
            
            try {
              const logsResponse = await fetch(`${apiUrl}/api/country/${nationFromUrl}/logs`, {
                signal: logsController.signal,
              });
              
              clearTimeout(logsTimeoutId);
              
              if (logsResponse.ok) {
                const logsData = await logsResponse.json();
                if (Array.isArray(logsData) && logsData.length > 0) {
                  // 오래된 순으로 정렬 (최신 것이 맨 밑에 보이도록)
                  const sortedLogs = logsData
                    .sort((a: any, b: any) => {
                      const timeA = new Date(a.timestamp).getTime();
                      const timeB = new Date(b.timestamp).getTime();
                      return timeA - timeB; // 오름차순 정렬
                    })
                    .map((log: any): CommandLog => ({
                      id: log.id,
                      command: log.command,
                      response: log.response,
                      timestamp: new Date(log.timestamp),
                      isLoading: false,
                    }));
                  setCommandLogs(sortedLogs);
                }
              }
            } catch (logsError) {
              clearTimeout(logsTimeoutId);
              // 명령기록은 실패해도 계속 진행 (필수 데이터가 아니므로)
              console.warn("명령기록 데이터 로드 실패:", logsError);
            }
            
            // 외교 데이터 가져오기
            const diplomacyController = new AbortController();
            const diplomacyTimeoutId = setTimeout(() => diplomacyController.abort(), 5000);
            
            try {
              const diplomacyResponse = await fetch(`${apiUrl}/api/country/${nationFromUrl}/diplomacy`, {
                signal: diplomacyController.signal,
              });
              
              clearTimeout(diplomacyTimeoutId);
              
              if (diplomacyResponse.ok) {
                const diplomacyData = await diplomacyResponse.json() as DiplomacyRelation[];
                setDiplomacyData(diplomacyData);
                prevDiplomacyDataRef.current = [...diplomacyData];
              }
            } catch (diplomacyError) {
              clearTimeout(diplomacyTimeoutId);
              console.warn("외교 데이터 로드 실패:", diplomacyError);
            }
            
            // 군사 데이터 가져오기
            const militaryController = new AbortController();
            const militaryTimeoutId = setTimeout(() => militaryController.abort(), 5000);
            
            try {
              const militaryResponse = await fetch(`${apiUrl}/api/country/${nationFromUrl}/military`, {
                signal: militaryController.signal,
              });
              
              clearTimeout(militaryTimeoutId);
              
              if (militaryResponse.ok) {
                const militaryData = await militaryResponse.json() as MilitaryUnit[];
                setMilitaryData(militaryData);
                prevMilitaryDataRef.current = [...militaryData];
              }
            } catch (militaryError) {
              clearTimeout(militaryTimeoutId);
              console.warn("군사 데이터 로드 실패:", militaryError);
            }
          } catch (statusError) {
            clearTimeout(timeoutId);
            if (statusError instanceof Error) {
              if (statusError.name === 'AbortError') {
                connectionFailed = true;
                errorMessage = "백엔드 서버 연결 시간이 초과되었습니다.";
              } else if (!errorMessage) {
                connectionFailed = true;
                errorMessage = statusError.message || "백엔드 서버에 연결할 수 없습니다.";
              }
            } else {
              connectionFailed = true;
              errorMessage = "백엔드 서버에 연결할 수 없습니다.";
            }
            throw statusError;
          }
        } catch (error) {
          // 예상치 못한 오류
          if (!connectionFailed) {
            connectionFailed = true;
            if (error instanceof Error) {
              errorMessage = error.message || "백엔드 서버에 연결할 수 없습니다.";
            } else {
              errorMessage = "백엔드 서버에 연결할 수 없습니다.";
            }
          }
        }
        
        // 연결 실패 시 알림 표시 및 선택 페이지로 리다이렉트
        if (connectionFailed) {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          alert(
            `백엔드 서버 연결 실패\n\n` +
            `오류: ${errorMessage}\n\n` +
            `백엔드 서버가 실행 중인지 확인하세요.\n` +
            `서버 주소: ${apiUrl}\n\n` +
            `확인을 누르면 국가 선택 페이지로 돌아갑니다.`
          );
          routerRef.current.push('/selection');
        }
      };
      
      loadCountryData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nationFromUrl]);

  // BGM 자동 재생
  useEffect(() => {
    if (mounted && bgmRef.current) {
      bgmRef.current.play().catch((error) => {
        console.log("BGM 자동 재생 실패:", error);
      });
    }
  }, [mounted]);

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
    <>
      <audio
        ref={bgmRef}
        src="/bgm.mp3"
        loop
        preload="auto"
        style={{ display: 'none' }}
      />
      <audio
        ref={sendSoundRef}
        src="/home/send.mp3"
        preload="auto"
        style={{ display: 'none' }}
      />
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
        <div className="relative z-10 flex flex-col h-screen">
      {/* ① 상단 헤더 (Status Bar) */}
      <header className="w-full glass-panel border-b border-[#C9A227]/30 px-6 py-3 flex-shrink-0 relative z-50">
        <div className="max-w-[1850px] mx-auto flex items-center justify-between">
          {/* 국가 정보 */}
          <div className="flex items-center gap-4">
            <div 
              className="relative w-12 h-12 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => router.push("/login")}
            >
              <Image
                src="/logo.png"
                alt="Logo"
                fill
                className="object-contain"
              />
            </div>
            <div>
              <h1 
                className="text-xl font-bold font-serif"
                style={{ color: nationInfo[selectedNation].color }}
              >
                {nationInfo[selectedNation].name}
              </h1>
              <p className="text-xs text-[#A89F91]">
                {username || `제 ${turn}대 군주`}
              </p>
            </div>
          </div>

          {/* 수치 데이터 */}
          <div className="flex items-center gap-3 animate-fade-in">
            <StatItem 
              icon="💰" 
              label="재정" 
              value={stats.finance} 
              prevValue={prevStatsRef.current.finance}
              showArrow={turnChanged}
              suffix="원" 
              allNationStats={allNationStats}
              allNationScores={allNationScores}
              statType="finance"
              selectedNation={selectedNation}
            />
            <StatItem 
              icon="👥" 
              label="인구" 
              value={stats.population}
              prevValue={prevStatsRef.current.population}
              showArrow={turnChanged}
              allNationStats={allNationStats}
              allNationScores={allNationScores}
              statType="population"
              selectedNation={selectedNation}
            />
            <StatItem 
              icon="😊" 
              label="행복도" 
              value={stats.happiness} 
              prevValue={prevStatsRef.current.happiness}
              showArrow={turnChanged}
              suffix="%"
              allNationStats={allNationStats}
              allNationScores={allNationScores}
              statType="happiness"
              selectedNation={selectedNation}
            />
            <StatItem 
              icon="⚔️" 
              label="군사력" 
              value={stats.military}
              prevValue={prevStatsRef.current.military}
              showArrow={turnChanged}
              allNationStats={allNationStats}
              allNationScores={allNationScores}
              statType="military"
              selectedNation={selectedNation}
            />
            <StatItem 
              icon="🏆" 
              label="총합 점수" 
              value={totalScore}
              prevValue={prevTotalScore}
              showArrow={turnChanged}
              allNationStats={allNationStats}
              allNationScores={allNationScores}
              statType="totalScore"
              selectedNation={selectedNation}
            />
            <StatItem 
              icon="📜" 
              label="현재 턴" 
              value={turn}
              allNationStats={allNationStats}
              allNationScores={allNationScores}
              statType="turn"
              selectedNation={selectedNation}
              turn={turn}
            />
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 영역 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 왼쪽: 3D 캐릭터 */}
        {selectedNation && (
          <aside className="w-[350px] flex flex-col" style={{ borderRight: 'none', background: 'transparent', backdropFilter: 'none' }}>
            <div className="flex-1 p-2 overflow-hidden">
              <Character3D 
                key={selectedNation}
                nation={selectedNation} 
                animationType="normal"
                mood={currentMood}
                shouldPlay={true}
              />
            </div>
          </aside>
        )}
        
        {/* ③ 중앙 메인 화면 (Story & News) */}
        <main className="flex-1 p-6 overflow-y-auto">
            {/* 진행 중: 현재 상황, 뉴스, 명령 로그 */}
            <div className="max-w-5xl mx-auto space-y-6">
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
                <div className="grid grid-cols-1 gap-4">
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
                        </div>
                        {log.isLoading ? (
                          <div className="flex items-center gap-2 ml-5 mt-2">
                            <div className="loading-spinner" style={{ width: "16px", height: "16px" }}></div>
                            <p className="text-[#A89F91] text-sm italic">
                              {loadingMessages[log.loadingMessageIndex ?? 0]}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[#A89F91] text-sm ml-5">
                            {log.response}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
      </main>

        {/* ② 우측 패널 (Navigation & Info) */}
        <aside className="w-[320px] glass-panel border-l border-[#C9A227]/20 flex flex-col relative z-40">
          {/* 중앙: 지도 */}
          <div className="flex-[2] p-4 border-b border-[#C9A227]/20 flex flex-col">
            <div className="flex-1 glass-panel rounded-xl p-2 relative min-h-0 z-0">
              <KoreaMap 
                financeIncrease={financeIncrease} 
                selectedNation={selectedNation}
                nationScores={allNationScores}
              />
            </div>
          </div>

          {/* 하단: 외교/군사 탭 */}
          <div className="flex-[1] p-4 flex flex-col min-h-0">
            {/* 탭 버튼 */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab("diplomacy")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "diplomacy"
                    ? "bg-[#C9A227]/80 backdrop-blur-md text-[#0d0d0d] border border-[#C9A227]/30 shadow-lg"
                    : "bg-black/10 backdrop-blur-md text-[#A89F91] hover:bg-black/20 border border-white/10 shadow-sm"
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>🤝 외교</span>
                  {(() => {
                    if (diplomacyData.length === 0 || prevDiplomacyDataRef.current.length === 0) return null;
                    const currentTotal = diplomacyData.reduce((sum, rel) => sum + rel.favorability, 0);
                    const prevTotal = prevDiplomacyDataRef.current.reduce((sum, rel) => sum + rel.favorability, 0);
                    const diff = currentTotal - prevTotal;
                    if (diff > 0) {
                      return <span className="text-xs font-bold text-green-500">▲</span>;
                    } else if (diff < 0) {
                      return <span className="text-xs font-bold text-red-500">▼</span>;
                    }
                    return null;
                  })()}
                </div>
              </button>
              <button
                onClick={() => setActiveTab("military")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "military"
                    ? "bg-[#C9A227]/80 backdrop-blur-md text-[#0d0d0d] border border-[#C9A227]/30 shadow-lg"
                    : "bg-black/10 backdrop-blur-md text-[#A89F91] hover:bg-black/20 border border-white/10 shadow-sm"
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>⚔️ 군사</span>
                  {(() => {
                    if (militaryData.length === 0 || prevMilitaryDataRef.current.length === 0) return null;
                    const currentTotal = militaryData.reduce((sum, unit) => sum + unit.count, 0);
                    const prevTotal = prevMilitaryDataRef.current.reduce((sum, unit) => sum + unit.count, 0);
                    const diff = currentTotal - prevTotal;
                    if (diff > 0) {
                      return <span className="text-xs font-bold text-green-500">▲</span>;
                    } else if (diff < 0) {
                      return <span className="text-xs font-bold text-red-500">▼</span>;
                    }
                    return null;
                  })()}
                </div>
              </button>
            </div>

            {/* 탭 컨텐츠 */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === "diplomacy" ? (
                selectedNation ? (
                  <DiplomacyInfo 
                    diplomacyData={diplomacyData}
                    prevDiplomacyData={turnChanged ? prevDiplomacyDataRef.current : undefined}
                    selectedNation={selectedNation}
                  />
                ) : (
                  <p className="text-[#6B6B6B] text-center py-4 text-sm">
                    국가를 선택해주세요.
                  </p>
                )
              ) : (
                <MilitaryInfo 
                  militaryData={militaryData}
                  prevMilitaryData={turnChanged ? prevMilitaryDataRef.current : undefined}
                  turnChanged={turnChanged}
                />
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ④ 하단 입력창 (Control) */}
        <footer className="w-full glass-panel border-t border-[#C9A227]/30 px-6 py-4 animate-fade-in flex-shrink-0">
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
    </>
  );
}
