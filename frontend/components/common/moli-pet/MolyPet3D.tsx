'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

type PetMotion = 'idle' | 'walk' | 'wave' | 'think' | 'happy';

interface MolyPet3DProps {
  motion?: PetMotion;
  className?: string;
}

function makeHeartGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.28);
  shape.bezierCurveTo(-0.08, -0.18, -0.42, 0.02, -0.42, 0.3);
  shape.bezierCurveTo(-0.42, 0.58, -0.08, 0.68, 0, 0.42);
  shape.bezierCurveTo(0.08, 0.68, 0.42, 0.58, 0.42, 0.3);
  shape.bezierCurveTo(0.42, 0.02, 0.08, -0.18, 0, -0.28);
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.045,
    bevelThickness: 0.045,
    curveSegments: 16,
  });
}

export default function MolyPet3D({ motion = 'idle', className = '' }: MolyPet3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const motionRef = useRef(motion);
  motionRef.current = motion;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0.18, 7.2);
    camera.lookAt(0, 0.12, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(220, 220, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.className = 'block h-full w-full';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xfffaff, 0x9d8ac7, 2.8));
    const key = new THREE.DirectionalLight(0xffffff, 5.2);
    key.position.set(-3.5, 5, 5.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xb9a2ff, 2.6);
    rim.position.set(4, 2, 1);
    scene.add(rim);

    const pet = new THREE.Group();
    scene.add(pet);

    const skin = new THREE.MeshPhysicalMaterial({
      color: 0xfffbf7,
      roughness: 0.48,
      metalness: 0,
      clearcoat: 0.24,
      clearcoatRoughness: 0.62,
    });
    const blob = new MarchingCubes(32, skin, true, false, 50000);
    blob.isolation = 78;
    blob.position.set(-1.5, -1.5, -1.5);
    blob.scale.set(2.42, 2.72, 1.92);
    pet.add(blob);

    const eyeMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x17131d,
      roughness: 0.16,
      clearcoat: 0.8,
    });
    const blushMaterial = new THREE.MeshBasicMaterial({
      color: 0xff91a8,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    });
    const mouthMaterial = new THREE.MeshPhysicalMaterial({ color: 0x3b1720, roughness: 0.42 });
    const heartMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xff7894,
      roughness: 0.3,
      clearcoat: 0.52,
    });

    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 20), eyeMaterial);
    const rightEye = leftEye.clone();
    leftEye.position.set(-0.28, 0.42, 0.93);
    rightEye.position.set(0.28, 0.42, 0.93);
    pet.add(leftEye, rightEye);

    const eyeShineGeometry = new THREE.SphereGeometry(0.025, 12, 10);
    const eyeShineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const leftShine = new THREE.Mesh(eyeShineGeometry, eyeShineMaterial);
    const rightShine = leftShine.clone();
    leftShine.position.set(-0.31, 0.46, 1.025);
    rightShine.position.set(0.25, 0.46, 1.025);
    pet.add(leftShine, rightShine);

    const leftBlush = new THREE.Mesh(new THREE.CircleGeometry(0.13, 28), blushMaterial);
    const rightBlush = leftBlush.clone();
    leftBlush.position.set(-0.52, 0.2, 0.96);
    rightBlush.position.set(0.52, 0.2, 0.96);
    pet.add(leftBlush, rightBlush);

    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 16), mouthMaterial);
    mouth.scale.set(1, 0.54, 0.28);
    mouth.position.set(0, 0.15, 1);
    pet.add(mouth);

    const heart = new THREE.Mesh(makeHeartGeometry(), heartMaterial);
    heart.scale.setScalar(0.37);
    heart.rotation.z = Math.PI;
    heart.position.set(0.3, -0.24, 0.96);
    pet.add(heart);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.16, 48),
      new THREE.MeshBasicMaterial({
        color: 0x6e58a6,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
    shadow.scale.set(1, 0.3, 1);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, -1.49, -0.1);
    scene.add(shadow);

    const clock = new THREE.Clock();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frameId = 0;

    const addPetSurface = (time: number) => {
      blob.reset();
      const current = motionRef.current;
      const wave = current === 'wave' ? Math.sin(time * 6.4) * 0.055 : 0;
      const gait = current === 'walk' ? Math.sin(time * 8) * 0.035 : 0;

      // Head and torso form one implicit, continuously fused surface.
      blob.addBall(0.5, 0.69, 0.51, 0.86, 12);
      blob.addBall(0.5, 0.53, 0.5, 0.98, 12);
      blob.addBall(0.5, 0.36, 0.5, 0.92, 12);

      // Left arm: a readable raised waving silhouette, smoothly fused at shoulder.
      blob.addBall(0.31, 0.58, 0.5, 0.48, 13);
      blob.addBall(0.21, 0.67 + wave, 0.5, 0.41, 13);
      blob.addBall(0.16, 0.78 + wave, 0.5, 0.37, 13);

      // Right arm folds naturally toward the chest and heart.
      blob.addBall(0.69, 0.55, 0.51, 0.46, 13);
      blob.addBall(0.72, 0.46, 0.55, 0.41, 13);
      blob.addBall(0.65, 0.42, 0.61, 0.36, 13);

      // Two subtle feet keep the character grounded without a blocky silhouette.
      blob.addBall(0.39 + gait, 0.19, 0.5, 0.36, 13);
      blob.addBall(0.61 - gait, 0.19, 0.5, 0.36, 13);
      blob.update();
    };

    const animate = () => {
      const time = clock.getElapsedTime();
      const current = motionRef.current;
      const activeTime = reduceMotion ? 0 : time;
      addPetSurface(activeTime);

      const bobSpeed = current === 'happy' ? 4.6 : current === 'walk' ? 7.2 : 2.1;
      const bobAmount = current === 'happy' ? 0.09 : current === 'walk' ? 0.07 : 0.025;
      pet.position.y = Math.sin(activeTime * bobSpeed) * bobAmount + 0.02;
      pet.rotation.z = current === 'wave'
        ? -0.07 + Math.sin(activeTime * 3.2) * 0.025
        : Math.sin(activeTime * 1.4) * 0.015;
      pet.rotation.y = Math.sin(activeTime * 0.7) * 0.045;

      const blink = Math.sin(activeTime * 0.72) > 0.975 ? 0.1 : 1;
      leftEye.scale.y = blink;
      rightEye.scale.y = blink;
      leftShine.visible = blink > 0.5;
      rightShine.visible = blink > 0.5;

      const thinking = current === 'think';
      mouth.scale.set(thinking ? 0.58 : 1, thinking ? 0.85 : 0.54, 0.28);
      mouth.position.x = thinking ? 0.08 : 0;
      heart.scale.setScalar(0.37 * (1 + Math.sin(activeTime * 4.2) * (current === 'happy' ? 0.08 : 0.025)));
      shadow.material.opacity = 0.16 - pet.position.y * 0.18;

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      pet.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      shadow.geometry.dispose();
      (shadow.material as THREE.Material).dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`relative aspect-square ${className}`}
      role="img"
      aria-label="Moly, trợ lý học tập 3D"
    />
  );
}
