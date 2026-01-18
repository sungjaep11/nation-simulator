"use client";

import React, { Suspense, useMemo, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, useAnimations } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";

type NationType = "goguryeo" | "baekje" | "silla";
type AnimationType = "normal" | "appearance";

interface Character3DProps {
  nation: NationType;
  animationType?: AnimationType;
  size?: "full" | "small";
  shouldPlay?: boolean;
  x?: number;
}

function Model({
  nation,
  animationType = "normal",
  scale = 1.25,
  y = -0.7,
  shouldPlay = true,
  x = 0,
}: {
  nation: NationType;
  animationType?: AnimationType;
  scale?: number;
  y?: number;
  shouldPlay?: boolean;
  x?: number;
}) {
  const modelPath = useMemo(() => {
    if (animationType === "appearance") {
      switch (nation) {
        case "goguryeo":
          return "/models/goguryeo/goguryeo_Animation_bow_appearnace.glb";
        case "baekje":
          return "/models/baekjae/baekjae_Animation_Dive_appearance.glb";
        case "silla":
          return "/models/shilla/Shilla_Animation_Hello.glb";
        default:
          return "/models/goguryeo/goguryeo_Animation_bow_appearnace.glb";
      }
    }

    switch (nation) {
      case "goguryeo":
        return "/models/goguryeo/goguryeo_Animation_normal.glb";
      case "baekje":
        return "/models/baekjae/bakejae_Animation_normal.glb";
      case "silla":
        return "/models/shilla/Shilla_Animation_normal.glb";
      default:
        return "/models/goguryeo/goguryeo_Animation_normal.glb";
    }
  }, [nation, animationType]);

  const { scene, animations } = useGLTF(modelPath);
  const { actions } = useAnimations(animations, scene);
  const hasPlayedRef = useRef(false);

  // 애니메이션 재생
  useEffect(() => {
    if (!actions || Object.keys(actions).length === 0) return;
    
    const action = Object.values(actions)[0];
    if (!action) return;

    if (shouldPlay && !hasPlayedRef.current) {
      action.reset();
      action.setLoop(THREE.LoopOnce, 1); // 한 번만 재생
      action.clampWhenFinished = true; // 끝에서 멈춤
      action.play();
      hasPlayedRef.current = true;
    } else if (!shouldPlay) {
      // shouldPlay가 false가 되면 플래그 리셋
      hasPlayedRef.current = false;
      action.stop();
    }
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
          <Model nation={nation} animationType={animationType} scale={1.25} y={-0.7} shouldPlay={shouldPlay} x={x} />
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
