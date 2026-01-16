"use client";

import { useState } from "react";

interface Territory {
  id: string;
  name: string;
  owner: "goguryeo" | "baekje" | "silla" | "neutral";
  path: string;
}

interface KoreaMapProps {
  territories: Territory[];
  onTerritoryClick?: (territory: Territory) => void;
}

const defaultTerritories: Territory[] = [
  // 북부 지역 (고구려 영토)
  {
    id: "pyeongan",
    name: "평안도",
    owner: "goguryeo",
    path: "M80,20 L140,15 L160,40 L150,80 L120,90 L80,70 Z",
  },
  {
    id: "hamgyeong",
    name: "함경도",
    owner: "goguryeo",
    path: "M160,40 L220,30 L240,60 L230,100 L190,110 L150,80 Z",
  },
  {
    id: "hwanghae",
    name: "황해도",
    owner: "goguryeo",
    path: "M80,70 L120,90 L130,130 L100,150 L60,130 L50,90 Z",
  },
  {
    id: "gangwon-north",
    name: "강원도(북)",
    owner: "goguryeo",
    path: "M150,80 L190,110 L200,150 L170,170 L130,130 L120,90 Z",
  },
  // 중부 지역 (신라/백제 경쟁 지역)
  {
    id: "gyeonggi",
    name: "경기도",
    owner: "silla",
    path: "M100,150 L130,130 L150,160 L140,200 L110,210 L90,180 Z",
  },
  {
    id: "gangwon-south",
    name: "강원도(남)",
    owner: "silla",
    path: "M150,160 L170,170 L200,150 L210,190 L190,230 L160,220 L140,200 Z",
  },
  {
    id: "chungcheong-north",
    name: "충청북도",
    owner: "baekje",
    path: "M110,210 L140,200 L160,220 L150,260 L120,270 L100,250 Z",
  },
  {
    id: "chungcheong-south",
    name: "충청남도",
    owner: "baekje",
    path: "M60,200 L90,180 L110,210 L100,250 L70,260 L50,230 Z",
  },
  // 남부 지역
  {
    id: "jeolla-north",
    name: "전라북도",
    owner: "baekje",
    path: "M50,230 L70,260 L80,300 L60,330 L30,310 L25,260 Z",
  },
  {
    id: "jeolla-south",
    name: "전라남도",
    owner: "baekje",
    path: "M30,310 L60,330 L70,370 L50,400 L20,380 L15,340 Z",
  },
  {
    id: "gyeongsang-north",
    name: "경상북도",
    owner: "silla",
    path: "M160,220 L190,230 L220,260 L210,310 L170,320 L140,290 L150,260 Z",
  },
  {
    id: "gyeongsang-south",
    name: "경상남도",
    owner: "silla",
    path: "M120,270 L150,260 L140,290 L170,320 L160,370 L120,380 L90,350 L80,300 Z",
  },
  // 제주
  {
    id: "jeju",
    name: "제주도",
    owner: "neutral",
    path: "M50,430 L90,425 L100,445 L85,465 L45,460 L35,445 Z",
  },
];

export default function KoreaMap({
  territories = defaultTerritories,
  onTerritoryClick,
}: KoreaMapProps) {
  const [hoveredTerritory, setHoveredTerritory] = useState<string | null>(null);

  const getOwnerClass = (owner: Territory["owner"]) => {
    switch (owner) {
      case "goguryeo":
        return "territory-goguryeo";
      case "baekje":
        return "territory-baekje";
      case "silla":
        return "territory-silla";
      default:
        return "territory-neutral";
    }
  };

  const getOwnerName = (owner: Territory["owner"]) => {
    switch (owner) {
      case "goguryeo":
        return "고구려";
      case "baekje":
        return "백제";
      case "silla":
        return "신라";
      default:
        return "중립";
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg
        viewBox="0 0 260 500"
        className="w-full h-full max-h-[400px]"
        style={{ filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))" }}
      >
        {/* 배경 */}
        <defs>
          <linearGradient id="mapBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1a1a1a" />
            <stop offset="100%" stopColor="#0d0d0d" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 영토들 */}
        {territories.map((territory) => (
          <g key={territory.id}>
            <path
              d={territory.path}
              className={`${getOwnerClass(territory.owner)} cursor-pointer`}
              strokeWidth="2"
              style={{
                filter:
                  hoveredTerritory === territory.id ? "url(#glow)" : "none",
                opacity: hoveredTerritory === territory.id ? 1 : 0.85,
              }}
              onMouseEnter={() => setHoveredTerritory(territory.id)}
              onMouseLeave={() => setHoveredTerritory(null)}
              onClick={() => onTerritoryClick?.(territory)}
            />
          </g>
        ))}

        {/* 범례 */}
        <g transform="translate(180, 400)">
          <rect
            x="0"
            y="0"
            width="70"
            height="90"
            fill="rgba(13, 13, 13, 0.8)"
            rx="4"
            stroke="rgba(201, 162, 39, 0.3)"
            strokeWidth="1"
          />
          <text x="35" y="18" fill="#F5F5DC" fontSize="10" textAnchor="middle" fontWeight="bold">
            영토 현황
          </text>
          
          <rect x="8" y="28" width="12" height="12" className="territory-goguryeo" strokeWidth="1" />
          <text x="25" y="38" fill="#F5F5DC" fontSize="9">고구려</text>
          
          <rect x="8" y="46" width="12" height="12" className="territory-baekje" strokeWidth="1" />
          <text x="25" y="56" fill="#F5F5DC" fontSize="9">백제</text>
          
          <rect x="8" y="64" width="12" height="12" className="territory-silla" strokeWidth="1" />
          <text x="25" y="74" fill="#F5F5DC" fontSize="9">신라</text>
        </g>
      </svg>

      {/* 호버 툴팁 */}
      {hoveredTerritory && (
        <div className="absolute top-4 left-4 bg-[#1a1a1a] border border-[#C9A227] rounded-lg px-3 py-2 text-sm animate-fade-in">
          <p className="font-bold text-[#F5F5DC]">
            {territories.find((t) => t.id === hoveredTerritory)?.name}
          </p>
          <p className="text-[#A89F91] text-xs">
            영유국:{" "}
            {getOwnerName(
              territories.find((t) => t.id === hoveredTerritory)?.owner ||
                "neutral"
            )}
          </p>
        </div>
      )}
    </div>
  );
}
