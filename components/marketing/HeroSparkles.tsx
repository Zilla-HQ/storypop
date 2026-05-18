/**
 * Ambient hero sparkles — 9 tiny emojis drifting upward through the hero
 * section to give the page a passive sense of magic. Each one has its own
 * starting position, animation duration, and delay for a varied, non-looping
 * feel. Pure CSS — no JS animation cost.
 */
const SPARKLES = [
  { emoji: '✨', left: 6,  size: 18, delay: 0,   duration: 14 },
  { emoji: '⭐', left: 18, size: 16, delay: 3,   duration: 16 },
  { emoji: '💫', left: 32, size: 20, delay: 1.5, duration: 13 },
  { emoji: '✨', left: 47, size: 14, delay: 5,   duration: 17 },
  { emoji: '⭐', left: 60, size: 18, delay: 0.8, duration: 15 },
  { emoji: '🌟', left: 73, size: 16, delay: 4,   duration: 14 },
  { emoji: '✨', left: 85, size: 20, delay: 2.2, duration: 16 },
  { emoji: '💫', left: 93, size: 14, delay: 6,   duration: 18 },
  { emoji: '⭐', left: 25, size: 14, delay: 7.5, duration: 17 },
];

export function HeroSparkles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {SPARKLES.map((s, i) => (
        <span
          key={i}
          className="hero-sparkle"
          style={{
            left: `${s.left}%`,
            bottom: '-30px',
            fontSize: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        >
          {s.emoji}
        </span>
      ))}
    </div>
  );
}
