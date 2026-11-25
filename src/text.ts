export const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const phrasePattern = (phrase: string) =>
  new RegExp(
    `\\b${phrase.trim().split(/\s+/).map(escapeRegExp).join("\\s+")}\\b`,
    "i",
  );

export const escapeMarkdown = (text: string): string =>
  text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\\`*_[\]()<>~|#!]/g, "\\$&");
