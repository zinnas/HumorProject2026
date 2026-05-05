"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
};

const DESKTOP_STAR_COUNT = 120;
const MOBILE_STAR_COUNT = 48;
const REPULSION_RADIUS = 110;
const RETURN_FORCE = 0.018;
const FRICTION = 0.9;

export default function StarField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const canvasElement: HTMLCanvasElement = canvas;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const prefersReducedMotion = mediaQuery.matches;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const starCount = prefersReducedMotion
      ? MOBILE_STAR_COUNT
      : isMobile
        ? MOBILE_STAR_COUNT
        : DESKTOP_STAR_COUNT;
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const canvasContext: CanvasRenderingContext2D = context;

    let animationFrameId = 0;
    let width = 0;
    let height = 0;
    let pointerX = -1000;
    let pointerY = -1000;
    const stars: Star[] = [];

    function resizeCanvas() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvasElement.width = width;
      canvasElement.height = height;
      canvasElement.style.width = `${width}px`;
      canvasElement.style.height = `${height}px`;

      stars.splice(0, stars.length);
      for (let index = 0; index < starCount; index += 1) {
        const originX = Math.random() * width;
        const originY = Math.random() * height;
        stars.push({
          x: originX,
          y: originY,
          originX,
          originY,
          vx: 0,
          vy: 0,
          size: Math.random() * 1.7 + 0.3,
          alpha: Math.random() * 0.45 + 0.08,
        });
      }
    }

    function draw() {
      canvasContext.clearRect(0, 0, width, height);

      for (const star of stars) {
        const dx = star.x - pointerX;
        const dy = star.y - pointerY;
        const distance = Math.hypot(dx, dy);

        if (!prefersReducedMotion && distance < REPULSION_RADIUS) {
          const force = (REPULSION_RADIUS - distance) / REPULSION_RADIUS;
          const angle = Math.atan2(dy, dx);
          star.vx += Math.cos(angle) * force * 0.9;
          star.vy += Math.sin(angle) * force * 0.9;
        }

        star.vx += (star.originX - star.x) * RETURN_FORCE;
        star.vy += (star.originY - star.y) * RETURN_FORCE;
        star.vx *= FRICTION;
        star.vy *= FRICTION;
        star.x += star.vx;
        star.y += star.vy;

        canvasContext.beginPath();
        canvasContext.fillStyle = `rgba(255, 125, 221, ${star.alpha})`;
        canvasContext.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        canvasContext.fill();
      }

      animationFrameId = window.requestAnimationFrame(draw);
    }

    function handlePointerMove(event: PointerEvent) {
      pointerX = event.clientX;
      pointerY = event.clientY;
    }

    function handlePointerLeave() {
      pointerX = -1000;
      pointerY = -1000;
    }

    resizeCanvas();
    draw();

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-10" />;
}
