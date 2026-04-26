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

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X, Building2 } from "lucide-react";
import {
  getBuildingState as getBuildingStateImpl,
  isProjectComplete as isProjectCompleteImpl,
  STATE_ORDER as STATE_ORDER_IMPL,
  type BuildingState as BuildingStateImpl,
} from "@/lib/city-state";

// Re-export so existing import sites (CityStatsBar, pages, leaderboard) keep
// working unchanged. Single source of truth lives in @/lib/city-state.
export type BuildingState = BuildingStateImpl;
export const getBuildingState = getBuildingStateImpl;
export const isProjectComplete = isProjectCompleteImpl;

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
  startDate?: string | null;
  endDate: string | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  createdAt?: string | null;
  isPaused?: boolean;
  // Server-derived flag — set by /api/projects, /api/admin/all-cities and
  // /api/admin/cities-leaderboard when the project has a locked unpaid
  // non-first installment.
  paymentFrozen?: boolean;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  department?: { id: string; name: string; color: string | null } | null;
  services?: CityApiService[];
  tasks?: { id: string; status: string; dueDate: string | null }[];
  // Distinct executors (admin all-cities mode only).
  executors?: { id: string; name: string }[];
}

const STATE_ORDER = STATE_ORDER_IMPL;

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
  state: BuildingState;
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
  // Optional content rendered absolutely in the top-right corner of the
  // city frame. Used by executor-city for the builder-tier badge; null in
  // all-cities. Renders inside the same wrapper, so it follows fullscreen.
  topRightBadge?: ReactNode;
  // One-shot celebration trigger — incrementing `key` plays a brief glow
  // ring around the project's building. Wired via Pusher 'task-completed'.
  celebrate?: { key: number; projectId: string } | null;
}

