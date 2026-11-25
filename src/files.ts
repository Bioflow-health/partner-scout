import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type WriteNewOptions = { separator?: string; reuseIfSame?: boolean };

const readIfExists = async (path: string) => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
};

export const writeNew = async (
  dir: string,
  stem: string,
  ext: string,
  content: string,
  { separator = "-", reuseIfSame = false }: WriteNewOptions = {},
): Promise<string> => {
  await mkdir(dir, { recursive: true });
  let newest: { path: string; content: string } | undefined;
  for (let copy = 1; ; copy += 1) {
    const path = join(
      dir,
      `${stem}${copy === 1 ? "" : `${separator}${copy}`}${ext}`,
    );
    const existing = await readIfExists(path);
    if (existing === undefined) {
      if (reuseIfSame && newest?.content === content) return newest.path;
      await writeFile(path, content, { flag: "wx" });
      return path;
    }
    newest = { path, content: existing };
  }
};

export const newestFile = async (
  dir: string,
  prefix: string,
  ext: string,
): Promise<string | undefined> => {
  const names = (await readdir(dir).catch(() => [])).filter(
    (name) => name.startsWith(prefix) && name.endsWith(ext),
  );
  const dated = await Promise.all(
    names.map(async (name) => ({
      path: join(dir, name),
      modified: (await stat(join(dir, name))).mtimeMs,
    })),
  );
  return dated.sort((a, b) => b.modified - a.modified)[0]?.path;
};
