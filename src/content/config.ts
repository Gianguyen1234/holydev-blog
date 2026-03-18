import { defineCollection, z } from "astro:content";

const baseSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.date(),
  category: z.enum([
    "Redis",
    "Distributed Systems",
    "Database Internals",
    "Concurrency"
  ])
});

const redis = defineCollection({ type: "content", schema: baseSchema });
const distributed = defineCollection({ type: "content", schema: baseSchema });
const database = defineCollection({ type: "content", schema: baseSchema });
const concurrency = defineCollection({ type: "content", schema: baseSchema });

export const collections = {
  redis,
  distributed,
  database,
  concurrency
};
