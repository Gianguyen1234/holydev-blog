export const categoryMap = {
  redis: "Redis",
  distributed: "Distributed Systems",
  database: "Database Internals",
  concurrency: "Concurrency"
} as const;

export type CategoryKey = keyof typeof categoryMap;

export const categoryKeys = Object.keys(categoryMap) as CategoryKey[];

export const isCategoryKey = (key: string): key is CategoryKey =>
  Object.prototype.hasOwnProperty.call(categoryMap, key);
