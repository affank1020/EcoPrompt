"use client";

import { useEffect, useRef } from "react";
import "../../styles/Waves.scss";

// One Gerstner wave component: sharp crests, flat troughs, like real swell
type Swell = {
    wavelength: number; // px
    amplitude: number; // px
    speed: number; // radians per second
    phase: number;
};

type Layer = {
    baseline: number; // fraction of canvas height where the water surface rests
    swells: Swell[];
    top: string; // gradient colour at the surface
    bottom: string; // gradient colour at the bottom of the canvas
    foam: number; // opacity of the crest highlight, 0 for none
};

// Back to front: distant layers are lighter, calmer and hazier
const LAYERS: Layer[] = [
    {
        baseline: 0.18,
        swells: [
            { wavelength: 620, amplitude: 9, speed: 0.35, phase: 0 },
            { wavelength: 270, amplitude: 4, speed: -0.6, phase: 1.3 },
        ],
        top: "rgba(170, 215, 240, 0.35)",
        bottom: "rgba(120, 180, 220, 0.25)",
        foam: 0,
    },
    {
        baseline: 0.34,
        swells: [
            { wavelength: 540, amplitude: 13, speed: 0.5, phase: 2.1 },
            { wavelength: 230, amplitude: 5, speed: 0.9, phase: 0.4 },
            { wavelength: 110, amplitude: 2, speed: -1.4, phase: 3.0 },
        ],
        top: "rgba(110, 185, 225, 0.45)",
        bottom: "rgba(60, 140, 200, 0.4)",
        foam: 0.25,
    },
    {
        baseline: 0.52,
        swells: [
            { wavelength: 720, amplitude: 17, speed: 0.45, phase: 4.0 },
            { wavelength: 310, amplitude: 7, speed: -0.75, phase: 1.0 },
            { wavelength: 140, amplitude: 3, speed: 1.6, phase: 2.2 },
        ],
        top: "rgba(60, 150, 210, 0.6)",
        bottom: "rgba(25, 100, 170, 0.6)",
        foam: 0.4,
    },
    {
        baseline: 0.7,
        swells: [
            { wavelength: 880, amplitude: 22, speed: 0.4, phase: 0.7 },
            { wavelength: 360, amplitude: 9, speed: 0.85, phase: 3.4 },
            { wavelength: 160, amplitude: 3, speed: -1.8, phase: 5.1 },
        ],
        top: "rgba(30, 115, 185, 0.85)",
        bottom: "rgba(10, 60, 120, 0.95)",
        foam: 0.55,
    },
];

const STEP = 4; // px between sampled points
const STEEPNESS = 0.7; // 0 = plain sine, 1 = sharpest crest before the surface folds

function surface(layer: Layer, p: number, t: number, height: number) {
    let x = p;
    let y = layer.baseline * height;
    for (const s of layer.swells) {
        const k = (2 * Math.PI) / s.wavelength;
        const theta = k * p - s.speed * t + s.phase;
        // Spread steepness across components so the surface never folds over
        const q = STEEPNESS / (k * s.amplitude * layer.swells.length);
        x -= q * s.amplitude * Math.sin(theta);
        y -= s.amplitude * Math.cos(theta);
    }
    return [x, y] as const;
}

function draw(ctx: CanvasRenderingContext2D, width: number, height: number, t: number) {
    ctx.clearRect(0, 0, width, height);

    for (const layer of LAYERS) {
        const points: [number, number][] = [];
        for (let p = -STEP * 20; p <= width + STEP * 20; p += STEP) {
            points.push(surface(layer, p, t, height) as [number, number]);
        }

        const gradient = ctx.createLinearGradient(0, layer.baseline * height - 30, 0, height);
        gradient.addColorStop(0, layer.top);
        gradient.addColorStop(1, layer.bottom);

        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (const [x, y] of points) ctx.lineTo(x, y);
        ctx.lineTo(points[points.length - 1][0], height);
        ctx.lineTo(points[0][0], height);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        if (layer.foam > 0) {
            ctx.beginPath();
            ctx.moveTo(points[0][0], points[0][1]);
            for (const [x, y] of points) ctx.lineTo(x, y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${layer.foam})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }
}

export default function Waves() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let width = 0;
        let height = 0;
        let frame = 0;
        const start = performance.now();

        const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            width = canvas.clientWidth;
            height = canvas.clientHeight;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            if (reduceMotion) draw(ctx, width, height, 0);
        };

        const observer = new ResizeObserver(resize);
        observer.observe(canvas);
        resize();

        const tick = (now: number) => {
            draw(ctx, width, height, (now - start) / 1000);
            frame = requestAnimationFrame(tick);
        };
        if (!reduceMotion) frame = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
        };
    }, []);

    return (
        <div className="waves" aria-hidden="true">
            <canvas ref={canvasRef} className="waves__canvas" />
        </div>
    )
}
