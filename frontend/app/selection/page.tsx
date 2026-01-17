"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

// 타자기 효과 컴포넌트
function Typewriter({ 
  text, 
  delay = 0, 
  speed = 50,
  className = "",
  style = {}
}: { 
  text: string; 
  delay?: number; 
  speed?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [displayedText, setDisplayedText] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setStarted(true);
    }, delay);
    return () => clearTimeout(startTimer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex <= text.length) {
        setDisplayedText(text.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [started, text, speed]);

  return (
    <span className={className} style={style}>
      {displayedText}
      {started && displayedText.length < text.length && (
        <span className="animate-pulse">|</span>
      )}
    </span>
  );
}

interface Nation {
  id: string;
  name: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  stats: {
    gold: number;
    population: number;
    military: number;
  };
  feature: string;
}

const nations: Nation[] = [
  {
    id: "goguryeo",
    name: "고구려",
    title: "북방의 맹주",
    icon: "🏔️",
    color: "#C41E3A",
    description: "강력한 군사력과 광활한 영토를 자랑하는 고구려는 철기병과 산성 전술로 유명합니다.",
    stats: {
      gold: 15000,
      population: 80000,
      military: 15000,
    },
    feature: "강력한 군사력",
  },
  {
    id: "baekje",
    name: "백제",
    title: "해상 무역의 강국",
    icon: "🌊",
    color: "#1E90FF",
    description: "해상 무역과 문화 예술이 발달한 백제는 일본, 중국과의 교류가 활발합니다.",
    stats: {
      gold: 18000,
      population: 60000,
      military: 10000,
    },
    feature: "풍부한 재정",
  },
  {
    id: "silla",
    name: "신라",
    title: "화랑도의 정신",
    icon: "👑",
    color: "#FFD700",
    description: "화랑도의 충성과 백성들의 단결력으로 무장한 신라는 금관가야를 흡수하며 성장 중입니다.",
    stats: {
      gold: 12000,
      population: 40000,
      military: 12000,
    },
    feature: "높은 단결력",
  },
];

