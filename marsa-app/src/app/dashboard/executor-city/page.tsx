"use client";

/**
 * Unified executor workspace at /dashboard/executor-city.
 *
 * Toggles between two views:
 *   • مدينتي  — gamified canvas city. Each project is a building whose floors
 *     come from its services and whose windows-per-floor come from each
 *     service's tasks (lit = done, dark = remaining). The canvas resizes
 *     with the browser viewport.
 *   • مهامي  — the regular tasks list, embedded via the MyTasksView component.
 *
 * Default view is the city. The /dashboard/my-tasks route now redirects here.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Loader2, X, Building2, ListChecks } from "lucide-react";
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
}

interface BuildingLayout extends ApiProject {
  x: number;          // ground-level center x in canvas px
  baseWidth: number;
  baseHeight: number; // total height in canvas px
  floors: FloorLayout[];
  color: string;
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
  const [view, setView] = useState<"city" | "tasks">("city");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [projects, setProjects] = useState<ApiProject[] | null>(null);
  const [selected, setSelected] = useState<BuildingLayout | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<{ w: number; h: number }>({
    w: typeof window !== "undefined" ? window.innerWidth : 1280,
    h: typeof window !== "undefined" ? window.innerHeight : 720,
  });

  // Fetch projects with services for the city
  useEffect(() => {
    if (view !== "city") return;
    fetch("/api/projects?withServices=true")
      .then((r) => r.json())
      .then((d) => setProjects(Array.isArray(d) ? d : []))
      .catch(() => setProjects([]));
  }, [view]);

  // Track viewport size for responsive canvas
  useEffect(() => {
    function onResize() {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Compute layout
  const layout = useMemo(() => {
    if (!projects) return null;

    // Canvas occupies most of the viewport, but we also clamp to a sensible
    // visible "stage". Buildings flow horizontally; if the row gets too wide
    // for the viewport, the container scrolls.
    const stageHeight = Math.max(420, Math.min(viewport.h - 280, 720));
    const sky = Math.round(stageHeight * 0.55);
    const groundOffset = 60;
    const padX = 60;
    // Slot per building scales with viewport — narrower screens get tighter
    // spacing so a few buildings still fit on one row.
    const slot = Math.max(110, Math.min(170, Math.round(viewport.w / 9)));
    // Stage width = viewport width; if buildings exceed it, we widen.
    const minWidth = Math.max(800, viewport.w - 120);
    const computedWidth = padX * 2 + projects.length * slot;
    const totalWidth = Math.max(minWidth, computedWidth);

    // Use the longest service-list so heights stay comparable across projects
    const maxFloors = Math.max(1, ...projects.map((p) => p.services?.length || 1));

    const buildings: BuildingLayout[] = projects.map((p, idx) => {
      const services = p.services || [];
      const floors: FloorLayout[] = services.map((s) => {
        const total = s.tasks?.length || 0;
        const done = s.tasks?.filter((t) => t.status === "DONE").length || 0;
        return {
          serviceId: s.id,
          serviceName: s.name,
          totalTasks: total,
          doneTasks: done,
          isComplete: total > 0 && done >= total,
        };
      });

      // Floor layout: each floor is a horizontal band; height per floor is
      // capped so very tall buildings don't blow out the stage.
      const floorCount = Math.max(1, floors.length);
      const floorHeight = Math.max(22, Math.min(36, Math.round(220 / Math.max(2, maxFloors))));
      const baseHeight = Math.max(80, floorCount * floorHeight + 18); // +18 for roof slab room

      // Width based on max windows in any floor (so the widest service fits)
      const maxWindows = floors.reduce((m, f) => Math.max(m, f.totalTasks || 1), 1);
      const windowsPerRow = Math.min(5, Math.max(2, maxWindows));
      const baseWidth = 36 + windowsPerRow * 16;

      const isComplete = floors.length > 0 && floors.every((f) => f.isComplete);
      const now = Date.now();
      const isDelayed =
        !isComplete &&
        ((p.endDate && new Date(p.endDate).getTime() < now) || p.status === "ON_HOLD");

      return {
        ...p,
        x: padX + idx * slot + slot / 2,
        baseWidth,
        baseHeight,
        floors,
        color: pickColor(p.id, idx, p.department?.color),
        isComplete,
        isDelayed,
      };
    });

    return {
      width: totalWidth,
      height: stageHeight,
      sky,
      groundOffset,
      buildings,
    };
  }, [projects, viewport]);

  // ─── Animation loop ───
  useEffect(() => {
    if (view !== "city" || !layout) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = layout.width * dpr;
    canvas.height = layout.height * dpr;
    canvas.style.width = `${layout.width}px`;
    canvas.style.height = `${layout.height}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    type Cloud = { x: number; y: number; scale: number; speed: number };
    type Car = { x: number; y: number; speed: number; color: string; dir: 1 | -1 };
    type Tree = { x: number; phase: number; scale: number };
    type Flower = { x: number; y: number; color: string };

    const W = layout.width;
    const H = layout.height;
    const groundY = layout.sky;
    const roadY = groundY + 30;
    const roadHeight = 38;

    const clouds: Cloud[] = Array.from({ length: 5 }, (_, i) => ({
      x: (i / 5) * W + Math.random() * 80,
      y: 40 + Math.random() * 90,
      scale: 0.7 + Math.random() * 0.6,
      speed: 0.12 + Math.random() * 0.1,
    }));

    const cars: Car[] = Array.from({ length: 6 }, (_, i) => ({
      x: (i / 6) * W + Math.random() * 100,
      y: roadY + (i % 2 === 0 ? 5 : roadHeight - 18),
      speed: 1.2 + Math.random() * 1.0,
      color: ["#DC2626", "#2563EB", "#059669", "#C9A84C", "#7C3AED", "#0891B2"][i % 6],
      dir: i % 2 === 0 ? 1 : -1,
    }));

    const trees: Tree[] = Array.from({ length: Math.ceil(W / 90) }, (_, i) => ({
      x: 30 + i * 90 + Math.random() * 30,
      phase: Math.random() * Math.PI * 2,
      scale: 0.9 + Math.random() * 0.4,
    }));

    const flowers: Flower[] = Array.from({ length: Math.ceil(W / 30) }, (_, i) => ({
      x: i * 30 + Math.random() * 20,
      y: roadY + roadHeight + 18 + Math.random() * 20,
      color: ["#EF4444", "#F59E0B", "#EC4899", "#FBBF24", "#A855F7"][i % 5],
    }));

    // Rocket state — fast horizontal flight with smoke trail
    let rocketX = -120;
    let rocketY = 80;
    const rocketSpeed = 2.5; // faster than the old plane
    const rocketSmoke: { x: number; y: number; age: number; size: number }[] = [];

    let raf = 0;
    const t0 = performance.now();

    function drawSky() {
      const grd = ctx.createLinearGradient(0, 0, 0, layout!.sky);
      grd.addColorStop(0, "#7CC4F0");
      grd.addColorStop(0.6, "#B8E1F5");
      grd.addColorStop(1, "#E0F2FE");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, layout!.sky);
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
      for (let x = 0; x <= W; x += 40) {
        const y = layout!.sky - 20 - Math.sin(x / 60) * 12;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, layout!.sky);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#3E6B36";
      for (let x = 20; x < W; x += 30) {
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
      for (let x = 0; x <= W; x += 8) {
        const y = layout!.sky + Math.sin((x + time / 30) / 25) * 1.5;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#689F38";
      ctx.fillRect(0, layout!.sky + 18, W, 12);
    }

    function drawRoad() {
      ctx.fillStyle = "#374151";
      ctx.fillRect(0, roadY, W, roadHeight);
      ctx.fillStyle = "#9CA3AF";
      ctx.fillRect(0, roadY + roadHeight / 2 - 1, W, 2);
      ctx.fillStyle = "#FBBF24";
      for (let x = 0; x < W; x += 30) {
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

    function drawRocket(time: number) {
      // Smoke trail (drawn first, so the rocket sits on top)
      for (const p of rocketSmoke) {
        const alpha = Math.max(0, 0.45 - p.age / 80);
        ctx.fillStyle = `rgba(180,180,200,${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + p.age * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }

      // Rocket body — pointed nose, dark menacing palette, fins, flickering flame
      ctx.save();
      ctx.translate(rocketX, rocketY);

      // Flame (at the tail = left side since rocket flies right)
      const flicker = 0.7 + Math.sin(time / 60) * 0.25 + Math.random() * 0.1;
      const flameLen = 22 * flicker;
      const grad = ctx.createLinearGradient(-flameLen, 0, 4, 0);
      grad.addColorStop(0, "rgba(255,80,0,0)");
      grad.addColorStop(0.5, "rgba(255,140,0,0.9)");
      grad.addColorStop(1, "rgba(255,235,0,1)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(-flameLen, 0);
      ctx.lineTo(0, 5);
      ctx.closePath();
      ctx.fill();

      // Inner brighter flame core
      ctx.fillStyle = "rgba(255,255,200,0.9)";
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.lineTo(-flameLen * 0.55, 0);
      ctx.lineTo(0, 3);
      ctx.closePath();
      ctx.fill();

      // Body cylinder
      const bodyGrad = ctx.createLinearGradient(0, -7, 0, 7);
      bodyGrad.addColorStop(0, "#9CA3AF");
      bodyGrad.addColorStop(0.5, "#1F2937");
      bodyGrad.addColorStop(1, "#111827");
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.roundRect(0, -7, 38, 14, 2);
      ctx.fill();

      // Red warning stripes
      ctx.fillStyle = "#DC2626";
      ctx.fillRect(8, -7, 4, 14);
      ctx.fillRect(20, -7, 4, 14);

      // Pointed nose cone
      ctx.fillStyle = "#DC2626";
      ctx.beginPath();
      ctx.moveTo(38, -7);
      ctx.lineTo(54, 0);
      ctx.lineTo(38, 7);
      ctx.closePath();
      ctx.fill();
      // Nose tip highlight
      ctx.fillStyle = "#7F1D1D";
      ctx.beginPath();
      ctx.moveTo(48, -2);
      ctx.lineTo(54, 0);
      ctx.lineTo(48, 2);
      ctx.closePath();
      ctx.fill();

      // Top fin
      ctx.fillStyle = "#1F2937";
      ctx.beginPath();
      ctx.moveTo(2, -7);
      ctx.lineTo(-6, -14);
      ctx.lineTo(10, -7);
      ctx.closePath();
      ctx.fill();
      // Bottom fin
      ctx.beginPath();
      ctx.moveTo(2, 7);
      ctx.lineTo(-6, 14);
      ctx.lineTo(10, 7);
      ctx.closePath();
      ctx.fill();

      // Window
      ctx.fillStyle = "#FBBF24";
      ctx.beginPath();
      ctx.arc(28, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#7C2D12";
      ctx.lineWidth = 1;
      ctx.stroke();

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

      // Floors — one band per service. Each band carries that service's
      // task windows (lit = done) plus a thin separator line.
      const floors = b.floors.length > 0 ? b.floors : [{
        serviceId: "ghost",
        serviceName: "",
        totalTasks: 1,
        doneTasks: 0,
        isComplete: false,
      }];
      const padX = 5;
      const usableHeight = b.baseHeight - 18; // leave room for door at the bottom
      const floorHeight = usableHeight / floors.length;

      for (let fi = 0; fi < floors.length; fi++) {
        const floor = floors[fi];
        // Floor sits from top down: floor 0 = ground floor (closest to baseY),
        // floor N = top. Iterate so the visual order matches "first service is
        // ground floor".
        const floorIndex = floors.length - 1 - fi;
        const fyTop = topY + 4 + floorIndex * floorHeight;

        // Faint separator line between floors
        if (floorIndex < floors.length - 1) {
          ctx.fillStyle = "rgba(0,0,0,0.18)";
          ctx.fillRect(baseX + 2, fyTop, b.baseWidth - 4, 1);
        }

        const total = Math.max(1, floor.totalTasks);
        const cols = Math.min(5, Math.max(1, total));
        const rows = Math.ceil(total / cols);
        const gridW = b.baseWidth - padX * 2;
        const gridH = floorHeight - 4;
        const cellW = gridW / cols;
        const cellH = gridH / rows;
        const winW = Math.max(3, cellW * 0.6);
        const winH = Math.max(3, cellH * 0.6);
        let drawn = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (drawn >= total) break;
            const wx = baseX + padX + c * cellW + (cellW - winW) / 2;
            const wy = fyTop + 2 + r * cellH + (cellH - winH) / 2;
            const lit = drawn < floor.doneTasks;
            if (lit) {
              ctx.fillStyle = "rgba(255,235,150,0.35)";
              ctx.fillRect(wx - 1, wy - 1, winW + 2, winH + 2);
              ctx.fillStyle = "#FFE680";
            } else {
              ctx.fillStyle = "rgba(0,0,0,0.45)";
            }
            ctx.fillRect(wx, wy, winW, winH);
            drawn++;
          }
        }
      }

      // Door
      const doorW = Math.min(14, b.baseWidth * 0.3);
      ctx.fillStyle = shade(baseColor, -35);
      ctx.fillRect(b.x - doorW / 2, baseY - 14, doorW, 14);

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
      ctx.clearRect(0, 0, W, H);

      drawSky();
      drawSun(time);

      // Clouds
      for (const c of clouds) {
        c.x -= c.speed;
        if (c.x < -80) c.x = W + 80;
        drawCloud(c);
      }

      // Rocket — fast, with smoke trail
      rocketX += rocketSpeed;
      if (rocketX > W + 80) {
        rocketX = -120;
        rocketY = 50 + Math.random() * 70;
      }
      // Emit smoke from the tail (left of the rocket = current x)
      rocketSmoke.push({ x: rocketX - 2, y: rocketY + (Math.random() * 4 - 2), age: 0, size: 3 });
      for (const p of rocketSmoke) p.age++;
      while (rocketSmoke.length > 80) rocketSmoke.shift();
      drawRocket(time);

      drawForest();
      drawGround(time);
      drawRoad();

      for (const car of cars) {
        car.x += car.speed * car.dir;
        if (car.dir === 1 && car.x > W + 30) car.x = -40;
        if (car.dir === -1 && car.x < -40) car.x = W + 30;
        drawCar(car);
      }

      for (const b of layout!.buildings) drawBuilding(b, time);

      for (const tree of trees) drawStreetTree(tree, time);
      for (const f of flowers) drawFlower(f);

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [view, layout, hoveredId]);

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

  return (
    <div className="p-8" dir="rtl">
      {/* Header + view toggle */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
            <Building2 size={24} style={{ color: "#C9A84C" }} />
            مدينتي
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            كل مشروع مبنى — كل خدمة طابق، ونوافذ كل طابق هي مهامها
          </p>
        </div>

        {/* View toggle */}
        <div className="flex p-1 rounded-xl" style={{ backgroundColor: "#F0EEF5", border: "1px solid #E2E0D8" }}>
          <button
            type="button"
            onClick={() => setView("city")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={
              view === "city"
                ? { backgroundColor: "#5E5495", color: "white", boxShadow: "0 2px 6px rgba(94,84,149,0.3)" }
                : { backgroundColor: "transparent", color: "#6B7280" }
            }
          >
            <Building2 size={16} />
            مدينتي
          </button>
          <button
            type="button"
            onClick={() => setView("tasks")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={
              view === "tasks"
                ? { backgroundColor: "#5E5495", color: "white", boxShadow: "0 2px 6px rgba(94,84,149,0.3)" }
                : { backgroundColor: "transparent", color: "#6B7280" }
            }
          >
            <ListChecks size={16} />
            مهامي
          </button>
        </div>
      </div>

      {/* Tasks view — embed the existing tasks page content */}
      {view === "tasks" && (
        <div className="-mx-8 -mt-2">
          <MyTasksView />
        </div>
      )}

      {/* City view */}
      {view === "city" && (
        <>
          {!projects && (
            <div className="bg-white rounded-2xl p-12 flex justify-center" style={{ border: "1px solid #E2E0D8" }}>
              <Loader2 size={32} className="animate-spin" style={{ color: "#C9A84C" }} />
            </div>
          )}

          {projects && projects.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center" style={{ border: "1px solid #E2E0D8" }}>
              <Building2 size={40} className="mx-auto mb-3" style={{ color: "#D1D5DB" }} />
              <p style={{ color: "#6B7280" }}>لا توجد مشاريع لعرضها بعد</p>
            </div>
          )}

          {layout && layout.buildings.length > 0 && (
            <>
              <div
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
                {layout.buildings.map((b) => {
                  const completedFloors = b.floors.filter((f) => f.isComplete).length;
                  return (
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
                          {completedFloors}/{b.floors.length} طابق
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
                        {b.completedTasks}/{b.totalTasks} مهمة • {b.progress}%
                      </p>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

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
