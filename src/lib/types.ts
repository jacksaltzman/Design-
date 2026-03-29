// ── Core domain types ──

export interface Design {
  id: string;
  filename: string;
  source?: string;
  category?: string;
}

export interface Swipe {
  designId: string;
  liked: boolean;
  timestamp: number;
}

/** Bayesian taste vector — weights + diagonal covariance */
export interface TasteVector {
  weights: number[];
  uncertainty: number[];
  swipeCount: number;
}

export interface TasteAxis {
  name: string;
  lowLabel: string;
  highLabel: string;
  /** Direction vector in embedding space (high - low, normalized) */
  direction: number[];
  /** User's score on this axis after projection, range roughly [-1, 1] */
  score?: number;
}

export interface TasteProfile {
  axes: TasteAxisScore[];
  description: string;
  confidence: number;
  swipeCount: number;
}

export interface TasteAxisScore {
  name: string;
  lowLabel: string;
  highLabel: string;
  score: number; // [-1, 1]
}

// ── API types ──

export interface NextCardResponse {
  design: Design & { imageUrl: string };
  swipeCount: number;
  confidence: number;
}

export interface SwipeRequest {
  designId: string;
  liked: boolean;
}

export interface SwipeResponse {
  swipeCount: number;
}

// ── Embedding storage format ──

export interface EmbeddingIndex {
  dimension: number;
  embeddings: Record<string, number[]>;
}

export interface TasteAxesFile {
  axes: TasteAxis[];
}
