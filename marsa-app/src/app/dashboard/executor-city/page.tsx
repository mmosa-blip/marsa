"use client";

/**
 * Gamified "city" view for executors. Each project becomes a building drawn on
 * an HTML canvas; building height comes from total tasks, lit windows from
 * completed tasks. The scene wraps the buildings with an animated daytime
 * environment (sun, clouds, plane with contrail, forest, road, cars, swaying
 * trees, flowers).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Loader2, X, Building2 } from "lucide-react";

interface ApiProject {
  id: string;
  name: string;
  status: string;
  endDate: string | null;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  department?: { id: string; name: string; color: string | null } | null;
}

interface BuildingLayout extends ApiProject {
  // Layout in canvas space
  x: number;        // ground-level center x
  baseWidth: number;
  baseHeight: number; // total height in canvas px
  rows: number;     // window grid rows
  cols: number;     // window grid cols
  litCount: number; // number of windows lit
  color: string;    // building base color
  isComplete: boolean;
  isDelayed: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة",
  ACTIVE: "نشط",
  ON_HOLD: "معلق",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغي",
};

// Departments without explicit colors get one of these
const FALLBACK_COLORS = ["#5E5495", "#1B2A4A", "#0F766E", "#7C3AED", "#0891B2", "#B45309"];

function pickColor(id: string, fallbackIndex: number, override: string | null | undefined) {
  if (override) return override;
  // Stable pick based on id hash
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return FALLBACK_COLORS[Math.abs(h + fallbackIndex) % FALLBACK_COLORS.length];
}

export default function ExecutorCityPage() {
  const { data: session, status } = useSession();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [projects, setProjects] = useState<ApiProject[] | null>(null);
  const [selected, setSelected] = useState<ApiProject | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(Array.isArray(d) ? d : []))
      .catch(() => setProjects([]));
  }, []);

  // Compute building layouts whenever the project list changes.
  // Canvas is a fixed virtual width that scrolls horizontally if many buildings.
  const layout = useMemo(() => {
    if (!projects) return null;

    const SKY = 360;          // sky height
    const GROUND_OFFSET = 80; // grass + road + base
    const PADDING_X = 80;
    const SLOT = 140;         // horizontal slot per building (gap included)
    const totalWidth = Math.max(1100, PADDING_X * 2 + projects.length * SLOT);
    const totalHeight = SKY + GROUND_OFFSET + 320; // sky + ground + max building height room

    // Find biggest task count to scale heights uniformly
    const maxTasks = Math.max(1, ...projects.map((p) => p.totalTasks || 1));

    const buildings: BuildingLayout[] = projects.map((p, idx) => {
      const total = Math.max(1, p.totalTasks);
      // Aim for a roughly square grid: cols = ceil(sqrt(total)), rows = ceil(total / cols)
      const cols = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(total))));
      const rows = Math.max(2, Math.ceil(total / cols));
      // Building height proportional to rows (capped). 24px per row.
      const minHeight = 80;
      const heightFromRows = Math.min(280, minHeight + rows * 28);
      // Also nudge by total/maxTasks so the tallest project remains visually tallest
      const heightFromTotal = 80 + (total / maxTasks) * 200;
      const baseHeight = Math.round((heightFromRows + heightFromTotal) / 2);
      const baseWidth = 30 + cols * 18;

      const isComplete = p.totalTasks > 0 && p.completedTasks >= p.totalTasks;
      const now = Date.now();
      const isDelayed =
        !isComplete &&
        ((p.endDate && new Date(p.endDate).getTime() < now) || p.status === "ON_HOLD");

      return {
        ...p,
        x: PADDING_X + idx * SLOT + SLOT / 2,
        baseWidth,
        baseHeight,
        rows,
        cols,
        litCount: Math.min(rows * cols, p.completedTasks),
        color: pickColor(p.id, idx, p.department?.color),
        isComplete,
        isDelayed,
      };
    });

    return { width: totalWidth, height: totalHeight, sky: SKY, groundOffset: GROUND_OFFSET, buildings };
  }, [projects]);

  // ─── Animation loop ───
  useEffect(() => {
    if (!layout) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = layout.width * dpr;
    canvas.height = layout.height * dpr;
    canvas.style.width = `${layout.width}px`;
    canvas.style.height = `${layout.height}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    // Persistent animation state
    type Cloud = { x: number; y: number; scale: number; speed: number };
    type Car = { x: number; y: number; speed: number; color: string; dir: 1 | -1 };
    type Tree = { x: number; phase: number; scale: number };
    type Flower = { x: number; y: number; color: string };

    const clouds: Cloud[] = Array.from({ length: 5 }, (_, i) => ({
      x: (i / 5) * layout.width + Math.random() * 80,
      y: 40 + Math.random() * 90,
      scale: 0.7 + Math.random() * 0.6,
      speed: 0.12 + Math.random() * 0.1,
    }));

    const groundY = layout.sky;
    const roadY = groundY + 30;
    const roadHeight = 38;

    const cars: Car[] = Array.from({ length: 6 }, (_, i) => ({
      x: (i / 6) * layout.width + Math.random() * 100,
      y: roadY + (i % 2 === 0 ? 5 : roadHeight - 18),
      speed: 1.2 + Math.random() * 1.0,
      color: ["#DC2626", "#2563EB", "#059669", "#C9A84C", "#7C3AED", "#0891B2"][i % 6],
      dir: i % 2 === 0 ? 1 : -1,
    }));

    const trees: Tree[] = Array.from({ length: Math.ceil(layout.width / 90) }, (_, i) => ({
      x: 30 + i * 90 + Math.random() * 30,
      phase: Math.random() * Math.PI * 2,
      scale: 0.9 + Math.random() * 0.4,
    }));

    const flowers: Flower[] = Array.from({ length: Math.ceil(layout.width / 30) }, (_, i) => ({
      x: i * 30 + Math.random() * 20,
      y: roadY + roadHeight + 18 + Math.random() * 20,
      color: ["#EF4444", "#F59E0B", "#EC4899", "#FBBF24", "#A855F7"][i % 5],
    }));

    // Plane state
    let planeX = -120;
    let planeY = 70;
    const planeContrail: { x: number; y: number; age: number }[] = [];

    let raf = 0;
    let t0 = performance.now();

    function drawSky(_ctx: CanvasRenderingContext2D) {
      const grd = _ctx.createLinearGradient(0, 0, 0, layout!.sky);
      grd.addColorStop(0, "#7CC4F0");
      grd.addColorStop(0.6, "#B8E1F5");
      grd.addColorStop(1, "#E0F2FE");
      _ctx.fillStyle = grd;
      _ctx.fillRect(0, 0, layout!.width, layout!.sky);
    }

    function drawSun(_ctx: CanvasRenderingContext2D, time: number) {
      const cx = 120;
      const cy = 90;
      const pulse = 1 + Math.sin(time / 1500) * 0.04;
      // Rays
      _ctx.save();
      _ctx.translate(cx, cy);
      _ctx.rotate(time / 9000);
      _ctx.strokeStyle = "rgba(255,200,80,0.45)";
      _ctx.lineWidth = 3;
      for (let i = 0; i < 12; i++) {
        _ctx.rotate((Math.PI * 2) / 12);
        _ctx.beginPath();
        _ctx.moveTo(0, 50 * pulse);
        _ctx.lineTo(0, 70 * pulse);
        _ctx.stroke();
      }
      _ctx.restore();
      // Disk
      const grad = _ctx.createRadialGradient(cx, cy, 10, cx, cy, 50);
      grad.addColorStop(0, "#FFE680");
      grad.addColorStop(1, "#FFB347");
      _ctx.fillStyle = grad;
      _ctx.beginPath();
      _ctx.arc(cx, cy, 38 * pulse, 0, Math.PI * 2);
      _ctx.fill();
    }

    function drawCloud(_ctx: CanvasRenderingContext2D, c: Cloud) {
      _ctx.save();
      _ctx.translate(c.x, c.y);
      _ctx.scale(c.scale, c.scale);
      _ctx.fillStyle = "rgba(255,255,255,0.95)";
      _ctx.beginPath();
      _ctx.arc(0, 0, 22, 0, Math.PI * 2);
      _ctx.arc(22, -8, 18, 0, Math.PI * 2);
      _ctx.arc(40, 0, 22, 0, Math.PI * 2);
      _ctx.arc(20, 8, 22, 0, Math.PI * 2);
      _ctx.fill();
      _ctx.restore();
    }

    function drawForest(_ctx: CanvasRenderingContext2D) {
      // Distant rolling forest hills
      _ctx.fillStyle = "#5C8A4E";
      _ctx.beginPath();
      _ctx.moveTo(0, layout!.sky);
      for (let x = 0; x <= layout!.width; x += 40) {
        const y = layout!.sky - 20 - Math.sin(x / 60) * 12;
        _ctx.lineTo(x, y);
      }
      _ctx.lineTo(layout!.width, layout!.sky);
      _ctx.closePath();
      _ctx.fill();
      // Tree silhouettes on the hills
      _ctx.fillStyle = "#3E6B36";
      for (let x = 20; x < layout!.width; x += 30) {
        const baseY = layout!.sky - 22 - Math.sin(x / 60) * 12;
        _ctx.beginPath();
        _ctx.moveTo(x, baseY);
        _ctx.lineTo(x - 6, baseY - 16);
        _ctx.lineTo(x + 6, baseY - 16);
        _ctx.closePath();
        _ctx.fill();
      }
    }

    function drawGround(_ctx: CanvasRenderingContext2D, time: number) {
      // Grass with gentle wave on the top edge
      _ctx.fillStyle = "#7CB342";
      _ctx.beginPath();
      _ctx.moveTo(0, layout!.sky);
      for (let x = 0; x <= layout!.width; x += 8) {
        const y = layout!.sky + Math.sin((x + time / 30) / 25) * 1.5;
        _ctx.lineTo(x, y);
      }
      _ctx.lineTo(layout!.width, layout!.height);
      _ctx.lineTo(0, layout!.height);
      _ctx.closePath();
      _ctx.fill();
      // Darker grass band before road
      _ctx.fillStyle = "#689F38";
      _ctx.fillRect(0, layout!.sky + 18, layout!.width, 12);
    }

    function drawRoad(_ctx: CanvasRenderingContext2D) {
      _ctx.fillStyle = "#374151";
      _ctx.fillRect(0, roadY, layout!.width, roadHeight);
      // Lane separator
      _ctx.fillStyle = "#9CA3AF";
      _ctx.fillRect(0, roadY + roadHeight / 2 - 1, layout!.width, 2);
      // Dashed center line
      _ctx.fillStyle = "#FBBF24";
      for (let x = 0; x < layout!.width; x += 30) {
        _ctx.fillRect(x, roadY + roadHeight / 2 - 1, 16, 2);
      }
    }

    function drawCar(_ctx: CanvasRenderingContext2D, car: Car) {
      const w = 28;
      const h = 12;
      _ctx.save();
      _ctx.translate(car.x, car.y);
      if (car.dir === -1) _ctx.scale(-1, 1);
      // Body
      _ctx.fillStyle = car.color;
      _ctx.beginPath();
      _ctx.roundRect(0, 0, w, h, 3);
      _ctx.fill();
      // Roof
      _ctx.fillStyle = car.color;
      _ctx.beginPath();
      _ctx.roundRect(6, -6, w - 12, 7, 2);
      _ctx.fill();
      // Windows
      _ctx.fillStyle = "rgba(255,255,255,0.7)";
      _ctx.fillRect(8, -4, w - 16, 4);
      // Wheels
      _ctx.fillStyle = "#1F2937";
      _ctx.beginPath();
      _ctx.arc(6, h, 3, 0, Math.PI * 2);
      _ctx.arc(w - 6, h, 3, 0, Math.PI * 2);
      _ctx.fill();
      _ctx.restore();
    }

    function drawStreetTree(_ctx: CanvasRenderingContext2D, tree: Tree, time: number) {
      const sway = Math.sin(time / 800 + tree.phase) * 2;
      const x = tree.x;
      const baseY = roadY + roadHeight + 8;
      _ctx.save();
      _ctx.translate(x, baseY);
      _ctx.scale(tree.scale, tree.scale);
      // Trunk
      _ctx.fillStyle = "#7C5837";
      _ctx.fillRect(-2, -16, 4, 16);
      // Foliage with gentle sway
      _ctx.translate(sway, 0);
      _ctx.fillStyle = "#3E8E41";
      _ctx.beginPath();
      _ctx.arc(0, -22, 10, 0, Math.PI * 2);
      _ctx.fill();
      _ctx.beginPath();
      _ctx.arc(-6, -16, 8, 0, Math.PI * 2);
      _ctx.fill();
      _ctx.beginPath();
      _ctx.arc(6, -16, 8, 0, Math.PI * 2);
      _ctx.fill();
      _ctx.restore();
    }

    function drawFlower(_ctx: CanvasRenderingContext2D, f: Flower) {
      _ctx.save();
      _ctx.translate(f.x, f.y);
      // Stem
      _ctx.strokeStyle = "#3E8E41";
      _ctx.lineWidth = 1.5;
      _ctx.beginPath();
      _ctx.moveTo(0, 0);
      _ctx.lineTo(0, -6);
      _ctx.stroke();
      // Petals
      _ctx.fillStyle = f.color;
      for (let i = 0; i < 4; i++) {
        _ctx.beginPath();
        _ctx.arc(Math.cos((i * Math.PI) / 2) * 2.5, -6 + Math.sin((i * Math.PI) / 2) * 2.5, 2, 0, Math.PI * 2);
        _ctx.fill();
      }
      // Center
      _ctx.fillStyle = "#FBBF24";
      _ctx.beginPath();
      _ctx.arc(0, -6, 1.2, 0, Math.PI * 2);
      _ctx.fill();
      _ctx.restore();
    }

    function drawPlane(_ctx: CanvasRenderingContext2D) {
      // Contrail
      _ctx.save();
      planeContrail.forEach((p) => {
        _ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.6 - p.age / 60)})`;
        _ctx.beginPath();
        _ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        _ctx.fill();
      });
      _ctx.restore();
      // Plane body
      _ctx.save();
      _ctx.translate(planeX, planeY);
      _ctx.fillStyle = "#1C1B2E";
      _ctx.beginPath();
      _ctx.moveTo(0, 0);
      _ctx.lineTo(34, -3);
      _ctx.lineTo(38, 0);
      _ctx.lineTo(34, 3);
      _ctx.closePath();
      _ctx.fill();
      // Wings
      _ctx.fillStyle = "#5E5495";
      _ctx.beginPath();
      _ctx.moveTo(14, 0);
      _ctx.lineTo(20, -10);
      _ctx.lineTo(24, -10);
      _ctx.lineTo(22, 0);
      _ctx.closePath();
      _ctx.fill();
      _ctx.beginPath();
      _ctx.moveTo(14, 0);
      _ctx.lineTo(20, 10);
      _ctx.lineTo(24, 10);
      _ctx.lineTo(22, 0);
      _ctx.closePath();
      _ctx.fill();
      _ctx.restore();
    }

    function drawBuilding(_ctx: CanvasRenderingContext2D, b: BuildingLayout, time: number) {
      const baseX = b.x - b.baseWidth / 2;
      const baseY = roadY - 4;
      const topY = baseY - b.baseHeight;

      // Subtle shake for delayed buildings
      let shakeX = 0;
      if (b.isDelayed) {
        shakeX = Math.sin(time / 90 + b.x) * 0.8;
      }

      _ctx.save();
      _ctx.translate(shakeX, 0);

      // Body
      const baseColor = b.isDelayed ? "#B91C1C" : b.color;
      const bodyGrad = _ctx.createLinearGradient(baseX, topY, baseX + b.baseWidth, topY);
      bodyGrad.addColorStop(0, baseColor);
      bodyGrad.addColorStop(0.5, lighten(baseColor, 12));
      bodyGrad.addColorStop(1, darken(baseColor, 18));
      _ctx.fillStyle = bodyGrad;
      _ctx.fillRect(baseX, topY, b.baseWidth, b.baseHeight);

      // Roof slab
      _ctx.fillStyle = darken(baseColor, 25);
      _ctx.fillRect(baseX - 3, topY - 5, b.baseWidth + 6, 6);

      // Window grid
      const padTop = 14;
      const padBottom = 18;
      const padX = 6;
      const gridW = b.baseWidth - padX * 2;
      const gridH = b.baseHeight - padTop - padBottom;
      const cellW = gridW / b.cols;
      const cellH = gridH / b.rows;
      const winW = Math.max(4, cellW * 0.65);
      const winH = Math.max(5, cellH * 0.65);
      let drawn = 0;
      for (let r = 0; r < b.rows; r++) {
        for (let c = 0; c < b.cols; c++) {
          if (drawn >= b.rows * b.cols) break;
          const wx = baseX + padX + c * cellW + (cellW - winW) / 2;
          const wy = topY + padTop + r * cellH + (cellH - winH) / 2;
          const lit = drawn < b.litCount;
          if (lit) {
            // Glow
            _ctx.fillStyle = "rgba(255,235,150,0.35)";
            _ctx.fillRect(wx - 1, wy - 1, winW + 2, winH + 2);
            _ctx.fillStyle = "#FFE680";
          } else {
            _ctx.fillStyle = "rgba(0,0,0,0.45)";
          }
          _ctx.fillRect(wx, wy, winW, winH);
          drawn++;
        }
      }

      // Door
      const doorW = Math.min(14, b.baseWidth * 0.3);
      _ctx.fillStyle = darken(baseColor, 35);
      _ctx.fillRect(b.x - doorW / 2, baseY - 14, doorW, 14);

      // Cracks for delayed buildings
      if (b.isDelayed) {
        _ctx.strokeStyle = "rgba(0,0,0,0.55)";
        _ctx.lineWidth = 1.2;
        _ctx.beginPath();
        _ctx.moveTo(baseX + 8, topY + 30);
        _ctx.lineTo(baseX + 4, topY + 60);
        _ctx.lineTo(baseX + 12, topY + 80);
        _ctx.stroke();
        _ctx.beginPath();
        _ctx.moveTo(baseX + b.baseWidth - 10, topY + 50);
        _ctx.lineTo(baseX + b.baseWidth - 4, topY + 90);
        _ctx.stroke();
        // Warning triangle
        _ctx.fillStyle = "#F59E0B";
        _ctx.strokeStyle = "#000";
        _ctx.lineWidth = 1;
        _ctx.beginPath();
        _ctx.moveTo(b.x, topY - 22);
        _ctx.lineTo(b.x - 7, topY - 10);
        _ctx.lineTo(b.x + 7, topY - 10);
        _ctx.closePath();
        _ctx.fill();
        _ctx.stroke();
        _ctx.fillStyle = "#000";
        _ctx.font = "bold 9px sans-serif";
        _ctx.textAlign = "center";
        _ctx.fillText("!", b.x, topY - 12);
      }

      // Crane for unfinished
      if (!b.isComplete && !b.isDelayed) {
        const craneTop = topY - 30;
        const craneArmEnd = baseX + b.baseWidth + 18;
        _ctx.strokeStyle = "#FBBF24";
        _ctx.lineWidth = 2;
        // Mast
        _ctx.beginPath();
        _ctx.moveTo(baseX + b.baseWidth - 4, topY);
        _ctx.lineTo(baseX + b.baseWidth - 4, craneTop);
        _ctx.stroke();
        // Arm
        _ctx.beginPath();
        _ctx.moveTo(baseX + b.baseWidth - 4, craneTop);
        _ctx.lineTo(craneArmEnd, craneTop);
        _ctx.stroke();
        // Counterweight
        _ctx.fillStyle = "#374151";
        _ctx.fillRect(baseX + b.baseWidth - 12, craneTop - 4, 8, 6);
        // Swinging load
        const swing = Math.sin(time / 700 + b.x / 50) * 8;
        const loadX = craneArmEnd - 6 + swing;
        _ctx.strokeStyle = "#9CA3AF";
        _ctx.lineWidth = 1;
        _ctx.beginPath();
        _ctx.moveTo(craneArmEnd - 6, craneTop);
        _ctx.lineTo(loadX, craneTop + 18);
        _ctx.stroke();
        _ctx.fillStyle = "#92400E";
        _ctx.fillRect(loadX - 4, craneTop + 18, 8, 6);
      }

      // Golden star + spire for completed
      if (b.isComplete) {
        // Spire
        _ctx.fillStyle = "#C9A84C";
        _ctx.beginPath();
        _ctx.moveTo(b.x, topY - 24);
        _ctx.lineTo(b.x - 4, topY - 6);
        _ctx.lineTo(b.x + 4, topY - 6);
        _ctx.closePath();
        _ctx.fill();
        // Star
        drawStar(_ctx, b.x, topY - 30, 6, "#FBBF24");
      }

      // Hover ring
      if (hoveredId === b.id) {
        _ctx.strokeStyle = "rgba(255,255,255,0.95)";
        _ctx.lineWidth = 2.5;
        _ctx.strokeRect(baseX - 3, topY - 8, b.baseWidth + 6, b.baseHeight + 12);
      }

      _ctx.restore();
    }

    function drawStar(_ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
      _ctx.fillStyle = color;
      _ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const radius = i % 2 === 0 ? r : r / 2;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        if (i === 0) _ctx.moveTo(x, y);
        else _ctx.lineTo(x, y);
      }
      _ctx.closePath();
      _ctx.fill();
    }

    function lighten(hex: string, amount: number) {
      return shade(hex, amount);
    }
    function darken(hex: string, amount: number) {
      return shade(hex, -amount);
    }
    function shade(hex: string, amount: number) {
      const c = hex.replace("#", "");
      const r = Math.max(0, Math.min(255, parseInt(c.slice(0, 2), 16) + amount));
      const g = Math.max(0, Math.min(255, parseInt(c.slice(2, 4), 16) + amount));
      const b = Math.max(0, Math.min(255, parseInt(c.slice(4, 6), 16) + amount));
      return `rgb(${r},${g},${b})`;
    }

    function tick(now: number) {
      const time = now - t0;
      ctx.clearRect(0, 0, layout!.width, layout!.height);

      drawSky(ctx);
      drawSun(ctx, time);

      // Clouds
      for (const c of clouds) {
        c.x -= c.speed;
        if (c.x < -80) c.x = layout!.width + 80;
        drawCloud(ctx, c);
      }

      // Plane
      planeX += 0.6;
      if (planeX > layout!.width + 60) {
        planeX = -120;
        planeY = 60 + Math.random() * 50;
      }
      planeContrail.push({ x: planeX - 4, y: planeY + 1, age: 0 });
      for (const p of planeContrail) p.age++;
      while (planeContrail.length > 60) planeContrail.shift();
      drawPlane(ctx);

      // Forest behind buildings
      drawForest(ctx);

      // Ground + road
      drawGround(ctx, time);
      drawRoad(ctx);

      // Cars
      for (const car of cars) {
        car.x += car.speed * car.dir;
        if (car.dir === 1 && car.x > layout!.width + 30) car.x = -40;
        if (car.dir === -1 && car.x < -40) car.x = layout!.width + 30;
        drawCar(ctx, car);
      }

      // Buildings
      for (const b of layout!.buildings) drawBuilding(ctx, b, time);

      // Street trees + flowers in front of road
      for (const tree of trees) drawStreetTree(ctx, tree, time);
      for (const f of flowers) drawFlower(ctx, f);

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [layout, hoveredId]);

  // ─── Click + hover hit-testing ───
  function pointToBuilding(clientX: number, clientY: number): BuildingLayout | null {
    if (!layout) return null;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = ((clientX - rect.left) / rect.width) * layout.width;
    const y = ((clientY - rect.top) / rect.height) * layout.height;
    const roadY = layout.sky + 30;
    for (const b of layout.buildings) {
      const baseX = b.x - b.baseWidth / 2;
      const topY = roadY - 4 - b.baseHeight;
      if (x >= baseX - 4 && x <= baseX + b.baseWidth + 4 && y >= topY - 12 && y <= roadY) {
        return b;
      }
    }
    return null;
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const b = pointToBuilding(e.clientX, e.clientY);
    if (b) setSelected(b);
  }
  function handleMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const b = pointToBuilding(e.clientX, e.clientY);
    setHoveredId(b?.id || null);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = b ? "pointer" : "default";
    }
  }

  if (status === "loading") return null;
  if (!session) redirect("/auth/login");
  if (session.user.role !== "EXECUTOR") redirect("/dashboard");

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
          <Building2 size={24} style={{ color: "#C9A84C" }} />
          مدينتي
        </h1>
        <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
          كل مشروع مبنى — ارتفاعه عدد المهام، نوافذه المضيئة هي المهام المنجزة
        </p>
      </div>

      {/* Loading */}
      {!projects && (
        <div className="bg-white rounded-2xl p-12 flex justify-center" style={{ border: "1px solid #E2E0D8" }}>
          <Loader2 size={32} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      )}

      {/* Empty state */}
      {projects && projects.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center" style={{ border: "1px solid #E2E0D8" }}>
          <Building2 size={40} className="mx-auto mb-3" style={{ color: "#D1D5DB" }} />
          <p style={{ color: "#6B7280" }}>لا توجد مشاريع لعرضها بعد</p>
        </div>
      )}

      {/* Canvas + cards */}
      {layout && layout.buildings.length > 0 && (
        <>
          <div
            ref={containerRef}
            className="bg-white rounded-2xl overflow-x-auto"
            style={{ border: "1px solid #E2E0D8", boxShadow: "0 4px 18px rgba(0,0,0,0.06)" }}
          >
            <canvas
              ref={canvasRef}
              onClick={handleClick}
              onMouseMove={handleMove}
              onMouseLeave={() => setHoveredId(null)}
              style={{ display: "block" }}
            />
          </div>

          {/* Project cards beneath the city */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {layout.buildings.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelected(b)}
                className="text-right bg-white rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{ border: `1px solid ${b.isDelayed ? "rgba(220,38,38,0.4)" : "#E2E0D8"}` }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: "#1C1B2E" }} title={b.name}>
                      {b.name}
                    </p>
                    {b.department?.name && (
                      <p className="text-[10px] mt-0.5" style={{ color: b.color }}>
                        {b.department.name}
                      </p>
                    )}
                  </div>
                  {b.isComplete && <span className="text-xl">⭐</span>}
                  {b.isDelayed && <span className="text-xs">⚠️</span>}
                </div>
                <div className="flex items-center justify-between text-[11px] mb-1.5" style={{ color: "#6B7280" }}>
                  <span>{STATUS_LABELS[b.status] || b.status}</span>
                  <span className="font-bold" style={{ color: b.isDelayed ? "#DC2626" : "#1C1B2E" }}>
                    {b.completedTasks}/{b.totalTasks}
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#F0EEF5" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${b.progress}%`,
                      background: b.isComplete
                        ? "linear-gradient(90deg, #C9A84C, #FBBF24)"
                        : b.isDelayed
                          ? "#DC2626"
                          : "linear-gradient(90deg, #1B2A4A, #C9A84C)",
                    }}
                  />
                </div>
                <p className="text-[10px] mt-1 text-left font-semibold" style={{ color: "#9CA3AF" }}>
                  {b.progress}%
                </p>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Click popup */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
                <Building2 size={20} style={{ color: "#C9A84C" }} />
                {selected.name}
              </h2>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg" style={{ color: "#9CA3AF" }}>
                <X size={18} />
              </button>
            </div>
            {selected.department?.name && (
              <p className="text-xs mb-4" style={{ color: "#6B7280" }}>
                القسم: {selected.department.name}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(94,84,149,0.06)" }}>
                <p className="text-[10px] mb-1" style={{ color: "#6B7280" }}>الحالة</p>
                <p className="text-sm font-bold" style={{ color: "#5E5495" }}>
                  {STATUS_LABELS[selected.status] || selected.status}
                </p>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(201,168,76,0.06)" }}>
                <p className="text-[10px] mb-1" style={{ color: "#6B7280" }}>المهام</p>
                <p className="text-sm font-bold" style={{ color: "#C9A84C" }}>
                  {selected.completedTasks} / {selected.totalTasks}
                </p>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span style={{ color: "#6B7280" }}>نسبة الإنجاز</span>
                <span className="font-bold" style={{ color: "#1C1B2E" }}>{selected.progress}%</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: "#F0EEF5" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${selected.progress}%`,
                    background: "linear-gradient(90deg, #1B2A4A, #C9A84C)",
                  }}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <a
                href={`/dashboard/projects/${selected.id}`}
                className="text-xs font-semibold px-4 py-2 rounded-lg"
                style={{ backgroundColor: "#5E5495", color: "white" }}
              >
                فتح المشروع
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
