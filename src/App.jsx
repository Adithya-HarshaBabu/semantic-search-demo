import { useEffect, useMemo, useRef, useState } from 'react';
import { products, exampleQueries } from './products.js';

const PORTFOLIO = 'https://adithya-portfolio-beige.vercel.app';
const REPO = 'https://github.com/Adithya-HarshaBabu/semantic-search-demo';

const byId = Object.fromEntries(products.map((p) => [p.id, p]));
const STOPWORDS = new Set('a an and the for to of in on my me i if with is it at by or from get going no some something'.split(' '));

// Classic keyword search: counts query words that appear as whole words in the product text.
function keywordSearch(query) {
  const terms = query.toLowerCase().split(/\W+/).filter((t) => t && !STOPWORDS.has(t));
  if (!terms.length) return [];
  return products
    .map((p) => {
      const words = new Set(`${p.name} ${p.category} ${p.description}`.toLowerCase().split(/\W+/));
      const hits = terms.filter((t) => words.has(t)).length;
      return { id: p.id, score: hits / terms.length };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function useSemanticSearch(query) {
  const worker = useRef(null);
  const lastRequest = useRef(0);
  const [status, setStatus] = useState({ phase: 'loading', progress: 0 });
  const [results, setResults] = useState([]);
  const [latency, setLatency] = useState(null);

  useEffect(() => {
    const w = new Worker(new URL('./search.worker.js', import.meta.url), { type: 'module' });
    w.onmessage = ({ data }) => {
      if (data.type === 'progress') setStatus({ phase: 'loading', progress: data.progress });
      if (data.type === 'indexing') setStatus({ phase: 'indexing' });
      if (data.type === 'ready') setStatus({ phase: 'ready', ms: data.ms, dims: data.dims, count: data.count });
      if (data.type === 'error') setStatus({ phase: 'error', message: data.message });
      // Ignore responses for queries the user has already typed past.
      if (data.type === 'results' && data.requestId === lastRequest.current) {
        setResults(data.results);
        setLatency(data.ms);
      }
    };
    w.postMessage({ type: 'init' });
    worker.current = w;
    return () => w.terminate();
  }, []);

  useEffect(() => {
    if (status.phase !== 'ready') return;
    if (!query.trim()) { setResults([]); setLatency(null); return; }
    const t = setTimeout(() => {
      const requestId = ++lastRequest.current;
      worker.current.postMessage({ type: 'search', query, requestId });
    }, 200);
    return () => clearTimeout(t);
  }, [query, status.phase]);

  return { status, results, latency };
}

function ResultList({ results, empty, accent }) {
  if (!results.length) return <p className="empty">{empty}</p>;
  return (
    <ol className="results">
      {results.map(({ id, score }) => {
        const p = byId[id];
        return (
          <li key={id} className="result">
            <span className="emoji" aria-hidden>{p.emoji}</span>
            <div className="result-body">
              <div className="result-top">
                <strong>{p.name}</strong>
                <span className="price">${p.price}</span>
              </div>
              <p>{p.description}</p>
              <div className="score">
                <div className="bar"><span className={accent} style={{ width: `${Math.max(4, Math.min(100, score * 100))}%` }} /></div>
                <span className="score-num">{score.toFixed(2)}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StatusLine({ status }) {
  if (status.phase === 'loading') {
    return (
      <div className="status">
        <span>Downloading the AI model (~23 MB, cached after the first visit)… {Math.round(status.progress || 0)}%</span>
        <div className="bar"><span className="ai" style={{ width: `${status.progress || 0}%` }} /></div>
      </div>
    );
  }
  if (status.phase === 'indexing') return <div className="status">Embedding {products.length} products…</div>;
  if (status.phase === 'error') return <div className="status error">Couldn’t load the model: {status.message}</div>;
  return (
    <div className="status ready">
      <span className="dot" /> Model ready in {(status.ms / 1000).toFixed(1)}s · {status.count} products indexed ·{' '}
      {status.dims}-dimension embeddings · running 100% in your browser
    </div>
  );
}

export default function App() {
  const [query, setQuery] = useState(exampleQueries[0]);
  const { status, results: semantic, latency } = useSemanticSearch(query);
  const keyword = useMemo(() => keywordSearch(query), [query]);
  const ready = status.phase === 'ready';

  return (
    <>
      <header className="top">
        <div className="container top-inner">
          <a href={PORTFOLIO} className="logo">Adithya<span>.</span></a>
          <nav>
            <a href={REPO} target="_blank" rel="noreferrer">Source code</a>
            <a href={`${PORTFOLIO}/#contact`} className="btn btn-primary btn-sm">Hire me</a>
          </nav>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <span className="eyebrow">Demo · React + in-browser AI</span>
          <h1>Search that understands <span className="grad">what you mean</span>, not just what you type.</h1>
          <p className="lead">
            Type what you need in plain English. Keyword search only matches exact words; AI semantic
            search compares <em>meaning</em> using a sentence-embedding model that runs entirely in your
            browser: no server, no API key, no data leaves your device.
          </p>
        </section>

        <section className="search card">
          <StatusLine status={status} />
          <input
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe what you’re looking for…"
            aria-label="Search products"
          />
          <div className="chips">
            {exampleQueries.map((q) => (
              <button key={q} className={`chip ${q === query ? 'active' : ''}`} onClick={() => setQuery(q)}>{q}</button>
            ))}
          </div>
        </section>

        <section className="compare">
          <div className="col">
            <div className="col-head">
              <h2>Keyword search</h2>
              <span className="pill muted">exact word match</span>
            </div>
            <ResultList results={keyword} accent="kw" empty="No products contain those exact words." />
          </div>
          <div className="col">
            <div className="col-head">
              <h2>AI semantic search</h2>
              <span className="pill ai">{ready && latency != null ? `${latency} ms` : 'meaning match'}</span>
            </div>
            {ready
              ? <ResultList results={semantic} accent="ai" empty="Type something to search." />
              : <p className="empty">Loading model…</p>}
          </div>
        </section>

        <section className="how">
          <h2>How it works</h2>
          <div className="steps">
            <div className="step"><span>01</span><h3>Embed the catalog</h3><p>On load, a Web Worker runs <code>all-MiniLM-L6-v2</code> (quantized ONNX via Transformers.js) to turn each product into a 384-number vector that captures its meaning.</p></div>
            <div className="step"><span>02</span><h3>Embed the query</h3><p>As you type (debounced, with stale responses dropped), your query is embedded the same way, off the main thread so the UI never freezes.</p></div>
            <div className="step"><span>03</span><h3>Rank by similarity</h3><p>Products are ranked by cosine similarity to your query, so “bugs keep biting me” finds insect repellent even though no words overlap.</p></div>
          </div>
          <p className="note">
            The same technique powers semantic retrieval in production RAG systems, typically with a vector database and a hosted embedding model (e.g. Gemini Embedding on Vertex AI) instead of an in-browser one.
          </p>
        </section>

        <section className="cta card">
          <div>
            <h2>Want smart search or AI features in your product?</h2>
            <p>I build React apps and production AI features for startups and product teams.</p>
          </div>
          <a href={`${PORTFOLIO}/#contact`} className="btn btn-primary">Start a project →</a>
        </section>
      </main>

      <footer className="container footer">
        Built by <a href={PORTFOLIO}>Adithya Harsha Babu</a> with React, Vite & Transformers.js
      </footer>
    </>
  );
}
