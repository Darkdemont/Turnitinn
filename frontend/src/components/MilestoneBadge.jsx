import { Sparkles, Trophy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const MILESTONES = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function milestoneReached(count) {
  let current = 0;
  for (let i = 0; i < MILESTONES.length; i += 1) {
    if (count >= MILESTONES[i]) {
      current = MILESTONES[i];
    } else {
      break;
    }
  }
  return current;
}

const CONFETTI_COLORS = ['#22d3ee', '#fbbf24', '#34d399', '#f97316', '#a78bfa'];
const CONFETTI_PIECES = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 53) % 100}%`,
  delay: `${(i % 6) * 90}ms`,
  duration: `${1500 + (i % 5) * 180}ms`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  rotate: `${(i * 47) % 360}deg`
}));

export default function MilestoneBadge({
  count,
  label = 'reports completed successfully',
  storageKey = 'turnit_milestone_seen',
  floor = 1000
}) {
  const [displayCount, setDisplayCount] = useState(0);
  const [fillPct, setFillPct] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const previousCountRef = useRef(0);
  const rafRef = useRef(null);

  const effectiveCount = typeof count === 'number' && !Number.isNaN(count) ? Math.max(count, floor) : null;

  useEffect(() => {
    if (effectiveCount === null) return undefined;

    const startValue = previousCountRef.current;
    const endValue = effectiveCount;
    const startTime = performance.now();
    const duration = 1400;

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      setDisplayCount(Math.round(startValue + (endValue - startValue) * eased));
      setFillPct(eased * 100);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        previousCountRef.current = endValue;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [effectiveCount]);

  useEffect(() => {
    if (effectiveCount === null) return;
    const current = milestoneReached(effectiveCount);
    if (current === 0) return;

    let lastSeen = 0;
    try {
      lastSeen = Number(window.localStorage.getItem(storageKey) || 0);
    } catch {
      lastSeen = 0;
    }

    if (current > lastSeen) {
      setCelebrating(true);
      try {
        window.localStorage.setItem(storageKey, String(current));
      } catch {
        // ignore storage failures (private browsing, etc.)
      }
      const timer = window.setTimeout(() => setCelebrating(false), 3200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [effectiveCount, storageKey]);

  if (effectiveCount === null || effectiveCount <= 0) return null;

  return (
    <section className={`milestone-badge${celebrating ? ' is-celebrating' : ''}`} aria-label="Platform milestone">
      {celebrating ? (
        <div className="milestone-confetti" aria-hidden="true">
          {CONFETTI_PIECES.map((piece, index) => (
            <span
              key={index}
              style={{
                left: piece.left,
                animationDelay: piece.delay,
                animationDuration: piece.duration,
                background: piece.color,
                '--rotate': piece.rotate
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="milestone-badge__icon">
        <Trophy size={26} strokeWidth={2} />
      </div>

      <div className="milestone-badge__body">
        <div className="milestone-badge__eyebrow">
          {celebrating ? (
            <>
              <Sparkles size={14} /> New milestone unlocked!
            </>
          ) : (
            'Platform achievement'
          )}
        </div>
        <div className="milestone-badge__count">
          {displayCount.toLocaleString()}
          <span className="milestone-badge__plus">+</span>
        </div>
        <div className="milestone-badge__label">{label}</div>

        <div className="milestone-badge__progress-track">
          <div className="milestone-badge__progress-fill" style={{ width: `${fillPct}%` }} />
        </div>
      </div>
    </section>
  );
}
