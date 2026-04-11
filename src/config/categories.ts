export const categories = {
  concurrency: {
    label: "Concurrency",
    description: "Threads, race conditions, atomicity."
  },
  microservices: {
    label: "Microservices",
    description: "Services, APIs, communication."
  },
  "multi-module": {
    label: "Multi-Module",
    description: "Structure, modules, shared core."
  },
  redis: {
    label: "Redis",
    description: "Replication, persistence, internals."
  },
  distributed: {
    label: "Distributed Systems",
    description: "Consensus, CAP, failure models."
  },
  database: {
    label: "Database Internals",
    description: "MVCC, storage engines, indexes."
  }
} as const;

export type CategoryKey = keyof typeof categories;

export const categoryKeys = Object.keys(categories) as CategoryKey[];

export const categoryMap = Object.fromEntries(
  Object.entries(categories).map(([key, value]) => [key, value.label])
) as Record<CategoryKey, string>;

export const isCategoryKey = (key: string): key is CategoryKey =>
  Object.prototype.hasOwnProperty.call(categories, key);
