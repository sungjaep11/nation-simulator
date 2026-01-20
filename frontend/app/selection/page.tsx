"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Character3D from "../components/Character3D";

/* -------------------- Typewriter -------------------- */
function Typewriter({
  text,
  delay = 0,
  speed = 50,
  className = "",
  style = {},
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
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    const interval = setInterval(() => {
      if (i <= text.length) {
        setDisplayedText(text.slice(0, i));
        i++;
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

/* -------------------- Data -------------------- */
interface Country {
  id: string;
  name: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  stats: {
    finance: number;
    population: number;
    military: number;
  };
  feature: string;
  lastFinanceChange?: number;
  lastPopulationChange?: number;
  lastMilitaryChange?: number;
  lastHappinessChange?: number;
}

const defaultCountries: Country[] = [
  {
    id: "goguryeo",
    name: "고구려",
    title: "북방의 맹주",
    icon: "🏔️",
    color: "#C41E3A",
    description:
      "강력한 군사력과 광활한 영토를 자랑하는 고구려는 철기병과 산성 전술로 유명합니다.",
    stats: { finance: 15000, population: 80000, military: 15 },
    feature: "강력한 군사력",
  },
  {
    id: "baekje",
    name: "백제",
    title: "해상 무역의 강국",
    icon: "🌊",
    color: "#1E90FF",
    description:
      "해상 무역과 문화 예술이 발달한 백제는 일본, 중국과의 교류가 활발합니다.",
    stats: { finance: 18000, population: 60000, military: 10 },
    feature: "풍부한 재정",
  },
  {
    id: "silla",
    name: "신라",
    title: "화랑도의 정신",
    icon: "👑",
    color: "#FFD700",
    description:
      "화랑도의 충성과 백성들의 단결력으로 무장한 신라는 성장 중인 국가입니다.",
    stats: { finance: 12000, population: 45000, military: 12 },
    feature: "높은 단결력",
  },
];

/* -------------------- Page -------------------- */
export default function SelectionPage() {
  const router = useRouter();
  const [videoPhase, setVideoPhase] = useState<'dystopia' | 'transition' | 'intro' | 'selection'>('dystopia');
const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isFadingIn, setIsFadingIn] = useState(true);
  const [isKingsEnding, setIsKingsEnding] = useState(false);
  const [isTransitionFadingOut, setIsTransitionFadingOut] = useState(false);
  const [subtitlePair, setSubtitlePair] = useState<0 | 1 | null>(null);
  const [isFirstPairFadingOut, setIsFirstPairFadingOut] = useState(false);
  const [countries, setCountries] = useState<Country[]>(defaultCountries);
  const dystopiaVideoRef = useRef<HTMLVideoElement>(null);
  const introVideoRef = useRef<HTMLVideoElement>(null);
  const bgmRef = useRef<HTMLAudioElement>(null);
  const selectSoundRef = useRef<HTMLAudioElement>(null);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 이미 선택한 국가가 있으면 홈으로 리다이렉트
  useEffect(() => {
    const checkExistingGameData = async () => {
      const sessionToken = localStorage.getItem("session_token");
      if (!sessionToken) {
        // 세션 토큰이 없으면 로그인 페이지로
        router.push("/login");
        return;
      }

      const email = localStorage.getItem("email");
      if (!email) {
        return;
      }
      const storedCountry = localStorage.getItem(`selected_country:${email}`);
      if (!storedCountry || !["goguryeo", "baekje", "silla"].includes(storedCountry)) {
        // 선택 기록이 없으면 선택 화면 유지
        return;
      }

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/api/countries?session_token=${encodeURIComponent(sessionToken)}`);
        
        if (response.ok) {
          const countries = await response.json();
          // 국가가 3개 모두 있으면 초기화된 상태이므로 선택 화면 표시
          if (countries && Array.isArray(countries) && countries.length === 3) {
            // 초기화된 상태에서는 선택 기록이 있어도 선택 화면을 보여줌
            return;
          }
          // 저장된 국가가 유효하고 게임이 진행 중이면 해당 국가로 이동
          if (countries && Array.isArray(countries) && countries.length > 0) {
            const hasStoredCountry = countries.some(
              (country) => country?.id === storedCountry
            );
            if (hasStoredCountry) {
              router.push(`/home?country=${storedCountry}`);
              return;
            }
          }
        } else if (response.status === 401) {
          // 인증 오류면 로그인 페이지로
          router.push("/login");
          return;
        }
        // 국가가 없거나 오류가 발생하면 기존 선택 화면 표시
      } catch (error) {
        // 네트워크 오류 등은 조용히 처리하고 선택 화면 표시
        // (백엔드 서버가 실행되지 않았을 수도 있음)
      }
    };

    checkExistingGameData();
  }, [router]);

  // 비디오 자동 재생
  useEffect(() => {
    if (videoPhase === 'dystopia' && dystopiaVideoRef.current) {
      dystopiaVideoRef.current.play().catch(() => {
        setVideoPhase('transition');
      });
    }
  }, [videoPhase]);

  // 자막 페어 타이밍 제어
  useEffect(() => {
    if (videoPhase !== 'dystopia') {
      setSubtitlePair(null);
      setIsFirstPairFadingOut(false);
      return;
    }

    // 첫 번째 페어 표시 (0.3초 후)
    const showFirstPair = setTimeout(() => {
      setSubtitlePair(0);
      setIsFirstPairFadingOut(false);
    }, 300);

    // 첫 번째 페어 페이드 아웃 시작 (약 2.5초 후 - 첫 줄이 끝나고 약간의 시간 후)
    const startFadeOut = setTimeout(() => {
      setIsFirstPairFadingOut(true);
    }, 2800);

    // 첫 번째 페어 완전히 숨김 (페이드 아웃 후)
    const hideFirstPair = setTimeout(() => {
      setSubtitlePair(null);
      setIsFirstPairFadingOut(false);
    }, 3300);

    // 두 번째 페어 표시 (약 3.5초 후)
    const showSecondPair = setTimeout(() => {
      setSubtitlePair(1);
    }, 3500);

    // 두 번째 페어는 비디오가 끝날 때까지 유지 (또는 일정 시간 후 숨김)
    // handleDystopiaEnd에서 처리됨

    return () => {
      clearTimeout(showFirstPair);
      clearTimeout(startFadeOut);
      clearTimeout(hideFirstPair);
      clearTimeout(showSecondPair);
    };
  }, [videoPhase]);

  // 트랜지션 처리: 4초 대기 후 kings 영상으로 (3.5초에 페이드 아웃 시작)
  useEffect(() => {
    if (videoPhase === 'transition') {
      setIsTransitionFadingOut(false);
      // 3.5초 후 페이드 아웃 시작
      const fadeOutTimer = setTimeout(() => {
        setIsTransitionFadingOut(true);
      }, 3500);
      
      // 4초 후 intro로 전환
      transitionTimerRef.current = setTimeout(() => {
        setIsFadingIn(true);
        setVideoPhase('intro');
      }, 4000);
      
      return () => {
        if (transitionTimerRef.current) {
          clearTimeout(transitionTimerRef.current);
        }
        clearTimeout(fadeOutTimer);
      };
    }
  }, [videoPhase]);

  const handleTransitionSkip = () => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    setIsTransitionFadingOut(true);
    setTimeout(() => {
      setIsFadingIn(true);
      setVideoPhase('intro');
    }, 500);
  };

  // kings 영상: fade in 완료 후 재생 시작
  useEffect(() => {
    if (videoPhase === 'intro' && isFadingIn && introVideoRef.current) {
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
    }, 2000);
  };

  const handleIntroEnd = () => {
    if (isKingsEnding) return;
    setIsKingsEnding(true);
    setTimeout(() => {
      setVideoPhase('selection');
    }, 800);
  };

const handleSelectCountry = (countryId: string) => {
  // 선택 사운드 재생 (클릭할 때마다 재생)
  const audio = new Audio('/selection/select.mp3');
  audio.volume = 1.0;
  audio.play().catch((error) => {
    console.error("Select sound 재생 실패:", error);
  });
  
  setSelectedCountry(prev => prev === countryId ? null : countryId);
  };

  const handleConfirm = () => {
    if (!selectedCountry) return;
    
    // 시작 사운드 재생
    const audio = new Audio('/selection/start.mp3');
    audio.volume = 1.0;
    audio.play().catch((error) => {
      console.error("Start sound 재생 실패:", error);
    });
    
    setIsExiting(true);
    setTimeout(() => {
      const email = localStorage.getItem("email");
      if (email) {
        localStorage.setItem(`selected_country:${email}`, selectedCountry);
      }
      router.push(`/home?country=${selectedCountry}`);
    }, 500);
  };

  // dystopia 영상
  if (videoPhase === 'dystopia') {
    return (
      <>
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black cursor-pointer" 
          onClick={handleDystopiaEnd}
        >
          {/* 상단 검은색 테두리 */}
          <div className="absolute top-0 left-0 right-0 h-16 bg-black z-20" />
          
          <video 
            ref={dystopiaVideoRef} 
            src="/selection/dystopia.mp4" 
            autoPlay 
            playsInline 
            onEnded={handleDystopiaEnd}
            onError={(e) => {
              console.error('Video error:', e);
            }}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity pointer-events-none ${
              isFadingOut ? 'opacity-0' : 'opacity-100'
            }`}
            style={{ transitionDuration: '2s' }}
          />
          
          {/* 하단 검은색 테두리 */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-black z-20" />
          {/* 자막 */}
          <div 
            className={`absolute bottom-0 left-0 right-0 transition-opacity duration-1000 ${
              isFadingOut ? 'opacity-0' : 'opacity-100'
            }`}
            style={{
              paddingBottom: 'clamp(2rem, 8vh, 4rem)',
              paddingLeft: 'clamp(1rem, 4vw, 2rem)',
              paddingRight: 'clamp(1rem, 4vw, 2rem)',
            }}
          >
            <div className="max-w-4xl mx-auto text-center">
              {/* 첫 번째 페어 */}
              {subtitlePair === 0 && (
                <div className={`transition-opacity duration-500 ${isFirstPairFadingOut ? 'opacity-0' : 'opacity-100'}`}>
                  <p 
                    className="text-white font-bold drop-shadow-lg" 
                    style={{ 
                      textShadow: '2px 2px 8px rgba(0,0,0,0.9)',
                      fontSize: 'clamp(1.25rem, 4vw, 1.875rem)',
                      marginBottom: 'clamp(0.75rem, 2vh, 1rem)',
                    }}
                  >
                    <Typewriter text="기원전 57년, 한반도" delay={0} speed={40} />
                  </p>
                  <p 
                    className="text-white font-semibold leading-relaxed drop-shadow-lg" 
                    style={{ 
                      textShadow: '2px 2px 8px rgba(0,0,0,0.9)',
                      fontSize: 'clamp(1rem, 3vw, 1.5rem)',
                    }}
                  >
                    <Typewriter text="중국 한나라의 지배가 무너지고, 수많은 부족이 패권을 다투던 시대." delay={900} speed={30} />
                  </p>
                </div>
              )}
              {/* 두 번째 페어 */}
              {subtitlePair === 1 && (
                <div className="transition-opacity duration-500">
                  <p 
                    className="text-white font-semibold leading-relaxed drop-shadow-lg" 
                    style={{ 
                      textShadow: '2px 2px 8px rgba(0,0,0,0.9)',
                      fontSize: 'clamp(1rem, 3vw, 1.5rem)',
                    }}
                  >
                    <Typewriter text="전쟁과 기근, 약탈이 끊이지 않았고... 백성들은 지쳐가고 있었다." delay={0} speed={30} />
                  </p>
                  <p 
                    className="text-white font-semibold leading-relaxed drop-shadow-lg" 
                    style={{ 
                      textShadow: '2px 2px 8px rgba(0,0,0,0.9)',
                      fontSize: 'clamp(1rem, 3vw, 1.5rem)',
                      marginTop: 'clamp(0.5rem, 1.5vh, 0.75rem)',
                    }}
                  >
                    <Typewriter text="혼란의 시대, 누군가는 이 땅을 하나로 통일해야 했다." delay={2000} speed={30} />
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // 트랜지션 (까만 화면 + 영웅 등장 텍스트)
  if (videoPhase === 'transition') {
    return (
      <div 
        className={`fixed inset-0 z-50 h-screen w-screen bg-black flex items-center justify-center cursor-pointer overflow-hidden transition-opacity duration-1500 ${
          isTransitionFadingOut ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={handleTransitionSkip}
      >
        {/* 배경 파티클 효과 */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-3 h-3 bg-[#C9A227] rounded-full animate-pulse blur-sm" style={{ animationDelay: '0s' }}></div>
          <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-[#C41E3A] rounded-full animate-pulse blur-sm" style={{ animationDelay: '0.5s' }}></div>
          <div className="absolute bottom-1/3 left-1/3 w-3 h-3 bg-[#1E90FF] rounded-full animate-pulse blur-sm" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-1/4 right-1/3 w-2 h-2 bg-[#FFD700] rounded-full animate-pulse blur-sm" style={{ animationDelay: '1.5s' }}></div>
          <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-[#C9A227] rounded-full animate-pulse blur-sm" style={{ animationDelay: '2s' }}></div>
        </div>

        {/* 배경 그라데이션 효과 */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            background: 'radial-gradient(circle at center, rgba(201, 162, 39, 0.2) 0%, transparent 70%)'
          }}
        ></div>

        {/* 메인 텍스트 컨테이너 */}
        <div 
          className="text-center relative z-10 mx-auto"
          style={{
            paddingLeft: 'clamp(1rem, 4vw, 2rem)',
            paddingRight: 'clamp(1rem, 4vw, 2rem)',
            maxWidth: 'min(90vw, 80rem)',
          }}
        >
          {/* 첫 번째 문구 */}
          <div style={{ marginBottom: 'clamp(0.75rem, 2vh, 1.5rem)' }}>
            <p 
              className="text-white font-serif opacity-0 animate-fade-in-scale animate-text-glow"
              style={{ 
                animationDelay: '0.3s',
                textShadow: '0 0 20px rgba(255, 255, 255, 0.6), 0 0 40px rgba(255, 255, 255, 0.4), 0 0 60px rgba(255, 255, 255, 0.2)',
                letterSpacing: '0.1em',
                lineHeight: '1.4',
                fontWeight: '600',
                fontSize: 'clamp(1.125rem, 4vw, 1.875rem)',
                marginBottom: 'clamp(0.75rem, 2vh, 1rem)',
              }}
            >
              천하가 갈라진 난세,
            </p>
          </div>

          {/* 구분선 */}
          <div 
            className="h-0.5 mx-auto bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-0 animate-fade-in-scale"
            style={{ 
              animationDelay: '0.3s',
              width: 'clamp(6rem, 20vw, 12rem)',
              marginBottom: 'clamp(0.75rem, 2vh, 1.5rem)',
            }}
          ></div>

          {/* 두 번째 문구 */}
          <div style={{ marginBottom: 'clamp(0.75rem, 2vh, 1.5rem)' }}>
            <p 
              className="text-white font-serif opacity-0 animate-fade-in-scale animate-text-glow"
              style={{ 
                animationDelay: '0.3s',
                textShadow: '0 0 15px rgba(255, 255, 255, 0.6), 0 0 30px rgba(255, 255, 255, 0.4), 0 0 45px rgba(255, 255, 255, 0.2)',
                letterSpacing: '0.08em',
                lineHeight: '1.4',
                fontWeight: '600',
                fontSize: 'clamp(1rem, 3vw, 1.5rem)',
                marginBottom: 'clamp(0.75rem, 2vh, 1rem)',
              }}
            >
              검을 들어 영웅이 되어라.
            </p>
          </div>

          {/* 구분선 */}
          <div 
            className="h-0.5 mx-auto bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 animate-fade-in-scale"
            style={{ 
              animationDelay: '0.3s',
              width: 'clamp(4rem, 15vw, 10rem)',
              marginBottom: 'clamp(0.75rem, 2vh, 1.5rem)',
            }}
          ></div>

          {/* 세 번째 문구 */}
          <div style={{ marginBottom: 'clamp(0.75rem, 2vh, 1.5rem)' }}>
            <p 
              className="text-white font-serif opacity-0 animate-fade-in-scale animate-text-glow"
              style={{ 
                animationDelay: '0.3s',
                textShadow: '0 0 12px rgba(255, 255, 255, 0.6), 0 0 24px rgba(255, 255, 255, 0.4), 0 0 36px rgba(255, 255, 255, 0.2)',
                letterSpacing: '0.06em',
                lineHeight: '1.5',
                fontWeight: '600',
                fontSize: 'clamp(0.875rem, 2.5vw, 1.25rem)',
              }}
            >
              그리고 그 검 끝으로
            </p>
            <p 
              className="text-white font-serif opacity-0 animate-fade-in-scale animate-text-glow"
              style={{ 
                animationDelay: '0.3s',
                textShadow: '0 0 12px rgba(255, 255, 255, 0.6), 0 0 24px rgba(255, 255, 255, 0.4), 0 0 36px rgba(255, 255, 255, 0.2)',
                letterSpacing: '0.06em',
                lineHeight: '1.5',
                fontWeight: '600',
                fontSize: 'clamp(0.875rem, 2.5vw, 1.25rem)',
                marginTop: 'clamp(0.5rem, 1.5vh, 0.75rem)',
              }}
            >
              삼국을 하나로 묶어
            </p>
            <p 
              className="text-white font-serif opacity-0 animate-fade-in-scale animate-text-glow"
              style={{ 
                animationDelay: '0.3s',
                textShadow: '0 0 18px rgba(255, 255, 255, 0.7), 0 0 36px rgba(255, 255, 255, 0.5), 0 0 54px rgba(255, 255, 255, 0.3)',
                letterSpacing: '0.08em',
                lineHeight: '1.4',
                fontWeight: '700',
                fontSize: 'clamp(1rem, 3vw, 1.5rem)',
                marginTop: 'clamp(0.75rem, 2vh, 1rem)',
              }}
            >
              천하통일의 대업을 완성하라.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // kings 영상
  if (videoPhase === 'intro') {
    return (
      <div 
        className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black cursor-pointer transition-all duration-700 ease-in-out ${
          isKingsEnding ? 'opacity-0 translate-x-[100px]' : 'opacity-100 translate-x-0'
        }`}
        onClick={() => !isFadingIn && handleIntroEnd()}
      >
        {/* 상단 검은색 테두리 */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-black z-20" />
        
        <video 
          ref={introVideoRef} 
          src="/selection/kings.mp4" 
          playsInline 
          onEnded={handleIntroEnd}
          onError={(e) => {
            console.error('Video error:', e);
          }}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity pointer-events-none ${
            isFadingIn ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ transitionDuration: '2s' }}
        />
        
        {/* 하단 검은색 테두리 */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-black z-20" />
      </div>
    );
  }

  // selection 화면
  return (
    <>
      <audio ref={selectSoundRef} src="/selection/select.mp3" preload="auto" style={{ display: 'none' }} />

      <div
        className={`h-screen flex justify-center items-center transition-opacity duration-500 ${
          isExiting ? "opacity-0" : "opacity-100"
        }`}
        style={{
          backgroundImage: "url(/selection/temple.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/50" />

        <div 
          className="relative z-10 w-full"
          style={{
            maxWidth: 'min(90vw, 1200px)',
            margin: '0 auto',
            paddingLeft: 'clamp(1rem, 3vw, 1.5rem)',
            paddingRight: 'clamp(1rem, 3vw, 1.5rem)',
            paddingTop: 'clamp(2rem, 5vh, 4rem)',
            paddingBottom: 'clamp(1rem, 3vh, 2rem)',
          }}
        >
          {/* Title */}
          <div className="text-center mb-6 sm:mb-8">
            <h1 
              className="font-bold text-[#C9A227] font-serif"
              style={{
                fontSize: 'clamp(2rem, 5vw, 3rem)',
                lineHeight: '1.2',
              }}
            >
              국가를 선택하세요
            </h1>
            <p 
              className="text-[#A89F91] mt-2"
              style={{
                fontSize: 'clamp(0.875rem, 2vw, 1rem)',
              }}
            >
              삼국 중 하나를 선택하여 천하통일의 위업을 달성하세요
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 items-start">
            {countries.map((country) => {
              const isExpanded = selectedCountry === country.id;

              return (
                <button
                  key={country.id}
                  onClick={() => handleSelectCountry(country.id)}
                  className={`relative rounded-2xl text-left transition-all duration-500 backdrop-blur-xl border-2 shadow-2xl
                    ${
                      isExpanded
                        ? "shadow-2xl"
                        : "hover:scale-[1.02] shadow-xl"
                    }`}
                  style={isExpanded ? {
                    padding: 'clamp(1rem, 2vw, 1.5rem)',
                    backgroundColor: 'rgba(26, 26, 26, 0.15)',
                    borderColor: `${country.color}80`,
                    borderWidth: '2px',
                    boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.37), 0 0 20px ${country.color}40`,
                    minWidth: 'clamp(280px, 25vw, 350px)',
                  } : {
                    padding: 'clamp(0.75rem, 1.5vw, 1rem)',
                    backgroundColor: 'rgba(26, 26, 26, 0.1)',
                    borderColor: 'rgba(255, 255, 255, 0.18)',
                    borderWidth: '1px',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                    minWidth: 'clamp(280px, 25vw, 350px)',
                  }}
                >
                  {/* Glassmorphism overlay */}
                  <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: isExpanded 
                        ? `linear-gradient(135deg, ${country.color}15 0%, transparent 100%)`
                        : 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, transparent 100%)',
                    }}
                  />
                  {isExpanded && (
                    <div 
                      className="absolute top-4 right-4 rounded-full flex items-center justify-center z-10"
                      style={{ 
                        backgroundColor: country.color,
                        width: 'clamp(1.25rem, 2vw, 1.5rem)',
                        height: 'clamp(1.25rem, 2vw, 1.5rem)',
                        fontSize: 'clamp(0.75rem, 1.5vw, 1rem)',
                      }}
                    >
                      ✓
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-5xl">{country.icon}</span>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        {country.name}
                      </h2>
                      <p style={{ color: country.color }}>
                        {country.title}
                      </p>
                    </div>
                  </div>

                  {/* Expand */}
                  <div
                    className={`relative z-10 transition-all overflow-hidden duration-500 ${
                      isExpanded
                        ? "max-h-[1000px] opacity-100"
                        : "max-h-0 opacity-0"
                    }`}
                  >
                    <p className="text-[#A89F91] text-sm mb-2 leading-relaxed">
                      {country.description}
                    </p>

                    <span
                      className="inline-block rounded-full mb-2 px-3 py-1"
                      style={{
                        color: country.color,
                        border: `1px solid ${country.color}60`,
                        background: `${country.color}20`,
                        fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {country.feature}
                    </span>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 text-center mb-0">
                      <Stat 
                        label="재정" 
                        value={country.stats.finance} 
                        color="#FFD700"
                        change={country.lastFinanceChange}
                      />
                      <Stat 
                        label="인구" 
                        value={country.stats.population} 
                        color="#90EE90"
                        change={country.lastPopulationChange}
                      />
                      <Stat 
                        label="군사력" 
                        value={country.stats.military} 
                        color="#FF6B6B"
                        change={country.lastMilitaryChange}
                      />
                    </div>

                    {/* Character */}
                    <div 
                      className="-mx-6 -mt-20 overflow-hidden"
                      style={{
                        height: 'clamp(300px, 40vh, 450px)',
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                      <Character3D
                        key={`${country.id}-${isExpanded}`}
                        nation={country.id as "goguryeo" | "baekje" | "silla"}
                        animationType="appearance"
                        size="full"
                        shouldPlay={isExpanded}
                        x={country.id === "silla" ? -0.5 : 0}
                      />
                    </div>
                  </div>

                  {!isExpanded && (
                    <p 
                      className="relative z-10 text-center text-[#6B6B6B] mt-3"
                      style={{
                        fontSize: 'clamp(0.625rem, 1.2vw, 0.75rem)',
                      }}
                    >
                      클릭하여 상세 보기
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Confirm */}
          {selectedCountry && (() => {
            const selectedCountryData = countries.find(n => n.id === selectedCountry);
            return (
              <div className="text-center -mt-4">
                <button
                  onClick={handleConfirm}
                  className="px-12 py-4 rounded-xl text-lg font-bold transition-all duration-300 shadow-lg hover:shadow-xl hover:brightness-110"
                  style={selectedCountryData ? {
                    backgroundColor: selectedCountryData.color,
                    color: selectedCountryData.id === 'silla' ? '#0D0D0D' : '#FFFFFF',
                  } : {}}
                >
                  {selectedCountryData?.name}로 시작하기
                </button>
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
}

/* -------------------- Stat -------------------- */
function Stat({
  label,
  value,
  color,
  change,
}: {
  label: string;
  value: number;
  color: string;
  change?: number;
}) {
  const changeColor = change === undefined || change === 0 ? '#6B6B6B' : change > 0 ? '#90EE90' : '#FF6B6B';
  const changeSymbol = change === undefined || change === 0 ? '' : change > 0 ? '+' : '';
  
  return (
    <div 
      className="bg-black/30 rounded-lg"
      style={{
        padding: 'clamp(0.375rem, 0.75vw, 0.5rem)',
      }}
    >
      <p 
        className="font-bold" 
        style={{ 
          color,
          fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)',
        }}
      >
        {value.toLocaleString()}
      </p>
      <p 
        className="text-[#6B6B6B]"
        style={{
          fontSize: 'clamp(0.625rem, 1.2vw, 0.75rem)',
        }}
      >
        {label}
      </p>
      {change !== undefined && change !== 0 && (
        <p 
          style={{
            color: changeColor,
            fontSize: 'clamp(0.5rem, 1vw, 0.625rem)',
            marginTop: '0.25rem',
          }}
        >
          {changeSymbol}{change.toLocaleString()}
        </p>
      )}
    </div>
  );
}
