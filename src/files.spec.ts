import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { newestFile, writeNew } from "./files";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "partner-scout-files-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const contents = async () => {
  const names = (await readdir(dir)).sort();
  return Promise.all(
    names.map(async (name) => [name, await readFile(join(dir, name), "utf8")]),
  );
};

describe("writeNew", () => {
  test("never overwrites: later writes get -v2, -v3 and earlier files keep their content", async () => {
    const paths = [
      await writeNew(dir, "candidates-2026-11-24", ".json", "first", {
        separator: "-v",
      }),
      await writeNew(dir, "candidates-2026-11-24", ".json", "second", {
        separator: "-v",
      }),
      await writeNew(dir, "candidates-2026-11-24", ".json", "third", {
        separator: "-v",
      }),
    ];

    expect([paths, await contents()]).toEqual([
      [
        join(dir, "candidates-2026-11-24.json"),
        join(dir, "candidates-2026-11-24-v2.json"),
        join(dir, "candidates-2026-11-24-v3.json"),
      ],
      [
        ["candidates-2026-11-24-v2.json", "second"],
        ["candidates-2026-11-24-v3.json", "third"],
        ["candidates-2026-11-24.json", "first"],
      ],
    ]);
  });

  test("uses a plain -2 for cache files, as before", async () => {
    await writeNew(dir, "2026-11-24", ".json", "a");
    const second = await writeNew(dir, "2026-11-24", ".json", "b");

    expect([second, await contents()]).toEqual([
      join(dir, "2026-11-24-2.json"),
      [
        ["2026-11-24-2.json", "b"],
        ["2026-11-24.json", "a"],
      ],
    ]);
  });

  test("with reuseIfSame, returns the newest version when its content is identical", async () => {
    const options = { separator: "-v", reuseIfSame: true };
    await writeNew(dir, "shortlist-x", ".md", "old", options);
    await writeNew(dir, "shortlist-x", ".md", "same", options);
    const reused = await writeNew(dir, "shortlist-x", ".md", "same", options);
    const changed = await writeNew(dir, "shortlist-x", ".md", "new", options);

    expect([reused, changed, await contents()]).toEqual([
      join(dir, "shortlist-x-v2.md"),
      join(dir, "shortlist-x-v3.md"),
      [
        ["shortlist-x-v2.md", "same"],
        ["shortlist-x-v3.md", "new"],
        ["shortlist-x.md", "old"],
      ],
    ]);
  });

  test("creates the directory when it is missing", async () => {
    const path = await writeNew(
      join(dir, "out", "cache"),
      "2026-11-24",
      ".json",
      "a",
    );

    expect(await readFile(path, "utf8")).toBe("a");
  });
});

describe("newestFile", () => {
  test("picks the most recently modified file with the prefix and extension", async () => {
    const files = [
      ["candidates-a.json", 1_000],
      ["candidates-b.json", 3_000],
      ["candidates-c.json", 2_000],
      ["drafts-z.json", 9_000],
      ["candidates-d.md", 9_000],
    ] as const;
    for (const [name, seconds] of files) {
      await writeFile(join(dir, name), "x");
      await utimes(join(dir, name), seconds, seconds);
    }

    expect(await newestFile(dir, "candidates-", ".json")).toBe(
      join(dir, "candidates-b.json"),
    );
  });

  test("returns undefined when nothing matches or the directory is missing", async () => {
    expect([
      await newestFile(dir, "candidates-", ".json"),
      await newestFile(join(dir, "missing"), "candidates-", ".json"),
    ]).toEqual([undefined, undefined]);
  });
});
