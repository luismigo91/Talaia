import type { Level } from "@/lib/api";

/**
 * Distintivo de nivel. El nombre va **siempre en texto** junto al color: un semáforo que
 * solo distingue por color no sirve para quien no distingue rojo y verde.
 */
export function LevelBadge({ level, title }: { level: Level; title?: string }) {
  return (
    <span className={`level ${level}`} title={title ?? `Nivel ${level}`}>
      <span className="dot" aria-hidden="true" />
      {level}
    </span>
  );
}
