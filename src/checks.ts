import { createHash } from "node:crypto";
import { isObject } from "./json";

export type CheckVerdict = {
  videoId: string;
  draftSha256: string;
  pass: boolean;
  reason: string;
};

const SHA256 = /^[0-9a-f]{64}$/;

export const draftHash = (draft: string): string =>
  createHash("sha256").update(draft, "utf8").digest("hex");

export const parseChecks = (json: unknown, path: string): CheckVerdict[] => {
  if (!isObject(json) || !Array.isArray(json.checks)) {
    throw new Error(`${path}: expected an object with a "checks" array`);
  }
  return json.checks.map((check: unknown, index) => {
    const where = `${path}: checks[${index}]`;
    if (!isObject(check)) throw new Error(`${where} must be an object`);
    const { videoId, draftSha256, pass, reason } = check;
    if (typeof videoId !== "string" || videoId === "") {
      throw new Error(`${where}.videoId must be a non-empty string`);
    }
    if (typeof draftSha256 !== "string" || !SHA256.test(draftSha256)) {
      throw new Error(`${where}.draftSha256 must be a 64-character hex sha256`);
    }
    if (typeof pass !== "boolean") {
      throw new Error(`${where}.pass must be true or false`);
    }
    if (typeof reason !== "string") {
      throw new Error(`${where}.reason must be a string`);
    }
    return { videoId, draftSha256, pass, reason };
  });
};

export const recordVerdict = (
  checks: readonly CheckVerdict[],
  verdict: CheckVerdict,
): CheckVerdict[] => [
  ...checks.filter(
    (check) =>
      check.videoId !== verdict.videoId ||
      check.draftSha256 !== verdict.draftSha256,
  ),
  verdict,
];
