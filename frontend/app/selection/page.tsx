"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

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
  const [showVideo, setShowVideo] = useState(true);
  const [selectedNation, setSelectedNation] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 비디오 자동 재생
  useEffect(() => {
    if (showVideo && videoRef.current) {
      videoRef.current.play().catch(() => {
        setShowVideo(false);
      });
    }
  }, [showVideo]);

  const handleVideoEnd = () => {
    setShowVideo(false);
  };

  const handleSelectNation = (nationId: string) => {
    setSelectedNation(nationId);
  };

  const handleConfirm = () => {
    if (selectedNation) {
      setIsExiting(true);
      setTimeout(() => {
        router.push(`/home?nation=${selectedNation}`);
      }, 500);
    }
  };

  // 인트로 영상
  if (showVideo) {
    return (
      <div 
        className="h-screen w-screen flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: 'url(/selection/temple.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="absolute inset-0 bg-black/60"></div>
        
        <video
          ref={videoRef}
          src="/selection/intro.mp4"
          autoPlay
          muted
          playsInline
          onEnded={handleVideoEnd}
          className="relative z-10 max-w-6xl max-h-[85vh] w-auto h-auto rounded-xl shadow-2xl"
        />
      </div>
    );
  }

  return (
    <div 
      className={`h-screen bg-[#0D0D0D] flex items-center justify-center overflow-hidden transition-opacity duration-500 ${isExiting ? 'opacity-0' : 'opacity-100'}`}
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
          {nations.map((nation) => (
            <button
              key={nation.id}
              onClick={() => handleSelectNation(nation.id)}
              className={`
                relative rounded-2xl p-6 transition-all duration-300 text-left
                backdrop-blur-xl border-2 shadow-2xl
                ${selectedNation === nation.id 
                  ? 'border-[#C9A227] scale-105 bg-[#1a1a1a]/80' 
                  : 'border-white/10 hover:border-white/30 bg-[#1a1a1a]/50 hover:bg-[#1a1a1a]/70'
                }
              `}
            >
              {/* 선택 표시 */}
              {selectedNation === nation.id && (
                <div className="absolute top-4 right-4 w-6 h-6 bg-[#C9A227] rounded-full flex items-center justify-center">
                  <span className="text-black text-sm">✓</span>
                </div>
              )}

              {/* 아이콘 & 이름 */}
              <div className="flex items-center gap-4 mb-4">
                <span className="text-5xl">{nation.icon}</span>
                <div>
                  <h2 className="text-2xl font-bold text-white">{nation.name}</h2>
                  <p className="text-sm" style={{ color: nation.color }}>{nation.title}</p>
                </div>
              </div>

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
            </button>
          ))}
        </div>

        {/* 확인 버튼 */}
        <div className="text-center">
          <button
            onClick={handleConfirm}
            disabled={!selectedNation}
            className={`
              px-12 py-4 rounded-xl font-bold text-lg transition-all duration-300
              ${selectedNation
                ? 'bg-[#C9A227] hover:bg-[#D4AF37] text-[#0D0D0D] shadow-lg hover:shadow-xl'
                : 'bg-[#333] text-[#6B6B6B] cursor-not-allowed'
              }
            `}
          >
            {selectedNation 
              ? `${nations.find(n => n.id === selectedNation)?.name}로 시작하기` 
              : '국가를 선택해주세요'}
          </button>
        </div>
      </div>
    </div>
  );
}
