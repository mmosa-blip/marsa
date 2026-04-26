"use client";

/**
 * CityCanvas — shared gamified city canvas for /dashboard/executor-city and
 * /dashboard/all-cities.
 *
 * Owns: canvas + animation loop, fullscreen toggle, drag-to-scroll, click
 * hit-testing, and the building-detail popup.
 *
 * Each project is a building. Floors come from services; windows-per-floor
 * come from each service's tasks (lit = done, dark = remaining).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Building2 } from "lucide-react";

export interface CityApiService {
  id: string;
  name: string;
  status: string | null;
  tasks: { id: string; status: string }[];
}

export interface CityApiProject {
  id: string;
  name: string;
  projectCode: string | null;
  status: string;
  endDate: string | null;
  contractEndDate?: string | null;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  department?: { id: string; name: string; color: string | null } | null;
  services?: CityApiService[];
  tasks?: { id: string; status: string; dueDate: string | null }[];
  // Distinct executors (admin all-cities mode only).
  executors?: { id: string; name: string }[];
}

interface FloorLayout {
  serviceId: string;
  serviceName: string;
  totalTasks: number;
  doneTasks: number;
  isComplete: boolean;
  isCurrent: boolean;
}

export interface BuildingLayout extends CityApiProject {
  x: number;
  baseWidth: number;
  baseHeight: number;
  cols: number;
  floors: FloorLayout[];
  visibleFloors: FloorLayout[];
  color: string;
  isComplete: boolean;
  isDelayed: boolean;
  executorLabel: string;
}

// Uniform window/grid constants.
const WIN_W = 9;
const WIN_H = 11;
const WIN_GAP_X = 4;
const WIN_GAP_Y = 4;
const FLOOR_PAD_X = 5;
const FLOOR_PAD_Y = 3;
const MAX_COLS = 6;
const ROW_H = WIN_H + WIN_GAP_Y;
const COL_W = WIN_W + WIN_GAP_X;

function rowsForFloor(taskCount: number) {
  return Math.max(1, Math.ceil(Math.max(1, taskCount) / MAX_COLS));
}
function floorBandHeight(taskCount: number) {
  return rowsForFloor(taskCount) * ROW_H + FLOOR_PAD_Y * 2;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة",
  ACTIVE: "نشط",
  ON_HOLD: "معلق",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغي",
};

const ACTIVE_COLOR = "#8B8D93";
// 12-color harmonious palette for COMPLETED buildings. Order is meaningful:
// `pickCompletedColor` hashes the project.id and indexes into this array,
// so the same project always lands on the same color across renders/sessions.
const COMPLETED_COLORS = [
  "#D4AF37", // ذهبي
  "#B8B8B8", // فضي
  "#CD7F32", // برونزي
  "#06B6D4", // أزرق فيروزي
  "#EC4899", // وردي
  "#8B5CF6", // بنفسجي
  "#10B981", // أخضر زمردي
  "#4F46E5", // نيلي
  "#FF6B6B", // أحمر مرجاني
  "#F59E0B", // برتقالي ذهبي
  "#2563EB", // أزرق ملكي
  "#E8DCC4", // عاجي
];

// Deterministic color picker: same project.id → same color forever.
// djb2-style hash keeps the math cheap and stable across V8/JSC.
function pickCompletedColor(projectId: string): string {
  let h = 5381;
  for (let i = 0; i < projectId.length; i++) {
    h = ((h << 5) + h + projectId.charCodeAt(i)) | 0;
  }
  return COMPLETED_COLORS[Math.abs(h) % COMPLETED_COLORS.length];
}

function shade(hex: string, amount: number) {
  if (hex.startsWith("rgb")) return hex;
  const c = hex.replace("#", "");
  const r = Math.max(0, Math.min(255, parseInt(c.slice(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(c.slice(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(c.slice(4, 6), 16) + amount));
  return `rgb(${r},${g},${b})`;
}

export interface CityCanvasProps {
  projects: CityApiProject[];
  viewMode: "executor" | "admin";
  // Optional override — if provided, replaces the default popup behavior.
  onBuildingClick?: (b: BuildingLayout) => void;
}

export default function CityCanvas({ projects, viewMode, onBuildingClick }: CityCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selected, setSelected] = useState<BuildingLayout | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<{ w: number; h: number }>({
    w: typeof window !== "undefined" ? window.innerWidth : 1280,
    h: typeof window !== "undefined" ? window.innerHeight : 720,
  });
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({ moved: 0 });
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    function onResize() {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.round(entry.contentRect.width);
        if (w > 0) setContainerWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fullscreen, viewport.w]);

  const layout = useMemo(() => {
    if (!projects) return null;

    let containerH: number;
    if (fullscreen) {
      containerH = viewport.h;
    } else {
      containerH = Math.max(180, Math.min(400, Math.floor(viewport.h * 0.35)));
    }
    const canvasHeight = containerH;
    const sky = Math.round(canvasHeight * 0.55);
    const padX = 50;
    const slot = viewport.w < 640 ? 110 : viewport.w < 1024 ? 130 : 150;

    const buildings: BuildingLayout[] = projects.map((p, idx) => {
      const services = p.services || [];
      const allFloors: FloorLayout[] = services.map((s) => {
        const total = s.tasks?.length || 0;
        const done = s.tasks?.filter((t) => t.status === "DONE").length || 0;
        return {
          serviceId: s.id,
          serviceName: s.name,
          totalTasks: total,
          doneTasks: done,
          isComplete: total > 0 && done >= total,
          isCurrent: false,
        };
      });

      const visibleFloors: FloorLayout[] = [];
      for (let i = 0; i < allFloors.length; i++) {
        if (i === 0 || allFloors[i - 1].isComplete) {
          visibleFloors.push({ ...allFloors[i], isCurrent: !allFloors[i].isComplete });
        } else {
          break;
        }
      }
      if (visibleFloors.length === 0) {
        visibleFloors.push({
          serviceId: "stub",
          serviceName: "—",
          totalTasks: 1,
          doneTasks: 0,
          isComplete: false,
          isCurrent: true,
        });
      }

      const cols = Math.max(
        1,
        ...visibleFloors.map((f) => Math.min(MAX_COLS, Math.max(1, f.totalTasks || 1)))
      );
      const baseWidth = cols * COL_W + FLOOR_PAD_X * 2;

      const floorsHeight = visibleFloors.reduce((s, f) => s + floorBandHeight(f.totalTasks), 0);
      const DOOR_H = 14;
      const baseHeight = floorsHeight + DOOR_H + 4;

      const isComplete = allFloors.length > 0 && allFloors.every((f) => f.isComplete);
      const now = Date.now();

      const lateTasks = (p.tasks || []).filter(
        (t) =>
          t.dueDate &&
          new Date(t.dueDate).getTime() < now &&
          t.status !== "DONE" &&
          t.status !== "CANCELLED"
      ).length;

      const isDelayed =
        !isComplete &&
        (lateTasks > 0 ||
          (p.endDate && new Date(p.endDate).getTime() < now) ||
          (p.contractEndDate && new Date(p.contractEndDate).getTime() < now) ||
          p.status === "ON_HOLD");

      const execList = p.executors || [];
      let executorLabel = "";
      if (viewMode === "admin") {
        if (execList.length === 1) {
          executorLabel = execList[0].name;
        } else if (execList.length > 1) {
          executorLabel = `${execList[0].name} +${execList.length - 1}`;
        }
      }

      return {
        ...p,
        x: padX + idx * slot + slot / 2,
        baseWidth,
        baseHeight,
        cols,
        floors: allFloors,
        visibleFloors,
        color: isComplete
          ? pickCompletedColor(p.id)
          : isDelayed
            ? "#B91C1C"
            : ACTIVE_COLOR,
        isComplete,
        isDelayed: !!isDelayed,
        executorLabel,
      };
    });

    const naturalWidth = padX * 2 + projects.length * slot;
    const visibleW = containerWidth > 0 ? containerWidth : viewport.w;
    const canvasWidth = Math.max(visibleW, 1400, naturalWidth);

    return { canvasWidth, canvasHeight, sky, buildings };
  }, [projects, viewport, fullscreen, containerWidth, viewMode]);

  // ─── Animation loop ───
  useEffect(() => {
    if (!layout) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = layout.canvasWidth * dpr;
    canvas.height = layout.canvasHeight * dpr;
    canvas.style.width = `${layout.canvasWidth}px`;
    canvas.style.height = `${layout.canvasHeight}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    type Cloud = { x: number; y: number; scale: number; speed: number };
    type Car = { x: number; y: number; speed: number; color: string; dir: 1 | -1 };
    type Tree = { x: number; phase: number; scale: number };
    type Flower = { x: number; y: number; color: string };

    const VW = layout.canvasWidth;
    const VH = layout.canvasHeight;
    const WORLD_W = layout.canvasWidth;
    const groundY = layout.sky;
    const roadY = groundY + 30;
    const roadHeight = 38;

    const clouds: Cloud[] = Array.from({ length: Math.max(5, Math.ceil(WORLD_W / 250)) }, (_, i) => ({
      x: (i / 5) * WORLD_W + Math.random() * 80,
      y: 40 + Math.random() * 90,
      scale: 0.7 + Math.random() * 0.6,
      speed: 0.12 + Math.random() * 0.1,
    }));

    const cars: Car[] = Array.from({ length: Math.max(6, Math.ceil(WORLD_W / 200)) }, (_, i) => ({
      x: (i / 6) * WORLD_W + Math.random() * 100,
      y: roadY + (i % 2 === 0 ? 5 : roadHeight - 18),
      speed: 1.2 + Math.random() * 1.0,
      color: ["#DC2626", "#2563EB", "#059669", "#C9A84C", "#7C3AED", "#0891B2"][i % 6],
      dir: i % 2 === 0 ? 1 : -1,
    }));

    const trees: Tree[] = Array.from({ length: Math.ceil(WORLD_W / 90) }, (_, i) => ({
      x: 30 + i * 90 + Math.random() * 30,
      phase: Math.random() * Math.PI * 2,
      scale: 0.9 + Math.random() * 0.4,
    }));

    const flowers: Flower[] = Array.from({ length: Math.ceil(WORLD_W / 30) }, (_, i) => ({
      x: i * 30 + Math.random() * 20,
      y: roadY + roadHeight + 18 + Math.random() * 20,
      color: ["#EF4444", "#F59E0B", "#EC4899", "#FBBF24", "#A855F7"][i % 5],
    }));

    let raf = 0;
    const t0 = performance.now();

    function drawSky() {
      const grd = ctx.createLinearGradient(0, 0, 0, layout!.sky);
      grd.addColorStop(0, "#7CC4F0");
      grd.addColorStop(0.6, "#B8E1F5");
      grd.addColorStop(1, "#E0F2FE");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, VW, layout!.sky);
    }

    function drawSun(time: number) {
      const cx = 120;
      const cy = 90;
      const pulse = 1 + Math.sin(time / 1500) * 0.04;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(time / 9000);
      ctx.strokeStyle = "rgba(255,200,80,0.45)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 12; i++) {
        ctx.rotate((Math.PI * 2) / 12);
        ctx.beginPath();
        ctx.moveTo(0, 50 * pulse);
        ctx.lineTo(0, 70 * pulse);
        ctx.stroke();
      }
      ctx.restore();
      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 50);
      grad.addColorStop(0, "#FFE680");
      grad.addColorStop(1, "#FFB347");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 38 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawCloud(c: Cloud) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.scale, c.scale);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.arc(22, -8, 18, 0, Math.PI * 2);
      ctx.arc(40, 0, 22, 0, Math.PI * 2);
      ctx.arc(20, 8, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawForest() {
      ctx.fillStyle = "#5C8A4E";
      ctx.beginPath();
      ctx.moveTo(0, layout!.sky);
      for (let x = 0; x <= WORLD_W; x += 40) {
        const y = layout!.sky - 16 - Math.sin(x / 60) * 10;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(WORLD_W, layout!.sky);
      ctx.closePath();
      ctx.fill();

      const treePalette = ["#2E7D32", "#388E3C", "#43A047", "#4CAF50", "#1B5E20"];
      for (let x = 15; x < WORLD_W; x += 28 + Math.sin(x) * 8) {
        const baseY = layout!.sky - 14 - Math.sin(x / 60) * 10;
        const h = 20 + Math.abs(Math.sin(x * 0.7)) * 18;
        const w = 10 + Math.abs(Math.cos(x * 0.3)) * 8;
        const color = treePalette[Math.floor(Math.abs(Math.sin(x * 1.3)) * treePalette.length)];

        ctx.fillStyle = "#5D4037";
        ctx.fillRect(x - 1.5, baseY - h * 0.3, 3, h * 0.3);

        for (let layer = 0; layer < 3; layer++) {
          const ly = baseY - h * 0.3 - layer * (h * 0.22);
          const lw = w * (1 - layer * 0.25);
          ctx.fillStyle = shade(color, -layer * 15);
          ctx.beginPath();
          ctx.moveTo(x, ly - h * 0.28);
          ctx.lineTo(x - lw, ly);
          ctx.lineTo(x + lw, ly);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    function drawGround(time: number) {
      ctx.fillStyle = "#7CB342";
      ctx.beginPath();
      ctx.moveTo(0, layout!.sky);
      for (let x = 0; x <= WORLD_W; x += 8) {
        const y = layout!.sky + Math.sin((x + time / 30) / 25) * 1.5;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(WORLD_W, VH);
      ctx.lineTo(0, VH);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#689F38";
      ctx.fillRect(0, layout!.sky + 18, WORLD_W, 12);
    }

    function drawRoad() {
      ctx.fillStyle = "#374151";
      ctx.fillRect(0, roadY, WORLD_W, roadHeight);
      ctx.fillStyle = "#9CA3AF";
      ctx.fillRect(0, roadY + roadHeight / 2 - 1, WORLD_W, 2);
      ctx.fillStyle = "#FBBF24";
      for (let x = 0; x < WORLD_W; x += 30) {
        ctx.fillRect(x, roadY + roadHeight / 2 - 1, 16, 2);
      }
    }

    function drawCar(car: Car) {
      const w = 28;
      const h = 12;
      ctx.save();
      ctx.translate(car.x, car.y);
      if (car.dir === -1) ctx.scale(-1, 1);
      ctx.fillStyle = car.color;
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, 3);
      ctx.fill();
      ctx.fillStyle = car.color;
      ctx.beginPath();
      ctx.roundRect(6, -6, w - 12, 7, 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(8, -4, w - 16, 4);
      ctx.fillStyle = "#1F2937";
      ctx.beginPath();
      ctx.arc(6, h, 3, 0, Math.PI * 2);
      ctx.arc(w - 6, h, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawStreetTree(tree: Tree, time: number) {
      const sway = Math.sin(time / 800 + tree.phase) * 2;
      const x = tree.x;
      const baseY = roadY + roadHeight + 8;
      ctx.save();
      ctx.translate(x, baseY);
      ctx.scale(tree.scale, tree.scale);
      ctx.fillStyle = "#7C5837";
      ctx.fillRect(-2, -16, 4, 16);
      ctx.translate(sway, 0);
      ctx.fillStyle = "#3E8E41";
      ctx.beginPath();
      ctx.arc(0, -22, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-6, -16, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(6, -16, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawFlower(f: Flower) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.strokeStyle = "#3E8E41";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -6);
      ctx.stroke();
      ctx.fillStyle = f.color;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(Math.cos((i * Math.PI) / 2) * 2.5, -6 + Math.sin((i * Math.PI) / 2) * 2.5, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#FBBF24";
      ctx.beginPath();
      ctx.arc(0, -6, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawBuilding(b: BuildingLayout, time: number) {
      const baseX = b.x - b.baseWidth / 2;
      const baseY = roadY - 4;
      const topY = baseY - b.baseHeight;

      let shakeX = 0;
      if (b.isDelayed) {
        shakeX = Math.sin(time / 60 + b.x) * 1.5;
      }

      ctx.save();
      ctx.translate(shakeX, 0);

      const baseColor = b.isDelayed ? "#B91C1C" : b.color;
      const bodyGrad = ctx.createLinearGradient(baseX, topY, baseX + b.baseWidth, topY);
      bodyGrad.addColorStop(0, baseColor);
      bodyGrad.addColorStop(0.5, shade(baseColor, 12));
      bodyGrad.addColorStop(1, shade(baseColor, -18));
      ctx.fillStyle = bodyGrad;
      ctx.fillRect(baseX, topY, b.baseWidth, b.baseHeight);

      ctx.fillStyle = shade(baseColor, -25);
      ctx.fillRect(baseX - 3, topY - 5, b.baseWidth + 6, 6);

      const visible = b.visibleFloors;
      const DOOR_H = 14;
      let cursorY = baseY - DOOR_H;
      for (let fi = 0; fi < visible.length; fi++) {
        const floor = visible[fi];
        const bandH = floorBandHeight(floor.totalTasks);
        const fyBottom = cursorY;
        const fyTop = cursorY - bandH;

        ctx.fillStyle = b.isComplete ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.3)";
        ctx.fillRect(baseX + 1, fyBottom - 1, b.baseWidth - 2, b.isComplete ? 1 : 2);

        if (floor.isCurrent) {
          ctx.fillStyle = "rgba(0,0,0,0.18)";
          ctx.fillRect(baseX + 1, fyTop, b.baseWidth - 2, bandH);
        }

        const cols = Math.min(MAX_COLS, Math.max(1, floor.totalTasks));
        const rows = rowsForFloor(floor.totalTasks);
        const gridW = cols * COL_W - WIN_GAP_X;
        const startX = baseX + (b.baseWidth - gridW) / 2;
        const startY = fyTop + FLOOR_PAD_Y;
        let drawn = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (drawn >= floor.totalTasks) break;
            const wx = startX + c * COL_W;
            const wy = startY + r * ROW_H;
            const lit = drawn < floor.doneTasks;
            if (lit) {
              ctx.fillStyle = "rgba(255,235,120,0.35)";
              ctx.fillRect(wx - 1, wy - 1, WIN_W + 2, WIN_H + 2);
              ctx.fillStyle = "#FFE680";
            } else {
              ctx.fillStyle = floor.isCurrent ? "#0F172A" : "#1E293B";
            }
            ctx.fillRect(wx, wy, WIN_W, WIN_H);
            drawn++;
          }
        }

        cursorY = fyTop;
      }

      const doorW = Math.min(14, b.baseWidth * 0.3);
      ctx.fillStyle = shade(baseColor, -35);
      ctx.fillRect(b.x - doorW / 2, baseY - DOOR_H, doorW, DOOR_H);

      if (b.isDelayed) {
        ctx.fillStyle = "rgba(30,20,10,0.18)";
        ctx.fillRect(baseX, topY, b.baseWidth, b.baseHeight);

        ctx.strokeStyle = "rgba(0,0,0,0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(baseX + 5, topY + 8);
        ctx.lineTo(baseX + 12, topY + 28);
        ctx.lineTo(baseX + 3, topY + 48);
        ctx.lineTo(baseX + 14, topY + 72);
        ctx.lineTo(baseX + 6, topY + 95);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(baseX + b.baseWidth - 6, topY + 12);
        ctx.lineTo(baseX + b.baseWidth - 3, topY + 38);
        ctx.lineTo(baseX + b.baseWidth - 14, topY + 60);
        ctx.lineTo(baseX + b.baseWidth - 5, topY + 88);
        ctx.stroke();
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(b.x - 1, topY + 5);
        ctx.lineTo(b.x + 6, topY + 35);
        ctx.lineTo(b.x - 4, topY + 58);
        ctx.lineTo(b.x + 3, topY + 82);
        ctx.stroke();
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        for (let ci = 0; ci < 4; ci++) {
          const cx = baseX + 8 + ci * (b.baseWidth / 4);
          const cy = topY + 20 + ci * 18;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + 8 - ci * 2, cy + 14);
          ctx.stroke();
        }

        ctx.fillStyle = "#7CC4F0";
        ctx.beginPath();
        ctx.moveTo(baseX + b.baseWidth + 3, topY - 6);
        ctx.lineTo(baseX + b.baseWidth - 16, topY - 6);
        ctx.lineTo(baseX + b.baseWidth - 10, topY + 14);
        ctx.lineTo(baseX + b.baseWidth + 3, topY + 10);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(baseX - 3, topY - 6);
        ctx.lineTo(baseX + 10, topY - 6);
        ctx.lineTo(baseX + 6, topY + 8);
        ctx.lineTo(baseX - 3, topY + 6);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#6B4226";
        for (let d = 0; d < 8; d++) {
          const side = d < 4 ? baseX - 4 + d * 3 : baseX + b.baseWidth - 12 + (d - 4) * 4;
          const dy = baseY - 1 + (d % 3);
          const dw = 3 + (d % 3) * 2;
          const dh = 2 + (d % 2) * 2;
          ctx.fillRect(side, dy, dw, dh);
        }
        ctx.fillStyle = "#7F1D1D";
        for (let r = 0; r < 6; r++) {
          const rx = baseX + b.baseWidth * 0.2 + r * (b.baseWidth * 0.12);
          ctx.fillRect(rx, baseY + 1 + (r % 2) * 2, 2 + (r % 2), 2);
        }

        ctx.globalAlpha = 0.3;
        for (let s = 0; s < 4; s++) {
          const sx = baseX + b.baseWidth * (0.2 + s * 0.2) + Math.sin(time / 400 + s * 2) * 5;
          const sy = topY - 8 - s * 12 - Math.sin(time / 600 + s) * 6;
          const sr = 6 + s * 2 + Math.sin(time / 500 + s * 3) * 2;
          ctx.fillStyle = `rgba(120,110,100,${0.5 - s * 0.1})`;
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        ctx.fillStyle = "#F59E0B";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(b.x, topY - 32);
        ctx.lineTo(b.x - 11, topY - 12);
        ctx.lineTo(b.x + 11, topY - 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#000";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("!", b.x, topY - 16);
      }

      if (!b.isComplete && !b.isDelayed) {
        const mastX = baseX + b.baseWidth - 6;
        const craneTop = topY - 55;
        const armLen = b.baseWidth * 0.7 + 30;
        const craneArmEnd = mastX + armLen;
        const counterEnd = mastX - 20;

        ctx.strokeStyle = "#D97706";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(mastX, topY);
        ctx.lineTo(mastX, craneTop);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#B45309";
        for (let my = topY - 10; my > craneTop + 5; my -= 12) {
          ctx.beginPath();
          ctx.moveTo(mastX - 3, my);
          ctx.lineTo(mastX + 3, my - 10);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(mastX + 3, my);
          ctx.lineTo(mastX - 3, my - 10);
          ctx.stroke();
        }

        ctx.fillStyle = "#374151";
        ctx.fillRect(mastX - 6, craneTop - 2, 12, 10);
        ctx.fillStyle = "rgba(147,197,253,0.7)";
        ctx.fillRect(mastX - 4, craneTop, 8, 5);

        ctx.strokeStyle = "#D97706";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(mastX, craneTop);
        ctx.lineTo(craneArmEnd, craneTop);
        ctx.stroke();
        ctx.strokeStyle = "#9CA3AF";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(mastX, craneTop - 14);
        ctx.lineTo(craneArmEnd, craneTop);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(mastX, craneTop - 14);
        ctx.lineTo(counterEnd, craneTop);
        ctx.stroke();

        ctx.strokeStyle = "#D97706";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(mastX, craneTop);
        ctx.lineTo(counterEnd, craneTop);
        ctx.stroke();
        ctx.fillStyle = "#6B7280";
        ctx.fillRect(counterEnd - 4, craneTop - 2, 8, 8);

        ctx.strokeStyle = "#D97706";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(mastX - 5, craneTop);
        ctx.lineTo(mastX, craneTop - 14);
        ctx.lineTo(mastX + 5, craneTop);
        ctx.stroke();

        const swing = Math.sin(time / 700 + b.x / 50) * 10;
        const trolleyX = craneArmEnd - 12 + swing * 0.3;
        ctx.fillStyle = "#374151";
        ctx.fillRect(trolleyX - 3, craneTop - 2, 6, 4);
        ctx.strokeStyle = "#6B7280";
        ctx.lineWidth = 0.8;
        const loadY = craneTop + 26;
        const loadX = trolleyX + swing * 0.6;
        ctx.beginPath();
        ctx.moveTo(trolleyX, craneTop + 2);
        ctx.lineTo(loadX, loadY);
        ctx.stroke();
        ctx.fillStyle = "#92400E";
        ctx.fillRect(loadX - 5, loadY, 10, 8);
        ctx.fillStyle = "#D97706";
        ctx.beginPath();
        ctx.arc(loadX, loadY, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      if (b.isComplete) {
        ctx.fillStyle = "#C9A84C";
        ctx.beginPath();
        ctx.moveTo(b.x, topY - 24);
        ctx.lineTo(b.x - 4, topY - 6);
        ctx.lineTo(b.x + 4, topY - 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#FBBF24";
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const angle = (Math.PI / 5) * i - Math.PI / 2;
          const radius = i % 2 === 0 ? 6 : 3;
          const x = b.x + Math.cos(angle) * radius;
          const y = topY - 30 + Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      }

      if (hoveredId === b.id) {
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(baseX - 3, topY - 8, b.baseWidth + 6, b.baseHeight + 12);
      }

      // Executor name badge — admin mode only.
      if (b.executorLabel) {
        const labelY = topY - (b.isComplete ? 40 : 70);
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        const text = b.executorLabel.length > 20 ? b.executorLabel.slice(0, 18) + "…" : b.executorLabel;
        const padX = 4;
        const textW = ctx.measureText(text).width + padX * 2;
        const labelH = 13;
        ctx.fillStyle = "rgba(28,27,46,0.85)";
        ctx.beginPath();
        ctx.roundRect(b.x - textW / 2, labelY - labelH + 2, textW, labelH, 6);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(text, b.x, labelY);
      }

      ctx.restore();
    }

    function tick(now: number) {
      const time = now - t0;
      ctx.clearRect(0, 0, VW, VH);

      drawSky();
      drawSun(time);

      for (const c of clouds) {
        c.x -= c.speed;
        if (c.x < -80) c.x = WORLD_W + 80;
        drawCloud(c);
      }

      drawForest();
      drawGround(time);
      drawRoad();

      for (const car of cars) {
        car.x += car.speed * car.dir;
        if (car.dir === 1 && car.x > WORLD_W + 30) car.x = -40;
        if (car.dir === -1 && car.x < -40) car.x = WORLD_W + 30;
        drawCar(car);
      }

      for (const b of layout!.buildings) drawBuilding(b, time);

      for (const tree of trees) drawStreetTree(tree, time);
      for (const f of flowers) drawFlower(f);

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [layout, hoveredId]);

  function pointToBuilding(clientX: number, clientY: number): BuildingLayout | null {
    if (!layout) return null;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = ((clientX - rect.left) / rect.width) * layout.canvasWidth;
    const y = ((clientY - rect.top) / rect.height) * layout.canvasHeight;
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
    if (dragStateRef.current.moved > 5) return;
    const b = pointToBuilding(e.clientX, e.clientY);
    if (!b) return;
    if (onBuildingClick) {
      onBuildingClick(b);
    } else {
      setSelected(b);
    }
  }

  // Drag-to-scroll on the container.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isDown = false;
    let startX = 0;
    let scrollLeftStart = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDown = true;
      startX = e.pageX - container.offsetLeft;
      scrollLeftStart = container.scrollLeft;
      dragStateRef.current.moved = 0;
      container.style.cursor = "grabbing";
    };
    const onMouseLeave = () => {
      isDown = false;
      container.style.cursor = "grab";
    };
    const onMouseUp = () => {
      isDown = false;
      container.style.cursor = "grab";
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const dx = x - startX;
      dragStateRef.current.moved = Math.max(dragStateRef.current.moved, Math.abs(dx));
      container.scrollLeft = scrollLeftStart - dx;
    };

    container.addEventListener("mousedown", onMouseDown);
    container.addEventListener("mouseleave", onMouseLeave);
    container.addEventListener("mouseup", onMouseUp);
    container.addEventListener("mousemove", onMouseMove);

    return () => {
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("mouseleave", onMouseLeave);
      container.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("mousemove", onMouseMove);
    };
  }, [layout, fullscreen]);

  function handleMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const b = pointToBuilding(e.clientX, e.clientY);
    setHoveredId(b?.id || null);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = b ? "pointer" : "default";
    }
  }

  if (!layout || layout.buildings.length === 0) return null;

  return (
    <>
      <div
        className={
          fullscreen
            ? "fixed inset-0 z-50 bg-white overflow-hidden"
            : "flex-shrink-0 mx-4 lg:mx-6 relative overflow-hidden rounded-2xl bg-white"
        }
        style={
          fullscreen
            ? undefined
            : {
                height: "clamp(180px, 35vh, 400px)",
                border: "1px solid #E2E0D8",
                boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
              }
        }
      >
        <div
          ref={containerRef}
          className="w-full h-full overflow-x-auto overflow-y-hidden select-none"
          style={{
            cursor: "grab",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <canvas
            ref={canvasRef}
            onClick={handleClick}
            onMouseMove={handleMove}
            onMouseLeave={() => setHoveredId(null)}
            style={{ display: "block" }}
          />
        </div>

        {!fullscreen ? (
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            aria-label="ملء الشاشة"
            title="ملء الشاشة"
            className="absolute top-3 left-3 z-10 flex items-center justify-center rounded-full transition-all hover:shadow-lg"
            style={{
              width: 36,
              height: 36,
              backgroundColor: "rgba(255,255,255,0.95)",
              border: "1px solid #E2E0D8",
              color: "#1C1B2E",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              fontSize: 16,
            }}
          >
            🗺️
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            aria-label="خروج من ملء الشاشة"
            title="تصغير"
            className="fixed z-[9999] flex items-center justify-center gap-1.5 rounded-full transition-all hover:shadow-2xl active:scale-95"
            style={{
              top: "max(16px, env(safe-area-inset-top, 16px))",
              left: 16,
              minWidth: 48,
              minHeight: 48,
              padding: "10px 16px",
              backgroundColor: "#FFFFFF",
              border: "2px solid #E2E0D8",
              color: "#1C1B2E",
              boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
              fontSize: 14,
              fontWeight: 800,
              backdropFilter: "blur(6px)",
            }}
          >
            <X size={20} />
            <span className="hidden sm:inline">تصغير</span>
          </button>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
                  <Building2 size={20} style={{ color: "#C9A84C" }} />
                  {selected.name}
                </h2>
                {selected.projectCode && (
                  <span
                    className="inline-block mt-1 px-2 py-0.5 rounded font-mono text-[11px] font-bold tracking-wider"
                    style={{ backgroundColor: "rgba(94,84,149,0.08)", color: "#5E5495", border: "1px solid rgba(94,84,149,0.18)" }}
                  >
                    {selected.projectCode}
                  </span>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg" style={{ color: "#9CA3AF" }}>
                <X size={18} />
              </button>
            </div>
            {selected.department?.name && (
              <p className="text-xs mb-2" style={{ color: "#6B7280" }}>
                القسم: {selected.department.name}
              </p>
            )}
            {selected.executors && selected.executors.length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] font-semibold mb-1.5" style={{ color: "#6B7280" }}>
                  المنفذون:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.executors.map((e) => (
                    <span
                      key={e.id}
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "rgba(94,84,149,0.1)", color: "#5E5495" }}
                    >
                      {e.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="p-3 rounded-xl text-center" style={{ backgroundColor: "rgba(94,84,149,0.06)" }}>
                <p className="text-[10px] mb-1" style={{ color: "#6B7280" }}>الحالة</p>
                <p className="text-xs font-bold" style={{ color: "#5E5495" }}>
                  {STATUS_LABELS[selected.status] || selected.status}
                </p>
              </div>
              <div className="p-3 rounded-xl text-center" style={{ backgroundColor: "rgba(201,168,76,0.06)" }}>
                <p className="text-[10px] mb-1" style={{ color: "#6B7280" }}>الطوابق</p>
                <p className="text-xs font-bold" style={{ color: "#C9A84C" }}>
                  {selected.floors.filter((f) => f.isComplete).length}/{selected.floors.length}
                </p>
              </div>
              <div className="p-3 rounded-xl text-center" style={{ backgroundColor: "rgba(5,150,105,0.06)" }}>
                <p className="text-[10px] mb-1" style={{ color: "#6B7280" }}>المهام</p>
                <p className="text-xs font-bold" style={{ color: "#059669" }}>
                  {selected.completedTasks}/{selected.totalTasks}
                </p>
              </div>
            </div>
            <div className="mb-4">
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
            {selected.floors.length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] font-semibold mb-2" style={{ color: "#6B7280" }}>الطوابق (الخدمات):</p>
                <div className="space-y-1.5">
                  {selected.floors.map((f, idx) => (
                    <div key={f.serviceId} className="flex items-center gap-2 text-xs">
                      <span className="w-5 text-center font-bold" style={{ color: "#9CA3AF" }}>{idx + 1}</span>
                      <span className="flex-1 truncate" style={{ color: "#1C1B2E" }}>{f.serviceName}</span>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: f.isComplete ? "rgba(34,197,94,0.1)" : "rgba(201,168,76,0.1)",
                          color: f.isComplete ? "#22C55E" : "#C9A84C",
                        }}
                      >
                        {f.doneTasks}/{f.totalTasks}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end">
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
    </>
  );
}
