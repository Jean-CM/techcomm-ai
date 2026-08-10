"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, Inbox, Play, Pause, Loader2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Status chip                                                         */
/* ------------------------------------------------------------------ */

export type Tone = "good" | "warning" | "bad" | "info" | "accent" | "neutral";

export function StatusBadge({
  tone = "neutral",
  plain = false,
  children,
}: {
  tone?: Tone;
  plain?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`tc-chip is-${tone}${plain ? " tc-chip-plain" : ""}`}>{children}</span>
  );
}

/* ------------------------------------------------------------------ */
/* KPI / metric card                                                   */
/* ------------------------------------------------------------------ */

export function Kpi({
  label,
  value,
  icon,
  tone = "accent",
  sub,
  spark,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: "good" | "warning" | "bad" | "info" | "accent";
  sub?: ReactNode;
  spark?: number[];
}) {
  const max = spark && spark.length ? Math.max(...spark, 1) : 1;
  return (
    <article className="tc-kpi">
      <div className="tc-kpi-top">
        <span className="tc-kpi-label">{label}</span>
        <span className={`tc-kpi-icon is-${tone}`}>{icon}</span>
      </div>
      <div className="tc-kpi-value">{value}</div>
      {spark && spark.length ? (
        <div className="tc-kpi-spark" aria-hidden="true">
          {spark.map((n, i) => (
            <span key={i} style={{ height: `${Math.max(8, (n / max) * 100)}%` }} />
          ))}
        </div>
      ) : null}
      {sub ? <div className="tc-kpi-sub">{sub}</div> : null}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

export function EmptyState({
  title,
  message,
  icon,
}: {
  title: string;
  message?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="tc-empty">
      <span className="tc-empty-icon">{icon ?? <Inbox size={20} />}</span>
      <strong>{title}</strong>
      {message ? <span>{message}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table skeleton                                                      */
/* ------------------------------------------------------------------ */

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ display: "grid", gap: 10, padding: 18 }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="tc-skeleton" style={{ height: 14, width: c === 0 ? "60%" : "85%" }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overlay hook — Escape + scroll lock                                 */
/* ------------------------------------------------------------------ */

function useOverlay(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

/* ------------------------------------------------------------------ */
/* Right-side detail drawer                                            */
/* ------------------------------------------------------------------ */

export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  wide = false,
  headerExtra,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  wide?: boolean;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  useOverlay(open, onClose);
  if (!open) return null;
  return (
    <>
      <div className="tc-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className={`tc-drawer tc-scroll${wide ? " tc-drawer-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="tc-drawer-head">
          <div>
            {eyebrow ? <span className="tc-card-title-eyebrow">{eyebrow}</span> : null}
            <h2>{title}</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {headerExtra}
            <button type="button" className="tc-iconbtn" onClick={onClose} aria-label="Cerrar">
              <X />
            </button>
          </div>
        </header>
        <div className="tc-drawer-body tc-scroll">{children}</div>
      </aside>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Focused modal (small edits)                                         */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  useOverlay(open, onClose);
  if (!open) return null;
  return (
    <div className="tc-modal-backdrop" onClick={onClose}>
      <div className="tc-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="tc-drawer-head">
          <div>
            {eyebrow ? <span className="tc-card-title-eyebrow">{eyebrow}</span> : null}
            <h2>{title}</h2>
          </div>
          <button type="button" className="tc-iconbtn" onClick={onClose} aria-label="Cerrar">
            <X />
          </button>
        </header>
        <div className="tc-drawer-body tc-scroll">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Premium audio player — plays a signed URL, requested on demand      */
/* ------------------------------------------------------------------ */

function fmt(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function AudioPlayer({ src, context }: { src: string; context?: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onTime = () => setCurrent(el.currentTime);
    const onMeta = () => {
      setDuration(el.duration);
      setReady(true);
    };
    const onEnd = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("ended", onEnd);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    void el.play().catch(() => setPlaying(false));
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [src]);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    const track = trackRef.current;
    if (!el || !track || !Number.isFinite(el.duration)) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = pct * el.duration;
    setCurrent(el.currentTime);
  };

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="tc-audio">
      <button type="button" className="tc-audio-btn" onClick={toggle} disabled={!ready} aria-label={playing ? "Pausar" : "Reproducir"}>
        {!ready ? <Loader2 className="tc-spin" /> : playing ? <Pause /> : <Play />}
      </button>
      <div className="tc-audio-main">
        <div className="tc-audio-meta">
          <span className="tc-audio-ctx">{context ?? "Grabación de la llamada"}</span>
          <span className="tc-audio-time">
            {fmt(current)} / {ready ? fmt(duration) : "--:--"}
          </span>
        </div>
        <div className="tc-audio-track" ref={trackRef} onClick={seek} role="progressbar" aria-valuenow={Math.round(pct)}>
          <div className="tc-audio-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <audio ref={ref} src={src} preload="metadata" />
    </div>
  );
}
