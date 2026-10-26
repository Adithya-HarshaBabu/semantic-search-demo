// Runs the embedding model off the main thread so typing never janks.
import { pipeline, env } from '@huggingface/transformers';
import { products } from './products.js';

env.allowLocalModels = false;

const MODEL = 'Xenova/all-MiniLM-L6-v2';
let extractor;
let corpus; // [{ id, vector: Float32Array }]

const toText = (p) => `${p.name}. ${p.category}. ${p.description}`;

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s; // vectors are normalized, so dot product = cosine similarity
}

async function init() {
  const t0 = performance.now();
  extractor = await pipeline('feature-extraction', MODEL, {
    dtype: 'q8',
    progress_callback: (p) => {
      if (p.status === 'progress' && p.file?.endsWith('.onnx')) {
        self.postMessage({ type: 'progress', progress: p.progress });
      }
    },
  });
  self.postMessage({ type: 'indexing' });
  const output = await extractor(products.map(toText), { pooling: 'mean', normalize: true });
  const [n, dim] = output.dims;
  corpus = products.map((p, i) => ({ id: p.id, vector: output.data.slice(i * dim, (i + 1) * dim) }));
  self.postMessage({ type: 'ready', ms: Math.round(performance.now() - t0), dims: dim, count: n });
}

async function search(query, requestId) {
  const t0 = performance.now();
  const q = await extractor(query, { pooling: 'mean', normalize: true });
  const results = corpus
    .map((d) => ({ id: d.id, score: dot(q.data, d.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  self.postMessage({ type: 'results', requestId, results, ms: Math.round(performance.now() - t0) });
}

self.onmessage = (e) => {
  const { type, query, requestId } = e.data;
  if (type === 'init') init().catch((err) => self.postMessage({ type: 'error', message: err.message }));
  if (type === 'search') search(query, requestId).catch((err) => self.postMessage({ type: 'error', message: err.message }));
};
