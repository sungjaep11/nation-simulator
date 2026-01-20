"use client";

import React, { Suspense, useMemo, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, useAnimations } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";

type NationType = "goguryeo" | "baekje" | "silla";
type AnimationType = "normal" | "appearance";
type MoodType = "happy" | "neutral" | "angry" | "depressed";

interface Character3DProps {
  nation: NationType;
  animationType?: AnimationType;
  mood?: MoodType;
  size?: "full" | "small";
  shouldPlay?: boolean;
  x?: number;
}

function Model({
  nation,
  animationType = "normal",
  mood = "neutral",
  scale = 1.25,
  y = -0.7,
  shouldPlay = true,
  x = 0,
}: {
  nation: NationType;
  animationType?: AnimationType;
  mood?: MoodType;
  scale?: number;
  y?: number;
  shouldPlay?: boolean;
  x?: number;
}) {
  const modelPath = useMemo(() => {
    // 분위기와 애니메이션 타입에 따른 모델 선택
    // animationType이 "appearance"면 그대로 사용, 아니면 mood에 따라 결정
    if (animationType === "appearance") {
      switch (nation) {
        case "goguryeo":
          return "/models/goguryeo/goguryeo_Animation_bow_appearnace.glb";
        case "baekje":
          return "/models/baekjae/baekjae_Animation_Dive_appearance.glb";
        case "silla":
          return "/models/shilla/Shilla_Animation_Hello.glb";
      }
    }
    
    // mood에 따라 모델 선택
    if (mood === "happy") {
      switch (nation) {
        case "goguryeo":
          return "/models/goguryeo/goguryeo_Animation_Happy.glb";
        case "baekje":
          return "/models/baekjae/baekjae_Animation_Happy.glb";
        case "silla":
          return "/models/shilla/Shilla_Animation_Happy.glb";
      }
    }
    
    if (mood === "angry") {
      switch (nation) {
        case "goguryeo":
          return "/models/goguryeo/goguryeo_Animation_angry.glb";
        case "baekje":
          return "/models/baekjae/baekjae_Animation_angry.glb";
        case "silla":
          return "/models/shilla/Shilla_Animation_angry.glb";
      }
    }
    
    if (mood === "depressed") {
      switch (nation) {
        case "goguryeo":
          return "/models/goguryeo/goguryeo_Animation_depressed.glb";
        case "baekje":
          return "/models/baekjae/baekjae_Animation_depressed.glb";
        case "silla":
          return "/models/shilla/Shilla_Animation_depressed.glb";
      }
    }
    
    // neutral 또는 기본값
    switch (nation) {
      case "goguryeo":
        return "/models/goguryeo/goguryeo_Animation_normal.glb";
      case "baekje":
        return "/models/baekjae/bakejae_Animation_normal.glb";
      case "silla":
        return "/models/shilla/Shilla_Animation_normal.glb";
    }
  }, [nation, animationType, mood]);

  const { scene, animations } = useGLTF(modelPath);
  const { actions } = useAnimations(animations, scene);

  // 애니메이션 재생 - 반복 재생
  const hasPlayedRef = useRef(false);
  useEffect(() => {
    if (!actions || Object.keys(actions).length === 0) return;
    if (!shouldPlay) {
      hasPlayedRef.current = false;
      return;
    }
    
    // 이미 재생 중이면 다시 재생하지 않음
    if (hasPlayedRef.current) return;
    
    const action = Object.values(actions)[0];
    if (!action) return;

    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity); // 반복 재생
    action.play();
    hasPlayedRef.current = true;

    return () => {
      action.stop();
      hasPlayedRef.current = false;
    };
  }, [actions, shouldPlay, modelPath]);

  return (
    <group position={[x, y, 0]}>
      <primitive object={scene} scale={scale} />
    </group>
  );
}

function Loading() {
  return (
    <mesh scale={1.25}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#C9A227" />
    </mesh>
  );
}

export default function Character3D({
  nation,
  animationType = "normal",
  mood = "neutral",
  size = "full",
  shouldPlay = true,
  x = 0,
}: Character3DProps) {
  const isSmall = size === "small";

  return (
    <div className={`w-full ${isSmall ? "h-[200px]" : "h-full"}`}>
      <Canvas
        camera={{
          position: [0, 1.25, isSmall ? 4.5 : 4.2], 
          fov: isSmall ? 60 : 45,                  
        }}
        gl={{ antialias: true }}
        resize={{ debounce: { resize: 0, scroll: 0 } }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <directionalLight position={[-5, 5, -5]} intensity={0.5} />

        <Suspense fallback={<Loading />}>
          <Model nation={nation} animationType={animationType} mood={mood} scale={1.25} y={-0.7} shouldPlay={shouldPlay} x={x} />
        </Suspense>

        {!isSmall && (
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 2.2}
            target={[0, 0.6, 0]} 
          />
        )}
      </Canvas>
    </div>
  );
}
