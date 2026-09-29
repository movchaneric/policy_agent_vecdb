export interface KBChunk {
  source: string; // policy.pdf
  chunkId: number;
  text: string;
  embedding: number[];
}