export default function SelectionPage() {
  const router = useRouter();
  const [videoPhase, setVideoPhase] = useState<'dystopia' | 'transition' | 'intro' | 'selection'>('dystopia');
  const [selectedNation, setSelectedNation] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isFadingIn, setIsFadingIn] = useState(true);
  const [isKingsEnding, setIsKingsEnding] = useState(false);
  const dystopiaVideoRef = useRef<HTMLVideoElement>(null);
  const introVideoRef = useRef<HTMLVideoElement>(null);

  // 비디오 자동 재생
  useEffect(() => {
    if (videoPhase === 'dystopia' && dystopiaVideoRef.current) {
      dystopiaVideoRef.current.play().catch(() => {
        setVideoPhase('transition');
      });
    }
  }, [videoPhase]);

  // 트랜지션 처리: 4초 대기 후 kings 영상으로
  useEffect(() => {
    if (videoPhase === 'transition') {
      const timer = setTimeout(() => {
        setIsFadingIn(true);
        setVideoPhase('intro');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [videoPhase]);

  // kings 영상: fade in 완료 후 재생 시작
  useEffect(() => {
    if (videoPhase === 'intro' && isFadingIn && introVideoRef.current) {
      // fade in 완료 후 영상 재생
      const timer = setTimeout(() => {
        setIsFadingIn(false);
        if (introVideoRef.current) {
          introVideoRef.current.currentTime = 0;
          introVideoRef.current.play().catch(() => {
            setVideoPhase('selection');
          });
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [videoPhase, isFadingIn]);

  const handleDystopiaEnd = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setIsFadingOut(false);
      setVideoPhase('transition');
    }, 2000); // fade out 2초
  };

  const handleIntroEnd = () => {
    if (isKingsEnding) return;
    setIsKingsEnding(true);
    setTimeout(() => {
      setVideoPhase('selection');
    }, 800);
  };

  const handleSelectNation = (nationId: string) => {
    setSelectedNation(prev => prev === nationId ? null : nationId);
  };

  const handleConfirm = () => {
    if (selectedNation) {
      setIsExiting(true);
      setTimeout(() => {
        router.push(`/home?nation=${selectedNation}`);
      }, 500);
    }
  };

  // dystopia 영상
  if (videoPhase === 'dystopia') {
    return (
      <div 
        className="h-screen w-screen flex items-center justify-center overflow-hidden bg-black relative cursor-pointer"
        onClick={handleDystopiaEnd}
      >
        <video
          ref={dystopiaVideoRef}
          src="/selection/dystopia.mp4"
          autoPlay
          playsInline
          onEnded={handleDystopiaEnd}
          className={`w-full h-full object-cover transition-opacity ${isFadingOut ? 'opacity-0' : 'opacity-100'} pointer-events-none`}
          style={{ transitionDuration: '2s' }}
        />
        
        {/* 자막 */}
        <div className={`absolute bottom-0 left-0 right-0 pb-16 px-8 transition-opacity duration-1000 ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}>
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-white text-lg md:text-xl font-medium mb-3 drop-shadow-lg"
               style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.9)' }}>
              <Typewriter text="기원전 57년, 한반도" delay={300} speed={40} />
            </p>
            <p className="text-white/90 text-base md:text-lg leading-relaxed drop-shadow-lg"
               style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.9)' }}>
              <Typewriter text="중국 한나라의 지배가 무너지고, 수많은 부족이 패권을 다투던 시대." delay={1200} speed={30} />
            </p>
            <p className="text-white/90 text-base md:text-lg leading-relaxed drop-shadow-lg mt-2"
               style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.9)' }}>
              <Typewriter text="전쟁과 기근, 약탈이 끊이지 않았고... 백성들은 지쳐가고 있었다." delay={3500} speed={30} />
            </p>
            <p className="text-white/90 text-base md:text-lg leading-relaxed drop-shadow-lg mt-2"
               style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.9)' }}>
              <Typewriter text="혼란의 시대, 누군가는 이 땅을 하나로 통일해야 했다." delay={5500} speed={30} />
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 트랜지션 (까만 화면 + 영웅 등장 텍스트)
  if (videoPhase === 'transition') {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-center px-8">
          <p className="text-[#C9A227] text-xl md:text-2xl font-serif mb-6 animate-fade-in"
             style={{ animationDelay: '0.5s' }}>
            그리고, 세 명의 영웅이 나타났다.
          </p>
          <div className="space-y-4">
            <p className="text-white text-lg md:text-xl animate-fade-in"
               style={{ animationDelay: '1.2s' }}>
              <span className="text-[#C41E3A] font-bold">고구려</span>의 <span className="text-[#C41E3A]">주몽</span>
            </p>
            <p className="text-white text-lg md:text-xl animate-fade-in"
               style={{ animationDelay: '1.6s' }}>
              <span className="text-[#1E90FF] font-bold">백제</span>의 <span className="text-[#1E90FF]">온조</span>
            </p>
            <p className="text-white text-lg md:text-xl animate-fade-in"
               style={{ animationDelay: '2s' }}>
              <span className="text-[#FFD700] font-bold">신라</span>의 <span className="text-[#FFD700]">박혁거세</span>
            </p>
          </div>
          <p className="text-white/80 text-base md:text-lg mt-8 animate-fade-in"
             style={{ animationDelay: '2.5s' }}>
            삼국통일을 향한 대서사시가 시작된다.
          </p>
        </div>
      </div>
    );
  }

  // kings 영상
  if (videoPhase === 'intro') {
    return (
      <div 
        className={`h-screen w-screen flex items-center justify-center overflow-hidden bg-black cursor-pointer transition-all duration-700 ease-in-out ${isKingsEnding ? 'opacity-0 translate-x-[100px]' : 'opacity-100 translate-x-0'}`}
        onClick={() => !isFadingIn && handleIntroEnd()}
      >
        <video
          ref={introVideoRef}
          src="/selection/kings.mp4"
          playsInline
          onEnded={handleIntroEnd}
          className={`w-full h-full object-cover transition-opacity pointer-events-none ${isFadingIn ? 'opacity-0' : 'opacity-100'}`}
          style={{ transitionDuration: '2s' }}
        />
      </div>
    );
  }

  return (
    <div 
      className={`h-screen bg-[#0D0D0D] flex items-start justify-center overflow-hidden pt-16 transition-opacity duration-500 ${isExiting ? 'opacity-0' : 'opacity-100'}`}
      style={{
        backgroundImage: 'url(/selection/temple.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-[#0D0D0D]/50"></div>
      
      <div className="relative z-10 w-full max-w-6xl px-6 py-8">
        {/* 타이틀 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-[#C9A227] font-serif mb-3">
            국가를 선택하세요
          </h1>
          <p className="text-[#A89F91] text-lg">
            삼국 중 하나를 선택하여 천하통일의 위업을 달성하세요
          </p>
        </div>

        {/* 국가 카드들 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {nations.map((nation) => {
            const isExpanded = selectedNation === nation.id;
            return (
              <button
                key={nation.id}
                onClick={() => handleSelectNation(nation.id)}
                className={`
                  relative rounded-2xl transition-all duration-500 text-left
                  backdrop-blur-xl border-2 shadow-2xl
                  ${isExpanded 
                    ? 'border-[#C9A227] scale-105 bg-[#1a1a1a]/80 p-6' 
                    : 'border-white/10 hover:border-white/30 bg-[#1a1a1a]/50 hover:bg-[#1a1a1a]/70 p-4 scale-95'
                  }
                `}
              >
                {/* 선택 표시 */}
                {isExpanded && (
                  <div className="absolute top-4 right-4 w-6 h-6 bg-[#C9A227] rounded-full flex items-center justify-center">
                    <span className="text-black text-sm">✓</span>
                  </div>
                )}

                {/* 아이콘 & 이름 (항상 표시) */}
                <div className={`flex items-center gap-4 ${isExpanded ? 'mb-4' : 'mb-0'}`}>
                  <span className="text-5xl">{nation.icon}</span>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{nation.name}</h2>
                    <p className="text-sm" style={{ color: nation.color }}>{nation.title}</p>
                  </div>
                </div>

                {/* 확장 시 상세 내용 */}
                <div 
                  className={`overflow-hidden transition-all duration-500 ease-in-out ${
                    isExpanded ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'
                  }`}
                >
                  {/* 설명 */}
                  <p className="text-[#A89F91] text-sm mb-4 leading-relaxed">
                    {nation.description}
                  </p>

                  {/* 특징 배지 */}
                  <div className="mb-4">
                    <span 
                      className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${nation.color}20`, color: nation.color, border: `1px solid ${nation.color}50` }}
                    >
                      {nation.feature}
                    </span>
                  </div>

                  {/* 스탯 */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-black/30 rounded-lg p-2">
                      <p className="text-[#FFD700] text-sm font-bold">{nation.stats.gold.toLocaleString()}</p>
                      <p className="text-[#6B6B6B] text-xs">재정</p>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2">
                      <p className="text-[#90EE90] text-sm font-bold">{nation.stats.population.toLocaleString()}</p>
                      <p className="text-[#6B6B6B] text-xs">인구</p>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2">
                      <p className="text-[#FF6B6B] text-sm font-bold">{nation.stats.military.toLocaleString()}</p>
                      <p className="text-[#6B6B6B] text-xs">군사력</p>
                    </div>
                  </div>
                </div>

                {/* 미선택 시 클릭 안내 */}
                {!isExpanded && (
                  <p className="text-[#6B6B6B] text-xs mt-3 text-center">클릭하여 상세 보기</p>
                )}
              </button>
            );
          })}
        </div>

        {/* 확인 버튼 */}
        <div className="text-center">
          {(() => {
            const selectedNationData = nations.find(n => n.id === selectedNation);
            return (
              <button
                onClick={handleConfirm}
                disabled={!selectedNation}
                className={`
                  px-12 py-4 rounded-xl font-bold text-lg transition-all duration-300
                  ${selectedNation
                    ? 'shadow-lg hover:shadow-xl hover:brightness-110'
                    : 'bg-[#333] text-[#6B6B6B] cursor-not-allowed'
                  }
                `}
                style={selectedNation && selectedNationData ? {
                  backgroundColor: selectedNationData.color,
                  color: selectedNationData.id === 'silla' ? '#0D0D0D' : '#FFFFFF',
                } : {}}
              >
                {selectedNation 
                  ? `${selectedNationData?.name}로 시작하기` 
                  : '국가를 선택해주세요'}
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