export default function CityCanvas({ projects, viewMode, onBuildingClick, topRightBadge, celebrate }: CityCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selected, setSelected] = useState<BuildingLayout | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<{ w: number; h: number }>({
    w: typeof window !== "undefined" ? window.innerWidth : 1280,
    h: typeof window !== "undefined" ? window.innerHeight : 720,
  });
  // Fullscreen state hydrates from localStorage so the user's last choice
  // sticks across reloads. Per-viewMode key keeps executor and admin views
  // independent.
  const [fullscreen, setFullscreen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(`city-fullscreen-${viewMode}`) === "true";
    } catch {
      return false;
    }
  });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({ moved: 0 });
  const [containerWidth, setContainerWidth] = useState(0);

  // Celebration ring queue. Pushed when `celebrate.key` changes; drained
  // by the animation loop. Lives in a ref so adding a celebration doesn't
  // trigger a React re-render or restart the RAF loop.
  const celebrationsRef = useRef<Array<{ projectId: string; startTime: number }>>([]);
  const lastCelebrateKeyRef = useRef<number | null>(null);

  useEffect(() => {
    if (!celebrate || celebrate.key === lastCelebrateKeyRef.current) return;
    lastCelebrateKeyRef.current = celebrate.key;
    celebrationsRef.current.push({
      projectId: celebrate.projectId,
      startTime: performance.now(),
    });
  }, [celebrate]);

  // Persist fullscreen toggle.
  useEffect(() => {
    try {
      localStorage.setItem(`city-fullscreen-${viewMode}`, fullscreen ? "true" : "false");
    } catch {
      /* localStorage unavailable (SSR / privacy mode) — silent no-op */
    }
  }, [fullscreen, viewMode]);

  // Restore + persist horizontal scroll position. Restores once on first
  // layout settle; persists with a 250ms trailing debounce so we don't
  // hammer localStorage during a drag.
  const restoredScrollRef = useRef(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !containerWidth) return;
    const key = `city-scroll-${viewMode}`;

    if (!restoredScrollRef.current) {
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const n = parseInt(saved, 10);
          if (!isNaN(n) && n >= 0) el.scrollLeft = n;
        }
      } catch {
        /* ignore */
      }
      restoredScrollRef.current = true;
    }

    let writeTimer: number | undefined;
    const onScroll = () => {
      if (writeTimer) window.clearTimeout(writeTimer);
      writeTimer = window.setTimeout(() => {
        try {
          if (containerRef.current) {
            localStorage.setItem(key, String(containerRef.current.scrollLeft));
          }
        } catch {
          /* ignore */
        }
      }, 250);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (writeTimer) window.clearTimeout(writeTimer);
    };
  }, [viewMode, containerWidth]);

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

    // Sort projects up-front by lifecycle priority so the most urgent
    // (COLLAPSED) lands on the right edge of the canvas — Arabic readers
    // hit it first — and COMPLETED celebrations sit on the left as the
    // tail. The original index is then re-applied to compute building x.
    const ordered = projects
      .map((p) => ({ p, state: getBuildingState({ ...p, isComplete: isProjectComplete(p) }) }))
      .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state])
      .map(({ p }) => p);

    const buildings: BuildingLayout[] = ordered.map((p, idx) => {
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

      const isComplete = isProjectComplete(p);
      const state = getBuildingState({ ...p, isComplete });

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
        color:
          state === "COMPLETED"
            ? pickCompletedColor(p.id)
            : state === "COLLAPSED"
              ? "#B91C1C"
              : state === "AT_RISK"
                ? "#7A7770" // weathered concrete drift toward gray
                : state === "PAYMENT_FROZEN" || state === "ADMIN_PAUSED"
                  ? ACTIVE_COLOR // building is intact, the overlay carries the cue
                  : ACTIVE_COLOR,
        isComplete,
        state,
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

    // Stars for night mode — positions cached on init, twinkle per frame.
    type Star = { x: number; y: number; r: number; phase: number };
    const stars: Star[] = Array.from({ length: Math.max(40, Math.ceil(WORLD_W / 25)) }, () => ({
      x: Math.random() * WORLD_W,
      y: Math.random() * (layout!.sky * 0.85),
      r: 0.5 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
    }));

    let raf = 0;
    const t0 = performance.now();
    // Closure flag set fresh at the top of every tick from the wall clock.
    // Drawing helpers branch on it to swap sun↔moon, day↔night sky, and to
    // boost lit-window glow after dark.
    let isNight = false;

    function drawSky() {
      const grd = ctx.createLinearGradient(0, 0, 0, layout!.sky);
      if (isNight) {
        grd.addColorStop(0, "#0A1330");   // deep navy at the top
        grd.addColorStop(0.5, "#1F1645"); // dark purple
        grd.addColorStop(1, "#3A2754");   // muted plum near the horizon
      } else {
        grd.addColorStop(0, "#7CC4F0");
        grd.addColorStop(0.6, "#B8E1F5");
        grd.addColorStop(1, "#E0F2FE");
      }
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, VW, layout!.sky);
    }

    function drawStars(time: number) {
      ctx.fillStyle = "#FFFFFF";
      for (const s of stars) {
        const twinkle = 0.55 + 0.45 * Math.sin(time / 700 + s.phase);
        ctx.globalAlpha = 0.5 + twinkle * 0.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawMoon(time: number) {
      const cx = 120;
      const cy = 90;
      const pulse = 1 + Math.sin(time / 2200) * 0.03;

      // Soft outer glow halo.
      const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, 60);
      glow.addColorStop(0, "rgba(255,250,210,0.55)");
      glow.addColorStop(1, "rgba(255,250,210,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 56 * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Moon body — pale ivory disk.
      ctx.fillStyle = "#F4EFD0";
      ctx.beginPath();
      ctx.arc(cx, cy, 28 * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Subtle terminator on the right side gives a 3D feel.
      ctx.fillStyle = "rgba(120,110,80,0.16)";
      ctx.beginPath();
      ctx.arc(cx + 7, cy - 2, 24 * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Tiny craters.
      ctx.fillStyle = "rgba(180,170,120,0.45)";
      ctx.beginPath();
      ctx.arc(cx - 9, cy - 6, 3, 0, Math.PI * 2);
      ctx.arc(cx + 4, cy + 9, 4, 0, Math.PI * 2);
      ctx.arc(cx - 5, cy + 7, 2, 0, Math.PI * 2);
      ctx.fill();
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

    // Flashing red+blue rooftop emergency strobe. Phase flips every 500 ms
    // so the colors swap predictably regardless of frame rate. Used for
    // TASK_LATE (subtle cue) and COLLAPSED (severe cue).
    function drawEmergencyRoofLights(
      bx: number,
      by: number,
      bwidth: number,
      time: number,
      severe: boolean
    ) {
      const phase = Math.floor(time / 500) % 2 === 0;
      const left = phase ? "#DC2626" : "#2563EB";
      const right = phase ? "#2563EB" : "#DC2626";
      const radius = severe ? 4 : 3;
      const glowR = severe ? 11 : 7;
      const glowAlpha = severe ? 0.55 : 0.35;
      const lx = bx + 5;
      const rx = bx + bwidth - 5;
      const ly = by - 9;

      const leftGlow = left === "#DC2626" ? "220,38,38" : "37,99,235";
      const rightGlow = right === "#DC2626" ? "220,38,38" : "37,99,235";

      ctx.fillStyle = `rgba(${leftGlow},${glowAlpha})`;
      ctx.beginPath();
      ctx.arc(lx, ly, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${rightGlow},${glowAlpha})`;
      ctx.beginPath();
      ctx.arc(rx, ly, glowR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = left;
      ctx.beginPath();
      ctx.arc(lx, ly, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = right;
      ctx.beginPath();
      ctx.arc(rx, ly, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawPoliceCar(cx: number, cy: number, time: number) {
      const w = 22;
      const h = 9;
      ctx.save();
      ctx.translate(cx, cy);

      // Body — white with black middle stripe
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 2);
      ctx.fill();
      ctx.fillStyle = "#1F2937";
      ctx.fillRect(-w / 2, -1, w, 2);
      // Cabin
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.roundRect(-w / 2 + 4, -h / 2 - 5, w - 8, 5, 2);
      ctx.fill();
      ctx.fillStyle = "rgba(147,197,253,0.7)";
      ctx.fillRect(-w / 2 + 5, -h / 2 - 4, w - 10, 3);
      // Wheels
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(-w / 2 + 5, h / 2 + 1, 2.5, 0, Math.PI * 2);
      ctx.arc(w / 2 - 5, h / 2 + 1, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Flashing strobe on top — red+blue alternating every 500 ms.
      const phase = Math.floor(time / 500) % 2 === 0;
      const leftColor = phase ? "#DC2626" : "#2563EB";
      const rightColor = phase ? "#2563EB" : "#DC2626";
      ctx.fillStyle = `rgba(${leftColor === "#DC2626" ? "220,38,38" : "37,99,235"},0.4)`;
      ctx.beginPath();
      ctx.arc(-3, -h / 2 - 7, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${rightColor === "#DC2626" ? "220,38,38" : "37,99,235"},0.4)`;
      ctx.beginPath();
      ctx.arc(3, -h / 2 - 7, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = leftColor;
      ctx.fillRect(-4, -h / 2 - 8, 3, 3);
      ctx.fillStyle = rightColor;
      ctx.fillRect(1, -h / 2 - 8, 3, 3);

      ctx.restore();
    }

    function drawAmbulance(cx: number, cy: number, time: number) {
      const w = 24;
      const h = 12;
      ctx.save();
      ctx.translate(cx, cy);

      // Body — white box
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 2);
      ctx.fill();
      // Front cab window
      ctx.fillStyle = "rgba(147,197,253,0.75)";
      ctx.fillRect(-w / 2 + 1, -h / 2 + 1, 7, 5);
      // Side window slit
      ctx.fillRect(-w / 2 + 9, -h / 2 + 1, 3, 4);
      // Red cross
      ctx.fillStyle = "#DC2626";
      ctx.fillRect(2, -3, 3, 9);
      ctx.fillRect(-1, 0, 9, 3);
      // Wheels
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(-w / 2 + 5, h / 2 + 1, 2.5, 0, Math.PI * 2);
      ctx.arc(w / 2 - 5, h / 2 + 1, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Flashing red light on top.
      const phase = Math.floor(time / 500) % 2 === 0;
      ctx.fillStyle = phase ? "rgba(220,38,38,0.5)" : "rgba(127,29,29,0.25)";
      ctx.beginPath();
      ctx.arc(0, -h / 2 - 5, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = phase ? "#DC2626" : "#7F1D1D";
      ctx.fillRect(-3, -h / 2 - 6, 6, 3);

      ctx.restore();
    }

    // Lavender frost overlay + slowly drifting snowflakes for the
    // PAYMENT_FROZEN state. Building stays structurally clean; the cue is
    // pure mood — work is on ice until the bill is paid.
    function drawFrostAndSnow(
      bx: number,
      by: number,
      bwidth: number,
      bheight: number,
      time: number
    ) {
      // Translucent purple wash over the body.
      ctx.fillStyle = "rgba(168, 85, 247, 0.20)";
      ctx.fillRect(bx, by, bwidth, bheight);

      // 6 snowflakes wrapping vertically through the building's bounding box.
      // x-positions seeded from bx so the same building always snows the same.
      ctx.fillStyle = "rgba(232, 220, 255, 0.85)";
      for (let i = 0; i < 6; i++) {
        const offsetX = ((bx * 17 + i * 53) % (bwidth - 4));
        const sx = bx + 2 + offsetX + Math.sin(time / 1100 + i) * 3;
        const sy = by + ((time / 32 + i * 47) % (bheight + 8));
        ctx.beginPath();
        ctx.arc(sx, sy, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Diagonal black/yellow caution tape stripes layered over the facade.
    // We clip to the building rect so the stripes don't bleed onto the sky.
    function drawCautionTape(
      bx: number,
      by: number,
      bwidth: number,
      bheight: number
    ) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, by, bwidth, bheight);
      ctx.clip();

      const stripe = 6;
      const cycle = stripe * 2;
      // Diagonal stripes — iterate offsets along the building diagonal.
      const startD = -bheight;
      const endD = bwidth + bheight;
      for (let d = startD; d < endD; d += cycle) {
        // Yellow band
        ctx.fillStyle = "rgba(250, 204, 21, 0.65)";
        ctx.beginPath();
        ctx.moveTo(bx + d, by);
        ctx.lineTo(bx + d + stripe, by);
        ctx.lineTo(bx + d + stripe + bheight, by + bheight);
        ctx.lineTo(bx + d + bheight, by + bheight);
        ctx.closePath();
        ctx.fill();
        // Black band
        ctx.fillStyle = "rgba(15, 15, 15, 0.65)";
        ctx.beginPath();
        ctx.moveTo(bx + d + stripe, by);
        ctx.lineTo(bx + d + stripe * 2, by);
        ctx.lineTo(bx + d + stripe * 2 + bheight, by + bheight);
        ctx.lineTo(bx + d + stripe + bheight, by + bheight);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Small traffic cone planted on the road in front of an admin-paused
    // building. Sits OUTSIDE the shake transform so it doesn't wobble.
    function drawTrafficCone(cx: number, cy: number) {
      ctx.fillStyle = "#F97316";
      ctx.beginPath();
      ctx.moveTo(cx, cy - 11);
      ctx.lineTo(cx - 5, cy);
      ctx.lineTo(cx + 5, cy);
      ctx.closePath();
      ctx.fill();
      // White reflective stripe around the middle.
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.moveTo(cx - 3.2, cy - 5);
      ctx.lineTo(cx + 3.2, cy - 5);
      ctx.lineTo(cx + 3.7, cy - 3);
      ctx.lineTo(cx - 3.7, cy - 3);
      ctx.closePath();
      ctx.fill();
      // Base slab.
      ctx.fillStyle = "#1F2937";
      ctx.fillRect(cx - 6, cy, 12, 2);
    }

    // Door-mounted sign: pill background, emoji + label centered.
    function drawDoorSign(cx: number, cy: number, emoji: string, label: string) {
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      const text = `${emoji} ${label}`;
      const padX = 5;
      const w = ctx.measureText(text).width + padX * 2;
      const h = 14;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.roundRect(cx - w / 2, cy - h, w, h, 4);
      ctx.fill();
      ctx.strokeStyle = "rgba(28,27,46,0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#1C1B2E";
      ctx.fillText(text, cx, cy - 4);
    }

    function drawBuilding(b: BuildingLayout, time: number) {
      const baseX = b.x - b.baseWidth / 2;
      const baseY = roadY - 4;
      const topY = baseY - b.baseHeight;

      const isCollapsed = b.state === "COLLAPSED";
      const isAtRisk = b.state === "AT_RISK";
      const isTaskLate = b.state === "TASK_LATE";
      const isPaymentFrozen = b.state === "PAYMENT_FROZEN";
      const isAdminPaused = b.state === "ADMIN_PAUSED";

      // Only the fully ruined (COLLAPSED) building shakes — TASK_LATE,
      // AT_RISK, PAYMENT_FROZEN, ADMIN_PAUSED all keep visual integrity.
      const shakeX = isCollapsed ? Math.sin(time / 60 + b.x) * 1.5 : 0;

      ctx.save();
      ctx.translate(shakeX, 0);

      const baseColor = b.color;
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
              // Stronger, wider halo at night so the city visibly glows
              // even against a dark sky / dark facade.
              if (isNight) {
                ctx.fillStyle = "rgba(255,225,100,0.55)";
                ctx.fillRect(wx - 2, wy - 2, WIN_W + 4, WIN_H + 4);
                ctx.fillStyle = "rgba(255,235,120,0.35)";
                ctx.fillRect(wx - 1, wy - 1, WIN_W + 2, WIN_H + 2);
              } else {
                ctx.fillStyle = "rgba(255,235,120,0.35)";
                ctx.fillRect(wx - 1, wy - 1, WIN_W + 2, WIN_H + 2);
              }
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

      if (isCollapsed) {
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

      if (isAtRisk) {
        // ── Mid-stage decay: building cracking but still standing ──

        // 3-5 light hairline cracks scattered across the facade. Positions
        // are derived from b.x so the same building always cracks the same
        // way (no flicker between frames).
        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        ctx.lineWidth = 1.1;
        const seed = (Math.abs(Math.floor(b.x * 13)) % 5) + 3; // 3..7 cracks
        for (let i = 0; i < seed; i++) {
          const cx0 = baseX + 4 + ((i * 19) % (b.baseWidth - 8));
          const cy0 = topY + 12 + ((i * 31) % Math.max(20, b.baseHeight - 30));
          ctx.beginPath();
          ctx.moveTo(cx0, cy0);
          ctx.lineTo(cx0 + 3, cy0 + 7);
          ctx.lineTo(cx0 - 1, cy0 + 13);
          ctx.lineTo(cx0 + 4, cy0 + 20);
          ctx.stroke();
        }

        // Falling gravel — a few small particles drift downward through
        // the building's bounding box. Each particle has its own offset so
        // they don't fall in a perfect column.
        ctx.fillStyle = "rgba(120,113,108,0.7)";
        const fallH = b.baseHeight + 6;
        for (let g = 0; g < 5; g++) {
          const seedX = (g * 37 + b.x) % (b.baseWidth - 6);
          const gx = baseX + 3 + ((seedX + g * 7) % (b.baseWidth - 6));
          const gy = topY + ((g * 53 + time / 28) % fallH);
          ctx.fillRect(gx, gy, 2, 2);
        }

        // Faint dust haze near the rooftop where rubble dislodges.
        ctx.fillStyle = "rgba(120,113,108,0.18)";
        ctx.beginPath();
        ctx.arc(baseX + b.baseWidth * 0.5 + Math.sin(time / 800) * 4, topY - 4, 9, 0, Math.PI * 2);
        ctx.fill();
      }

      // PAYMENT_FROZEN — ice/frost overlay + slow snowflakes + "بانتظار الدفع".
      if (isPaymentFrozen) {
        drawFrostAndSnow(baseX, topY, b.baseWidth, b.baseHeight, time);
        drawDoorSign(b.x, baseY, "💰", "بانتظار الدفع");
      }

      // ADMIN_PAUSED — caution tape across the body + ⏸️ on the roof.
      if (isAdminPaused) {
        drawCautionTape(baseX, topY, b.baseWidth, b.baseHeight);
        drawDoorSign(b.x, topY - 4, "⏸️", "متوقف");
      }

      // Emergency rooftop strobe — TASK_LATE (cue) and COLLAPSED (severe).
      if (isTaskLate || isCollapsed) {
        drawEmergencyRoofLights(baseX, topY, b.baseWidth, time, isCollapsed);
      }

      // Crane: stays up while construction is active OR delayed-but-standing
      // (TASK_LATE / AT_RISK). Hidden once the building is COMPLETED, has
      // COLLAPSED, or work is paused (PAYMENT_FROZEN / ADMIN_PAUSED).
      if (!b.isComplete && !isCollapsed && !isPaymentFrozen && !isAdminPaused) {
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
        // ── Waving flag (replaces the old star) ──
        // The flag flies from a small wooden pole and ripples via a sine
        // wave whose amplitude scales with horizontal distance from the
        // pole, so the attached edge stays flush while the far edge
        // billows. Color matches the building so each tower's flag is
        // unique and harmonizes with the body.
        const poleH = 26;
        const poleY0 = topY - poleH;
        const flagW = 14;
        const flagH = 9;
        const flagY = poleY0 + 2;

        // Pole
        ctx.strokeStyle = "#8B6F47";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(b.x, poleY0);
        ctx.lineTo(b.x, topY - 2);
        ctx.stroke();
        // Pole finial — small gold ball
        ctx.fillStyle = "#FBBF24";
        ctx.beginPath();
        ctx.arc(b.x, poleY0, 1.7, 0, Math.PI * 2);
        ctx.fill();

        // Waving flag canvas — sample top + bottom edges at `segs` points,
        // each offset by a sine wave whose amplitude grows with t.
        const segs = 10;
        const baseFlagColor = b.color;
        ctx.fillStyle = baseFlagColor;
        ctx.beginPath();
        ctx.moveTo(b.x, flagY);
        for (let i = 0; i <= segs; i++) {
          const t = i / segs;
          const wave = Math.sin(time / 180 + t * Math.PI * 2.3 + b.x / 40) * 1.7 * t;
          ctx.lineTo(b.x + t * flagW, flagY + wave);
        }
        for (let i = segs; i >= 0; i--) {
          const t = i / segs;
          const wave = Math.sin(time / 180 + t * Math.PI * 2.3 + b.x / 40) * 1.7 * t;
          ctx.lineTo(b.x + t * flagW, flagY + flagH + wave);
        }
        ctx.closePath();
        ctx.fill();
        // Subtle outline so light flag colors (ivory/silver) stay readable.
        ctx.strokeStyle = "rgba(0,0,0,0.18)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
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

      // Emergency vehicles park on the road in front of the building. They
      // ride OUTSIDE the shake transform so a violently shaking COLLAPSED
      // building doesn't drag the responders along with it.
      const carY = roadY + roadHeight / 2;
      if (isCollapsed) {
        // Severe scene: police on the left, ambulance on the right.
        drawPoliceCar(b.x - 16, carY, time);
        drawAmbulance(b.x + 16, carY, time);
      } else if (isTaskLate) {
        // Single police cruiser to flag the slipping deadline.
        drawPoliceCar(b.x, carY, time);
      } else if (isAdminPaused) {
        // No siren — just a worksite cone planted on the curb.
        drawTrafficCone(b.x, roadY - 1);
      }

      // Timeline strip — only for in-flight projects. A finished tower
      // doesn't need a clock under it, that's a celebration moment.
      if (!b.isComplete) {
        drawTimelineStrip(b);
      }
    }

    function drawTimelineStrip(b: BuildingLayout) {
      const start =
        (b.startDate && new Date(b.startDate).getTime()) ||
        (b.contractStartDate && new Date(b.contractStartDate).getTime()) ||
        (b.createdAt && new Date(b.createdAt).getTime()) ||
        null;
      const end =
        (b.endDate && new Date(b.endDate).getTime()) ||
        (b.contractEndDate && new Date(b.contractEndDate).getTime()) ||
        null;
      if (!start || !end || end <= start) return;

      const now = Date.now();
      const total = end - start;
      const elapsed = Math.max(0, now - start);
      const ratio = Math.min(1, elapsed / total);

      const elapsedDays = Math.max(0, Math.floor(elapsed / 86400000));
      const remainingDays = Math.max(0, Math.ceil((end - now) / 86400000));

      // Strip lives just under the road, in the grass band, lined up with
      // the building. Width tracks the building so wide buildings get a
      // wider clock — never narrower than 50 px so the text is legible.
      const stripW = Math.max(50, b.baseWidth + 4);
      const stripX = b.x - stripW / 2;
      const stripY = roadY + roadHeight + 6;
      const barH = 3;

      // Bar background — translucent white plate.
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillRect(stripX, stripY, stripW, barH);

      // Filled portion — green at low ratio, yellow at midpoint, red as
      // the deadline approaches. Two-segment piecewise interpolation.
      let r: number, g: number, blue: number;
      if (ratio < 0.5) {
        const t = ratio * 2;
        r = Math.round(16 + (245 - 16) * t);
        g = Math.round(185 + (158 - 185) * t);
        blue = Math.round(129 + (11 - 129) * t);
      } else {
        const t = (ratio - 0.5) * 2;
        r = Math.round(245 + (220 - 245) * t);
        g = Math.round(158 + (38 - 158) * t);
        blue = Math.round(11 + (38 - 11) * t);
      }
      ctx.fillStyle = `rgb(${r},${g},${blue})`;
      ctx.fillRect(stripX, stripY, stripW * ratio, barH);

      // Compact text below the bar: passed days | remaining days.
      ctx.font = "bold 8px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = isNight ? "rgba(255,255,255,0.9)" : "rgba(28,27,46,0.85)";
      ctx.fillText(`${elapsedDays}ي | ${remainingDays}ي`, b.x, stripY + barH + 9);
    }

    function tick(now: number) {
      const time = now - t0;
      // Refresh night flag every frame from the wall clock — the cost is
      // a single Date allocation, and it lets the scene transition without
      // any timer/interval scaffolding.
      const hr = new Date().getHours();
      isNight = hr >= 18 || hr < 6;

      ctx.clearRect(0, 0, VW, VH);

      drawSky();
      if (isNight) {
        drawStars(time);
        drawMoon(time);
      } else {
        drawSun(time);
      }

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

      // ── Celebration rings (Pusher task-completed) ──
      // Drawn last so they sit above buildings/trees. Each celebration
      // expands a soft ring + a faint window-glow boost over its target
      // building for ~1500 ms then prunes itself.
      const queue = celebrationsRef.current;
      if (queue.length > 0) {
        const nowAbs = performance.now();
        const stillActive: typeof queue = [];
        for (const c of queue) {
          const elapsed = nowAbs - c.startTime;
          if (elapsed > 1500) continue;
          const target = layout!.buildings.find((b) => b.id === c.projectId);
          if (!target) continue;
          const t = elapsed / 1500;
          const baseX = target.x;
          const baseY = layout!.sky + 30 - 4 - target.baseHeight / 2;
          const radius = 18 + 70 * t;
          const alpha = (1 - t) * 0.55;

          ctx.strokeStyle = `rgba(255,235,120,${alpha})`;
          ctx.lineWidth = 2.5 * (1 - t * 0.6);
          ctx.beginPath();
          ctx.arc(baseX, baseY, radius, 0, Math.PI * 2);
          ctx.stroke();

          // Inner softer ring for depth.
          ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.6})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(baseX, baseY, radius * 0.7, 0, Math.PI * 2);
          ctx.stroke();

          stillActive.push(c);
        }
        celebrationsRef.current = stillActive;
      }

      raf = requestAnimationFrame(tick);
    }

    // ── Visibility-aware RAF ──
    // Pause the loop the moment the tab goes hidden so the city stops
    // burning CPU/battery in the background. On return, resume where we
    // left off — RAF time keeps advancing from `t0`, so animations don't
    // jump.
    let paused = false;
    const onVisibilityChange = () => {
      if (document.hidden) {
        if (!paused) {
          paused = true;
          cancelAnimationFrame(raf);
        }
      } else if (paused) {
        paused = false;
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    if (document.hidden) {
      paused = true;
    } else {
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
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

        {topRightBadge && (
          <div
            className={
              fullscreen
                ? "fixed top-3 right-3 z-[60]"
                : "absolute top-3 right-3 z-10"
            }
          >
            {topRightBadge}
          </div>
        )}

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
            {/* State-driven reason banner — explains why the building is
                frozen / paused / collapsed without burying it inside the
                stat tiles. Only shown for non-happy states. */}
            {selected.state && selected.state !== "COMPLETED" && selected.state !== "IN_PROGRESS" && (
              <div
                className="mb-3 px-3 py-2 rounded-lg text-xs"
                style={{
                  backgroundColor:
                    selected.state === "COLLAPSED"
                      ? "rgba(220,38,38,0.08)"
                      : selected.state === "PAYMENT_FROZEN"
                        ? "rgba(168,85,247,0.10)"
                        : selected.state === "ADMIN_PAUSED"
                          ? "rgba(250,204,21,0.10)"
                          : selected.state === "AT_RISK"
                            ? "rgba(234,88,12,0.10)"
                            : "rgba(217,119,6,0.10)",
                  border:
                    selected.state === "COLLAPSED"
                      ? "1px solid rgba(220,38,38,0.30)"
                      : selected.state === "PAYMENT_FROZEN"
                        ? "1px solid rgba(168,85,247,0.30)"
                        : selected.state === "ADMIN_PAUSED"
                          ? "1px solid rgba(250,204,21,0.40)"
                          : selected.state === "AT_RISK"
                            ? "1px solid rgba(234,88,12,0.30)"
                            : "1px solid rgba(217,119,6,0.30)",
                  color: "#1C1B2E",
                }}
              >
                <span className="font-bold">
                  {selected.state === "COLLAPSED"
                    ? "💥 منهار: "
                    : selected.state === "PAYMENT_FROZEN"
                      ? "❄️ مجمّد: "
                      : selected.state === "ADMIN_PAUSED"
                        ? "⏸️ متوقف: "
                        : selected.state === "AT_RISK"
                          ? "⚠️ متهالك: "
                          : "🚓 متأخر بمهمة: "}
                </span>
                {selected.state === "COLLAPSED"
                  ? "تجاوز الموعد التعاقدي — يحتاج تدخّل فوري"
                  : selected.state === "PAYMENT_FROZEN"
                    ? "متوقف بسبب دفعة معلقة من العميل"
                    : selected.state === "ADMIN_PAUSED"
                      ? "موقوف من الإدارة"
                      : selected.state === "AT_RISK"
                        ? "تجاوز 80% من المدة بدون تسليم"
                        : "توجد مهام تجاوزت موعد التسليم"}
              </div>
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
