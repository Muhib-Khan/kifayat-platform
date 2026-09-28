const Groq = require("groq-sdk");
const groqKeyPool = require("./groqKeyPool");

const GROQ_MODEL = "llama-3.3-70b-versatile";
const COPY_BATCH_SIZE = 10;
const COPY_CONCURRENCY = 3;

const PRODUCT_COPY_SYSTEM_PROMPT = `You are a senior Daraz and Amazon marketplace listing copywriter for a Pakistani online store.

Rewrite each product title and description into polished, searchable, conversion-focused marketplace copy.
Rules:
- Keep the product's actual brand, model, type, materials, compatibility, included items, dimensions, quantity, and measurable details accurate.
- Never invent or assume specifications, warranty, certifications, health benefits, discounts, delivery promises, or claims that are not present.
- Remove supplier noise, duplicated phrases, HTML, tracking text, and awkward machine translations.
- TITLE: create a clear, natural, keyword-relevant title suitable for Daraz/Amazon search. Put the most important product type and verified attributes first. Use title case, remove supplier codes and keyword stuffing, and keep it under 150 characters.
- DESCRIPTION: use natural English with a concise opening paragraph followed by 3 to 5 short benefit bullets only when the source contains enough factual details. Keep it between 45 and 130 words when the source has useful details. If the source is empty, write a useful but strictly name-based description without inventing specifications.
- Do not include markdown headings, emojis, prices, seller names, or promotional claims.
- Return ONLY a valid JSON array of objects in the same order, each with exactly two string fields: {"name":"...","description":"..."}.`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseProductCopyResponse(raw, expectedLength) {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`Non-JSON product copy response: ${raw.slice(0, 120)}`);

  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed) || parsed.length !== expectedLength) {
    throw new Error(`Got ${parsed?.length ?? 0} product copy results for ${expectedLength} products`);
  }

  return parsed.map((value) => ({
    name: typeof value?.name === "string" ? value.name.trim() : "",
    description: typeof value?.description === "string" ? value.description.trim() : "",
  }));
}

async function optimizeProductCopyBatch(batch, apiKey) {
  const params = {
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: PRODUCT_COPY_SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `Rewrite the title and description for exactly ${batch.length} products. ` +
          `Return a JSON array with exactly ${batch.length} objects, each containing name and description strings.\n\n${productLines(batch)}`,
      },
    ],
    temperature: 0.25,
    max_tokens: batch.length * 300,
  };

  // Explicit key passed (legacy callers) → single-key path with its own retry
  if (apiKey) {
    const groq = new Groq({ apiKey });
    for (let attempt = 0; attempt <= 4; attempt++) {
      try {
        const response = await groq.chat.completions.create(params);
        return parseProductCopyResponse(
          (response.choices[0]?.message?.content || "").trim(),
          batch.length,
        );
      } catch (error) {
        const isRateLimit =
          error?.status === 429 ||
          error?.error?.type === "rate_limit_exceeded" ||
          String(error?.message || "").toLowerCase().includes("rate limit");
        if (isRateLimit && attempt < 4) {
          await sleep(Math.pow(2, attempt) * 1500);
          continue;
        }
        throw error;
      }
    }
  }

  // No key → smart pool: rotates healthy keys, retries on throttle/parse errors
  return groqKeyPool.chatWithRetry("seo", params, {
    parse: (raw) => parseProductCopyResponse(raw, batch.length),
    budget: 300_000,
    split: (p) => groqKeyPool.splitBatchParams(p, batch, (sub) =>
      `Rewrite the title and description for exactly ${sub.length} products. ` +
      `Return a JSON array with exactly ${sub.length} objects, each containing name and description strings.\n\n${productLines(sub)}`),
  });
}

function productLines(batch) {
  return batch
    .map((product, index) => {
      const name = String(product.name || "").trim();
      const description = String(product.description || "").trim().slice(0, 1800);
      return `${index + 1}. NAME: ${name}\nSOURCE DESCRIPTION: ${description || "(empty)"}`;
    })
    .join("\n\n");
}

/**
 * Optimize product titles and descriptions without allowing an AI failure to
 * stop an import. Each failed result falls back to its original fields.
 */
async function optimizeProductCopy(products, onProgress, apiKey) {
  if (!Array.isArray(products) || products.length === 0) return products;
  if (!apiKey && !(await groqKeyPool.hasKeys())) {
    onProgress?.({ optimized: 0, total: products.length, skipped: true });
    return products;
  }

  const batches = [];
  for (let i = 0; i < products.length; i += COPY_BATCH_SIZE) {
    batches.push(products.slice(i, i + COPY_BATCH_SIZE));
  }

  // More keys = more parallel batches; each batch borrows its own key
  const concurrency = apiKey
    ? COPY_CONCURRENCY
    : Math.max(4, Math.min(32, await groqKeyPool.healthyCount()));

  let processed = 0;
  const optimized = new Array(products.length);

  for (let i = 0; i < batches.length; i += concurrency) {
    const chunk = batches.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (batch, chunkIndex) => {
        const batchStart = (i + chunkIndex) * COPY_BATCH_SIZE;
        let productCopy;
        try {
          productCopy = await optimizeProductCopyBatch(batch, apiKey);
        } catch (error) {
          console.warn(
            `Groq product copy optimization failed for batch starting at ${batchStart}:`,
            error.message,
          );
          productCopy = batch.map((product) => ({
            name: product.name || "",
            description: product.description || "",
          }));
        }

        productCopy.forEach((copy, index) => {
          optimized[batchStart + index] = {
            ...batch[index],
            name: copy.name || batch[index].name || "",
            description: copy.description || batch[index].description || "",
          };
        });
        processed += batch.length;
        onProgress?.({ optimized: processed, total: products.length });
      }),
    );
  }

  return optimized;
}

// Kept as an alias for callers outside the import flows.
const optimizeProductDescriptions = optimizeProductCopy;

module.exports = {
  GROQ_MODEL,
  optimizeProductCopy,
  optimizeProductDescriptions,
};
