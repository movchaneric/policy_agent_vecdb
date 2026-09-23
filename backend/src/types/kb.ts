export interface KBChunk {
  namespace: string;
  source: string; // policy.pdf
  chunkId: number;
  text: string;
  embedding: number[];
}
