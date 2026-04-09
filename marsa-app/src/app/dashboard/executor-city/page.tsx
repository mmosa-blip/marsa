"use client";

/**
 * Unified executor workspace at /dashboard/executor-city.
 *
 * Two stacked sections, both always visible — no view toggle:
 *   1. مدينتي — gamified canvas city in a fixed-height drag frame.
 *      Each project is a building whose floors come from its services and
 *      whose windows-per-floor come from each service's tasks (lit = done,
 *      dark = remaining). A "ملء الشاشة" button blows the frame up.
 *   2. مهامي — the regular tasks list, embedded via the MyTasksView
 *      component, sits directly under the city.
 *
 * /dashboard/my-tasks redirects here.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Loader2, X, Building2 } from "lucide-react";
import MyTasksView from "@/components/MyTasksView";

interface ApiService {
  id: string;
  name: string;
  status: string | null;
  tasks: { id: string; status: string }[];
}

interface ApiProject {
  id: string;
  name: string;
  projectCode: string | null;
  status: string;
  endDate: string | null;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  department?: { id: string; name: string; color: string | null } | null;
  services?: ApiService[];
}

interface FloorLayout {
  serviceId: string;
  serviceName: string;
  totalTasks: number;
  doneTasks: number;
  isComplete: boolean;
  isCurrent: boolean; // the in-progress floor (partial, dimmer)
}

interface BuildingLayout extends ApiProject {
  x: number;          // world-space center x (NOT screen — camera offset is applied at draw time)
  baseWidth: number;
  baseHeight: number; // total height in canvas px (only counts visible floors)
  cols: number;       // uniform columns for the whole building
  floors: FloorLayout[];     // ALL service floors (for popup/cards)
  visibleFloors: FloorLayout[]; // floors that have grown into existence
  color: string;
  isComplete: boolean;
  isDelayed: boolean;
}

// Uniform window/grid constants — same across every building
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

const FALLBACK_COLORS = ["#5E5495", "#1B2A4A", "#0F766E", "#7C3AED", "#0891B2", "#B45309"];

function pickColor(id: string, fallbackIndex: number, override: string | null | undefined) {
  if (override) return override;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return FALLBACK_COLORS[Math.abs(h + fallbackIndex) % FALLBACK_COLORS.length];
}

function shade(hex: string, amount: number) {
  if (hex.startsWith("rgb")) return hex;
  const c = hex.replace("#", "");
  const r = Math.max(0, Math.min(255, parseInt(c.slice(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(c.slice(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(c.slice(4, 6), 16) + amount));
  return `rgb(${r},${g},${b})`;
}

export default function ExecutorCityPage() {
  const { data: session, status } = useSession();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [projects, setProjects] = useState<ApiProject[] | null>(null);
  const [selected, setSelected] = useState<BuildingLayout | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<{ w: number; h: number }>({
    w: typeof window !== "undefined" ? window.innerWidth : 1280,
    h: typeof window !== "undefined" ? window.innerHeight : 720,
  });
  // Fullscreen toggle: blows the map frame up to the whole viewport. The
  // outer frame has a fixed responsive height; fullscreen overrides it
  // with `fixed inset-0 z-50 h-screen w-screen`.
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // We only track `moved` here so a drag doesn't fire the canvas onClick
  // (which opens the building popup). The drag itself is wired via native
  // mouse listeners in a useEffect below.
  const dragStateRef = useRef({ moved: 0 });
  // Live width of the scrollable container (set after mount via ResizeObserver
  // and also on fullscreen toggle). The canvas takes max(containerWidth, 1400,
  // natural building width) so it always fills the visible frame at minimum.
  const [containerWidth, setContainerWidth] = useState(0);
  // Project picker — null = "كل مهامي" mode (only the user's own tasks).
  // When set, MyTasksView switches to "all tasks of this project" mode.
  const [pickedProjectId, setPickedProjectId] = useState<string | null>(null);

  // Fetch projects with services for the city — runs once on mount
  useEffect(() => {
    fetch("/api/projects?withServices=true")
      .then((r) => r.json())
      .then((d) => setProjects(Array.isArray(d) ? d : []))
      .catch(() => setProjects([]));
  }, []);

  // Track viewport size for responsive canvas
  useEffect(() => {
    function onResize() {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Track the scrollable container's *visible* width with a ResizeObserver
  // so the canvas can always fill it (no empty band on the right). Re-runs
  // whenever the container DOM changes (mount, fullscreen toggle, viewport
  // breakpoint flip).
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

  // Compute layout
  const layout = useMemo(() => {
    if (!projects) return null;

    // Container height mirrors the CSS clamp on the city frame:
    //   clamp(180px, 35vh, 400px)
    // i.e. always 35% of the viewport height, but never less than 180 and
    // never more than 400. Fullscreen overrides everything.
    let containerH: number;
    if (fullscreen) {
      containerH = viewport.h;
    } else {
      containerH = Math.max(180, Math.min(400, Math.floor(viewport.h * 0.35)));
    }
    const canvasHeight = containerH;
    const sky = Math.round(canvasHeight * 0.55);
    const padX = 50;
    // Slot per building scales with viewport width
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

      // A floor only "exists" once the previous service is finished.
      // The first floor is always visible; the topmost visible floor is the
      // currently in-progress service (rendered as a partial/dim floor) or
      // a completed service if every prior service is done too.
      const visibleFloors: FloorLayout[] = [];
      for (let i = 0; i < allFloors.length; i++) {
        if (i === 0 || allFloors[i - 1].isComplete) {
          visibleFloors.push({ ...allFloors[i], isCurrent: !allFloors[i].isComplete });
        } else {
          break;
        }
      }
      // Always keep at least a ground floor so brand-new projects still
      // show something (a tiny single-window stub).
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

      // Uniform building columns: take the widest visible floor's column
      // count so the grid is square within this building.
      const cols = Math.max(
        1,
        ...visibleFloors.map((f) => Math.min(MAX_COLS, Math.max(1, f.totalTasks || 1)))
      );
      const baseWidth = cols * COL_W + FLOOR_PAD_X * 2;

      // Total height = sum of every visible floor's band height + door slab.
      const floorsHeight = visibleFloors.reduce((s, f) => s + floorBandHeight(f.totalTasks), 0);
      const DOOR_H = 14;
      const baseHeight = floorsHeight + DOOR_H + 4;

      const isComplete = allFloors.length > 0 && allFloors.every((f) => f.isComplete);
      const now = Date.now();
      const isDelayed =
        !isComplete &&
        ((p.endDate && new Date(p.endDate).getTime() < now) || p.status === "ON_HOLD");

      return {
        ...p,
        x: padX + idx * slot + slot / 2,
        baseWidth,
        baseHeight,
        cols,
        floors: allFloors,
        visibleFloors,
        color: pickColor(p.id, idx, p.department?.color),
        isComplete,
        isDelayed,
      };
    });

    // Canvas width must satisfy three constraints simultaneously:
    //   1. fill the visible container so there's no empty band on the right
    //   2. accommodate every building (padX*2 + N*slot)
    //   3. give the user enough room to drag horizontally on small screens
    // We take the max of all three. containerWidth is 0 before the first
    // ResizeObserver tick — fall back to viewport.w in that case so the
    // very first paint isn't a tiny stub.
    const naturalWidth = padX * 2 + projects.length * slot;
    const visibleW = containerWidth > 0 ? containerWidth : viewport.w;
    const canvasWidth = Math.max(visibleW, 1400, naturalWidth);

    return {
      canvasWidth,
      canvasHeight,
      sky,
      buildings,
    };
  }, [projects, viewport, fullscreen, containerWidth]);

  // ─── Animation loop ───
  useEffect(() => {
    if (!layout) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    // Canvas is sized to the FIXED visible viewport (canvasWidth/Height) —
    // the wider world is panned via cameraX, never by resizing the canvas.
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

    const VW = layout.canvasWidth;   // visible canvas width
    const VH = layout.canvasHeight;  // visible canvas height
    const WORLD_W = layout.canvasWidth; // canvas IS the world now
    const groundY = layout.sky;
    const roadY = groundY + 30;
    const roadHeight = 38;

    // Decorations live in WORLD coords (so they pan with the camera)
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
        const y = layout!.sky - 20 - Math.sin(x / 60) * 12;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(WORLD_W, layout!.sky);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#3E6B36";
      for (let x = 20; x < WORLD_W; x += 30) {
        const baseY = layout!.sky - 22 - Math.sin(x / 60) * 12;
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.lineTo(x - 6, baseY - 16);
        ctx.lineTo(x + 6, baseY - 16);
        ctx.closePath();
        ctx.fill();
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
        shakeX = Math.sin(time / 90 + b.x) * 0.8;
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

      // Roof slab
      ctx.fillStyle = shade(baseColor, -25);
      ctx.fillRect(baseX - 3, topY - 5, b.baseWidth + 6, 6);

      // Floors — one band per VISIBLE service (a service appears only after
      // its predecessor is done). Floor 0 = ground floor (drawn at the bottom
      // of the building), the last visible floor is the top.
      const visible = b.visibleFloors;
      const DOOR_H = 14;
      // Walk from ground floor (visible[0]) upward.
      let cursorY = baseY - DOOR_H; // top of the door / bottom of the floors area
      for (let fi = 0; fi < visible.length; fi++) {
        const floor = visible[fi];
        const bandH = floorBandHeight(floor.totalTasks);
        const fyBottom = cursorY;
        const fyTop = cursorY - bandH;

        // Floor separator (skip the very top one)
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(baseX + 2, fyBottom - 1, b.baseWidth - 4, 1);

        // Dim the band background for the in-progress (current) floor so it
        // reads as a "partial" floor still under construction.
        if (floor.isCurrent) {
          ctx.fillStyle = "rgba(0,0,0,0.18)";
          ctx.fillRect(baseX + 1, fyTop, b.baseWidth - 2, bandH);
        }

        // Window grid — uniform sizes (WIN_W × WIN_H) regardless of project
        const cols = Math.min(MAX_COLS, Math.max(1, floor.totalTasks));
        const rows = rowsForFloor(floor.totalTasks);
        // Centre horizontally inside the building
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
              // Bright yellow lit window with a soft glow
              ctx.fillStyle = "rgba(255,235,120,0.35)";
              ctx.fillRect(wx - 1, wy - 1, WIN_W + 2, WIN_H + 2);
              ctx.fillStyle = "#FFE680";
            } else {
              // Dark blue/grey pending window
              ctx.fillStyle = floor.isCurrent ? "#0F172A" : "#1E293B";
            }
            ctx.fillRect(wx, wy, WIN_W, WIN_H);
            drawn++;
          }
        }

        cursorY = fyTop;
      }

      // Door
      const doorW = Math.min(14, b.baseWidth * 0.3);
      ctx.fillStyle = shade(baseColor, -35);
      ctx.fillRect(b.x - doorW / 2, baseY - DOOR_H, doorW, DOOR_H);

      if (b.isDelayed) {
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(baseX + 8, topY + 30);
        ctx.lineTo(baseX + 4, topY + 60);
        ctx.lineTo(baseX + 12, topY + 80);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(baseX + b.baseWidth - 10, topY + 50);
        ctx.lineTo(baseX + b.baseWidth - 4, topY + 90);
        ctx.stroke();
        ctx.fillStyle = "#F59E0B";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(b.x, topY - 22);
        ctx.lineTo(b.x - 7, topY - 10);
        ctx.lineTo(b.x + 7, topY - 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#000";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("!", b.x, topY - 12);
      }

      if (!b.isComplete && !b.isDelayed) {
        const craneTop = topY - 30;
        const craneArmEnd = baseX + b.baseWidth + 18;
        ctx.strokeStyle = "#FBBF24";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(baseX + b.baseWidth - 4, topY);
        ctx.lineTo(baseX + b.baseWidth - 4, craneTop);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(baseX + b.baseWidth - 4, craneTop);
        ctx.lineTo(craneArmEnd, craneTop);
        ctx.stroke();
        ctx.fillStyle = "#374151";
        ctx.fillRect(baseX + b.baseWidth - 12, craneTop - 4, 8, 6);
        const swing = Math.sin(time / 700 + b.x / 50) * 8;
        const loadX = craneArmEnd - 6 + swing;
        ctx.strokeStyle = "#9CA3AF";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(craneArmEnd - 6, craneTop);
        ctx.lineTo(loadX, craneTop + 18);
        ctx.stroke();
        ctx.fillStyle = "#92400E";
        ctx.fillRect(loadX - 4, craneTop + 18, 8, 6);
      }

      if (b.isComplete) {
        ctx.fillStyle = "#C9A84C";
        ctx.beginPath();
        ctx.moveTo(b.x, topY - 24);
        ctx.lineTo(b.x - 4, topY - 6);
        ctx.lineTo(b.x + 4, topY - 6);
        ctx.closePath();
        ctx.fill();
        // Star
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

      ctx.restore();
    }

    function tick(now: number) {
      const time = now - t0;
      ctx.clearRect(0, 0, VW, VH);

      // Sky + sun — drawn first, no transform needed
      drawSky();
      drawSun(time);

      // Everything else lives in canvas space directly. The container handles
      // horizontal scrolling via overflow-x, so we don't pan here.
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
    // Direct canvas-space coordinates — the container handles scrolling
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
    // Suppress click if the user dragged the map more than a few pixels
    if (dragStateRef.current.moved > 5) return;
    const b = pointToBuilding(e.clientX, e.clientY);
    if (b) setSelected(b);
  }

  // ─── Drag-to-scroll: native listeners on the container ──────────────
  // The drag handlers are SCOPED to containerRef and never bound to window
  // or document, so dragging on the page outside the frame is unaffected.
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

  if (status === "loading") return null;
  if (!session) redirect("/auth/login");

  return (
    // Single vertical scroll for the whole page. The city sits at the top
    // as a fixed-height block; the tasks list flows below it. As the user
    // scrolls down through the tasks, the city slides up out of view
    // naturally — no sticky / opacity tricks needed.
    <div className="flex flex-col h-full overflow-y-auto" dir="rtl">

      {/* Header — fixed, compact */}
      <div className="flex-shrink-0 px-6 pt-4 pb-2">
        <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
          <Building2 size={22} style={{ color: "#C9A84C" }} />
          مدينتي
        </h1>
      </div>

      {/* City frame — fixed height that scales with the viewport via clamp.
          Always 35vh, but never below 180 px and never above 400 px. */}
      {!projects && (
        <div
          className="flex-shrink-0 mx-4 lg:mx-6 bg-white rounded-2xl flex items-center justify-center"
          style={{ height: "clamp(180px, 35vh, 400px)", border: "1px solid #E2E0D8" }}
        >
          <Loader2 size={28} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      )}

      {projects && projects.length === 0 && (
        <div
          className="flex-shrink-0 mx-4 lg:mx-6 bg-white rounded-2xl flex flex-col items-center justify-center"
          style={{ height: "clamp(180px, 35vh, 400px)", border: "1px solid #E2E0D8" }}
        >
          <Building2 size={32} className="mb-2" style={{ color: "#D1D5DB" }} />
          <p className="text-sm" style={{ color: "#6B7280" }}>لا توجد مشاريع لعرضها بعد</p>
        </div>
      )}

      {layout && layout.buildings.length > 0 && (
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
          {/* Inner scrollable container — drag wired natively in useEffect */}
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

          {/* Fullscreen / exit-fullscreen button — top-end corner of the frame */}
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
              className="absolute top-4 left-4 z-10 flex items-center justify-center rounded-full transition-all hover:shadow-lg"
              style={{
                width: 40,
                height: 40,
                backgroundColor: "white",
                border: "1px solid #E2E0D8",
                color: "#1C1B2E",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>
      )}

      {/* Project picker — chips of projects the executor is involved in.
          Picking a chip switches MyTasksView below into project-focused
          mode (all tasks of that project, including blocked ones). */}
      {projects && projects.length > 0 && (
        <div className="flex-shrink-0 px-4 lg:px-6 mt-3">
          <div
            className="flex items-center gap-2 overflow-x-auto pb-2"
            style={{ scrollbarWidth: "thin" }}
          >
            {projects.map((p) => {
              const active = pickedProjectId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  // Toggle: clicking the active chip deselects it and falls
                  // back to the default "all my tasks" view. This is the
                  // way to get back to that state now that the explicit
                  // "كل مهامي" chip has been removed.
                  onClick={() => setPickedProjectId(active ? null : p.id)}
                  title={p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 max-w-[260px]"
                  style={
                    active
                      ? {
                          backgroundColor: "#5E5495",
                          color: "white",
                          boxShadow: "0 2px 6px rgba(94,84,149,0.3)",
                          border: "1px solid #5E5495",
                        }
                      : {
                          backgroundColor: "white",
                          color: "#1C1B2E",
                          border: "1px solid #E2E0D8",
                        }
                  }
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: active ? "#FFFFFF" : (p.department?.color || "#C9A84C") }}
                  />
                  <span className="truncate">{p.name}</span>
                  {p.projectCode && (
                    <span
                      className="text-[9px] font-mono font-bold flex-shrink-0 px-1 py-0.5 rounded"
                      style={{
                        backgroundColor: active ? "rgba(255,255,255,0.2)" : "rgba(94,84,149,0.1)",
                        color: active ? "#FFFFFF" : "#5E5495",
                      }}
                    >
                      {p.projectCode}
                    </span>
                  )}
                  <span
                    className="text-[10px] font-bold flex-shrink-0"
                    style={{ color: active ? "rgba(255,255,255,0.8)" : "#9CA3AF" }}
                  >
                    {p.completedTasks}/{p.totalTasks}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tasks — flow naturally below the city. The page-level scroll
          handles overflow, so as the user scrolls down through the tasks
          the city slides up and disappears.
          Re-mount via key when the picked project changes so the embedded
          tasks view fully resets its filters/pagination/state. */}
      <div className="flex-shrink-0 mt-1">
        <MyTasksView
          key={pickedProjectId || "__all__"}
          projectId={pickedProjectId || undefined}
        />
      </div>

      {/* Click popup */}
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
              <p className="text-xs mb-4" style={{ color: "#6B7280" }}>
                القسم: {selected.department.name}
              </p>
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
    </div>
  );
}
