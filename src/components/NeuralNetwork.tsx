'use client';

import { useEffect, useRef } from 'react';

export type NeuralState = 'idle' | 'listening' | 'thinking' | 'speaking';

type Node = {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  active: number;
  layer: number;
};
type Connection = { from: Node; to: Node; weight: number };

const COLORS: Record<NeuralState, { primary: [number, number, number]; secondary: [number, number, number] }> = {
  idle: { primary: [138, 138, 147], secondary: [200, 200, 210] },
  listening: { primary: [56, 189, 248], secondary: [125, 211, 252] },
  thinking: { primary: [168, 85, 247], secondary: [216, 180, 254] },
  speaking: { primary: [245, 80, 54], secondary: [255, 180, 130] },
};

export default function NeuralNetwork({
  isActive = false,
  state,
  amplitude = 0,
}: {
  isActive?: boolean;
  state?: NeuralState;
  amplitude?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();
  const nodesRef = useRef<Node[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const stateRef = useRef<NeuralState>(state ?? (isActive ? 'thinking' : 'idle'));
  const amplitudeRef = useRef<number>(0);
  const smoothedAmpRef = useRef<number>(0);

  useEffect(() => {
    stateRef.current = state ?? (isActive ? 'thinking' : 'idle');
  }, [state, isActive]);

  useEffect(() => {
    amplitudeRef.current = amplitude;
  }, [amplitude]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const layers = [6, 10, 12, 10, 6, 4];
    const nodes: Node[] = [];
    const connections: Connection[] = [];

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    const layerSpacing = w / (layers.length + 1);

    layers.forEach((count, layerIdx) => {
      const nodeSpacing = h / (count + 1);
      for (let i = 0; i < count; i++) {
        const x = layerSpacing * (layerIdx + 1);
        const y = nodeSpacing * (i + 1);
        nodes.push({
          x,
          y,
          baseX: x,
          baseY: y,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          active: Math.random(),
          layer: layerIdx,
        });
      }
    });

    let nodeIdx = 0;
    for (let l = 0; l < layers.length - 1; l++) {
      const cur = nodes.slice(nodeIdx, nodeIdx + layers[l]);
      const nxt = nodes.slice(nodeIdx + layers[l], nodeIdx + layers[l] + layers[l + 1]);
      cur.forEach((from) => {
        nxt.forEach((to) => {
          if (Math.random() > 0.25) connections.push({ from, to, weight: Math.random() });
        });
      });
      nodeIdx += layers[l];
    }

    nodesRef.current = nodes;
    connectionsRef.current = connections;

    let time = 0;
    const animate = () => {
      time += 0.016;
      const st = stateRef.current;
      const colors = COLORS[st];

      smoothedAmpRef.current += (amplitudeRef.current - smoothedAmpRef.current) * 0.25;
      const amp = smoothedAmpRef.current;

      ctx.fillStyle =
        st === 'speaking' || st === 'thinking'
          ? 'rgba(10, 10, 10, 0.22)'
          : 'rgba(10, 10, 10, 0.12)';
      ctx.fillRect(0, 0, w, h);

      const wavePos =
        st === 'speaking'
          ? ((time * (1.2 + amp * 2)) % 1.4) - 0.2
          : st === 'thinking'
            ? ((time * 0.9) % 1.4) - 0.2
            : -1;

      connectionsRef.current.forEach((conn) => {
        const activity = (conn.from.active + conn.to.active) / 2;
        const layerNorm = conn.from.layer / (layers.length - 1);
        const waveBoost =
          wavePos >= 0 ? Math.max(0, 1 - Math.abs(layerNorm - wavePos) * 6) : 0;

        const baseAlpha = st === 'idle' ? 0.12 : 0.28;
        const alpha = activity * baseAlpha + waveBoost * (0.5 + amp * 0.5);

        const gradient = ctx.createLinearGradient(conn.from.x, conn.from.y, conn.to.x, conn.to.y);
        const [r, g, b] = colors.primary;
        gradient.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
        gradient.addColorStop(1, `rgba(${r},${g},${b},${alpha * 0.4})`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = conn.weight * (1 + waveBoost * 2 + amp * 1.5);
        ctx.beginPath();
        ctx.moveTo(conn.from.x, conn.from.y);
        ctx.lineTo(conn.to.x, conn.to.y);
        ctx.stroke();
      });

      nodesRef.current.forEach((node, i) => {
        node.x += node.vx;
        node.y += node.vy;
        if (Math.abs(node.x - node.baseX) > 12) node.vx *= -1;
        if (Math.abs(node.y - node.baseY) > 12) node.vy *= -1;

        const layerNorm = node.layer / (layers.length - 1);
        const waveBoost =
          wavePos >= 0 ? Math.max(0, 1 - Math.abs(layerNorm - wavePos) * 5) : 0;

        if (st === 'speaking') {
          const layerPhase = node.layer * 0.6;
          node.active =
            0.3 +
            Math.abs(Math.sin(time * 4 + i * 0.4 + layerPhase)) * 0.4 +
            amp * 0.6 +
            waveBoost * 0.4;
        } else if (st === 'thinking') {
          node.active = 0.35 + Math.abs(Math.sin(time * 3 + i * 0.5)) * 0.5 + waveBoost * 0.3;
        } else if (st === 'listening') {
          const inputBoost = node.layer === 0 ? 0.5 : 0.15;
          node.active = 0.25 + Math.abs(Math.sin(time * 2 + i * 0.3)) * inputBoost;
        } else {
          node.active += Math.random() * 0.08 - 0.04;
          node.active = Math.max(0.12, Math.min(0.45, node.active));
        }
        node.active = Math.min(1.4, node.active);

        const radius = 2.5 + node.active * 4;
        const [r, g, b] = colors.primary;
        const [sr, sg, sb] = colors.secondary;

        const halo = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 3);
        halo.addColorStop(0, `rgba(${r},${g},${b},${Math.min(1, node.active)})`);
        halo.addColorStop(0.5, `rgba(${r},${g},${b},${node.active * 0.4})`);
        halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle =
          st === 'idle'
            ? `rgba(${sr},${sg},${sb},${node.active * 0.6})`
            : `rgba(255,255,255,${Math.min(1, node.active)})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" style={{ background: 'transparent' }} />;
}
