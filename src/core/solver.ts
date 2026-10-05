import { getValidMoves, hashState, isLevelComplete, tryMove } from './gameLogic';
import type { GameState, Move } from './types';

export interface SolveOptions {
  /** Ziyaret edilebilecek en fazla durum sayısı (performans güvenliği). */
  readonly maxStates?: number;
  /** En fazla hamle derinliği (performans güvenliği). */
  readonly maxDepth?: number;
}

export interface SolveResult {
  readonly solvable: boolean;
  /** BFS kullanıldığı için bulunursa EN KISA yoldur. Bulunamazsa null. */
  readonly path: readonly Move[] | null;
  readonly statesExplored: number;
  /** true ise maxStates/maxDepth sınırına takıldık: "çözülemez" DEĞİL, "bilinmiyor" anlamına gelir. */
  readonly truncated: boolean;
}

const DEFAULT_MAX_STATES = 200_000;
const DEFAULT_MAX_DEPTH = 500;

interface SearchNode {
  readonly state: GameState;
  readonly move: Move | null;
  readonly parent: number | null;
}

/**
 * Gerçek oyun motoruyla (tryMove/getValidMoves) BFS yapar; bulduğu yol -varsa- en kısa yoldur.
 * Büyük durum uzaylarında maxStates/maxDepth sınırına takılırsa truncated=true döner
 * (bu durumda "çözülemez" DEĞİL "bu bütçede kanıtlanamadı" demektir).
 */
export function solve(initial: GameState, options: SolveOptions = {}): SolveResult {
  const maxStates = options.maxStates ?? DEFAULT_MAX_STATES;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

  if (isLevelComplete(initial)) {
    return { solvable: true, path: [], statesExplored: 1, truncated: false };
  }

  const visited = new Set<string>([hashState(initial)]);
  const nodes: SearchNode[] = [{ state: initial, move: null, parent: null }];

  let frontierStart = 0;
  let frontierEnd = 1;
  let depth = 0;

  while (frontierStart < frontierEnd && depth < maxDepth && nodes.length < maxStates) {
    const levelEnd = frontierEnd;
    for (let i = frontierStart; i < levelEnd; i++) {
      const current = nodes[i];
      for (const move of getValidMoves(current.state)) {
        const outcome = tryMove(current.state, move);
        if (!outcome.ok) continue;

        const key = hashState(outcome.result.state);
        if (visited.has(key)) continue;
        visited.add(key);

        const nodeIndex = nodes.length;
        nodes.push({ state: outcome.result.state, move, parent: i });

        if (isLevelComplete(outcome.result.state)) {
          return {
            solvable: true,
            path: reconstructPath(nodes, nodeIndex),
            statesExplored: nodes.length,
            truncated: false,
          };
        }

        if (nodes.length >= maxStates) break;
      }
      if (nodes.length >= maxStates) break;
    }
    frontierStart = levelEnd;
    frontierEnd = nodes.length;
    depth++;
  }

  const exhausted = frontierStart >= frontierEnd;
  return {
    solvable: false,
    path: null,
    statesExplored: nodes.length,
    truncated: !exhausted,
  };
}

export interface ParResult {
  /** Hedef (par) hamle sayısı: BFS tamamlanabildiyse gerçek en kısa yol, aksi halde sertifika uzunluğu. */
  readonly par: number;
  /** true ise par, BFS ile KANITLANMIŞ en kısa yoldur; false ise bütçe yetmediği için doğrulanmış
   * sertifika uzunluğuna düşülmüştür (gerçek ama muhtemelen optimal olmayan bir çözüm). */
  readonly exact: boolean;
}

/**
 * Yıldız eşiği için "par" (hedef hamle sayısı) hesaplar. BFS verilen bütçede tamamlanırsa gerçek
 * en kısa yolu kullanır; tamamlanamazsa (büyük durum uzayı) doğrulanmış sertifika uzunluğuna düşer --
 * bu, 3 yıldızı biraz daha toleranslı yapar ama HER ZAMAN ulaşılabilir olmasını garanti eder.
 */
export function computePar(initial: GameState, certificateLength: number, maxStates: number): ParResult {
  const result = solve(initial, { maxStates });
  if (result.solvable && result.path) {
    return { par: result.path.length, exact: true };
  }
  return { par: certificateLength, exact: false };
}

function reconstructPath(nodes: readonly SearchNode[], endIndex: number): Move[] {
  const path: Move[] = [];
  let i: number | null = endIndex;
  while (i !== null) {
    const node: SearchNode = nodes[i];
    if (node.move) path.push(node.move);
    i = node.parent;
  }
  return path.reverse();
}
