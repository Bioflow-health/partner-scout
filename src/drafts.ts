import { isObject } from "./json";
import type { Attempt, DraftEntry } from "./shortlist";

export const MAX_ATTEMPTS = 2;

const parseAttempts = (value: unknown, where: string, fit: boolean) => {
  if (!Array.isArray(value))
    throw new Error(`${where}.attempts must be an array`);
  if (value.length > MAX_ATTEMPTS) {
    throw new Error(
      `${where}.attempts has ${value.length} attempts; at most ${MAX_ATTEMPTS} are allowed (one draft and one revision)`,
    );
  }
  if (!fit && value.length > 0) {
    throw new Error(`${where}.attempts must be empty for a skip`);
  }
  return value.map((attempt: unknown, index): Attempt => {
    if (!isObject(attempt) || typeof attempt.draft !== "string") {
      throw new Error(`${where}.attempts[${index}].draft must be a string`);
    }
    return { draft: attempt.draft };
  });
};

export const parseDrafts = (
  json: unknown,
  path: string,
  candidateIds: ReadonlySet<string>,
): DraftEntry[] => {
  if (!isObject(json) || !Array.isArray(json.entries)) {
    throw new Error(`${path}: expected an object with an "entries" array`);
  }
  const seen = new Set<string>();
  return json.entries.map((entry: unknown, index): DraftEntry => {
    const where = `${path}: entries[${index}]`;
    if (!isObject(entry)) throw new Error(`${where} must be an object`);
    const { videoId, fit, reason, attempts } = entry;
    if (typeof videoId !== "string" || videoId === "") {
      throw new Error(`${where}.videoId must be a non-empty string`);
    }
    if (!candidateIds.has(videoId)) {
      throw new Error(
        `${where}.videoId "${videoId}" is not a candidate in this run`,
      );
    }
    if (seen.has(videoId)) {
      throw new Error(`${where}.videoId "${videoId}" is listed twice`);
    }
    seen.add(videoId);
    if (typeof fit !== "boolean") {
      throw new Error(`${where}.fit must be true or false`);
    }
    if (typeof reason !== "string") {
      throw new Error(`${where}.reason must be a string`);
    }
    return {
      videoId,
      fit,
      reason,
      attempts: parseAttempts(attempts, where, fit),
    };
  });
};
