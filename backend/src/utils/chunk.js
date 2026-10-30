/**
 * Splits text into overlapping windows for PDF ingest.
 *
 * @param {string} text - Extracted PDF text.
 * @param {number} [size=1000] - Target characters per chunk.
 * @param {number} [overlap=150] - Characters reused at the next window start.
 * @returns {string[]} Non-empty chunks.
 */
export const chunkTextWithOverlap = (text, size = 1000, overlap = 150) => {
  const source = String(text || '')
    .replace(/\s+/g, ' ')    // collapses every run of whitespace — spaces, newlines, and tabs — into a single space
    .trim();
  if (!source) {
    return [];
  }

  const windowSize = size > 0 ? size : 1000;
  const step = Math.max(1, windowSize - Math.max(0, overlap));
  const chunks = [];

  for (let start = 0; start < source.length; start += step) {
    const piece = source.slice(start, start + windowSize).trim();
    if (piece) {
      chunks.push(piece);
    }
    if (start + windowSize >= source.length) {
      break;
    }
  }

  return chunks;
};
