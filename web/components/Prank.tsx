'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Joke only: falling green "hacker" codes with "دورني", then 5 seconds of black.
 * Nothing on the device is touched — it is a full-screen animation, then it closes.
 */
export default function Prank({ onDone }: { onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'codes' | 'black'>('codes');

  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext('2d')!;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    const size = 18;
    const cols = Math.ceil(c.width / size);
    const drops = Array.from({ length: cols }, () => Math.random() * -50);
    const chars = '01アイウエオカキクケコابتثجحخدذرزسشصضطظعغفقكلمنهوي#$%&';
    let raf = 0;
    const draw = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#16FF5A';
      ctx.font = `${size}px monospace`;
      drops.forEach((y, i) => {
        ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * size, y * size);
        drops[i] = y * size > c.height && Math.random() > 0.97 ? 0 : y + 1;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    const toBlack = setTimeout(() => setPhase('black'), 3500);
    const done = setTimeout(onDone, 3500 + 5000);
    return () => { cancelAnimationFrame(raf); clearTimeout(toBlack); clearTimeout(done); };
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[100] bg-black" role="presentation">
      <canvas ref={canvas} className={`absolute inset-0 h-full w-full ${phase === 'black' ? 'hidden' : ''}`} />
      {phase === 'codes' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="animate-pulse font-mono text-6xl font-black text-[#16FF5A] [text-shadow:0_0_20px_#16FF5A]">دورني</p>
        </div>
      )}
    </div>
  );
}
