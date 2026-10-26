# AI Semantic Search Demo

**Live demo:** https://semantic-search-demo-adithya.vercel.app

Search that understands what you *mean*, not just what you type. This React app compares classic
keyword search with AI semantic search side by side, over a small outdoor-gear catalog. The AI model
runs **entirely in the browser**: no server, no API key, and no data leaves the device.

Try "bugs keep biting me": keyword search returns socks and a beanie (they contain the word "keep"),
while semantic search returns insect repellent.

## How it works

1. **Embed the catalog.** On load, a Web Worker runs [`all-MiniLM-L6-v2`](https://huggingface.co/Xenova/all-MiniLM-L6-v2)
   (quantized ONNX, via [Transformers.js](https://github.com/huggingface/transformers.js)) to turn each
   product into a 384-dimension vector.
2. **Embed the query.** Typing is debounced, and stale responses are discarded with request IDs, so results
   never flicker back to an old query. All inference happens off the main thread.
3. **Rank by cosine similarity.** Vectors are normalized, so a dot product gives the similarity score.

In production the same pattern is usually backed by a hosted embedding model (e.g. Gemini Embedding on
Vertex AI) and a vector database. Swapping the worker for an API call is the only change the UI needs.

## Stack

React 18 · Vite · Transformers.js (ONNX Runtime Web / WASM) · Web Workers · plain CSS (light & dark)

## Run locally

```bash
npm install
npm run dev
```

## Files

- `src/search.worker.js`: loads the model, embeds products, answers queries
- `src/App.jsx`: UI, keyword search, worker hook with debouncing and stale-request handling
- `src/products.js`: the demo catalog and example queries

---

Built by [Adithya Harsha Babu](https://adithya-portfolio-beige.vercel.app), a senior React engineer
available for freelance work.
