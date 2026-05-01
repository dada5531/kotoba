import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export interface Fetched {
  title: string;
  body: string;
  kind: "nhk" | "nhk_easy" | "url";
}

export async function fetchUrl(url: string): Promise<Fetched> {
  if (/www3\.nhk\.or\.jp\/news\/easy\//.test(url)) {
    return fetchNhkEasy(url);
  }
  if (/www3\.nhk\.or\.jp\/news\//.test(url) || /\.nhk\.or\.jp\//.test(url)) {
    return { ...(await fetchGeneric(url)), kind: "nhk" };
  }
  return { ...(await fetchGeneric(url)), kind: "url" };
}

async function fetchGeneric(url: string): Promise<Omit<Fetched, "kind">> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; KotobaBot/0.1; +https://github.com/dada5531/kotoba)",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const html = await res.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  if (!article) {
    throw new Error("could not extract article");
  }
  // Strip residual HTML — Readability returns content with tags; we want
  // plain Japanese text for tokenization.
  const text = stripHtml(article.content ?? "");
  return {
    title: (article.title ?? "Untitled").trim(),
    body: text,
  };
}

async function fetchNhkEasy(url: string): Promise<Fetched> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 KotobaBot/0.1" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const html = await res.text();
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  const titleEl =
    doc.querySelector(".article-title") ??
    doc.querySelector("h1.title") ??
    doc.querySelector("title");
  const bodyEl =
    doc.querySelector("#js-article-body") ??
    doc.querySelector("article") ??
    doc.querySelector(".article-main__body");

  // NHK Easy wraps every kanji in <ruby> with <rt> furigana — keep the
  // base text only.
  const stripRuby = (el: Element | null) => {
    if (!el) return "";
    const clone = el.cloneNode(true) as Element;
    clone.querySelectorAll("rt, rp").forEach((n) => n.remove());
    return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
  };

  const title = stripRuby(titleEl);
  const body = stripRuby(bodyEl);
  if (!body) throw new Error("could not extract NHK Easy body");
  return { title, body, kind: "nhk_easy" };
}

function stripHtml(html: string): string {
  // jsdom is heavy; for plain stripping a regex is fine since Readability
  // already gave us clean-ish HTML.
  const dom = new JSDOM(`<div>${html}</div>`);
  const text = dom.window.document.body.textContent ?? "";
  return text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
