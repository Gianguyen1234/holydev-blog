import { defineCollection, z } from "astro:content";

const baseSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.date(),
  image: z.string().optional(),
  series: z.string().optional(),
  seriesOrder: z.number().int().positive().optional(),
  relatedCategories: z
    .array(
      z.enum([
        "Redis",
        "Distributed Systems",
        "Database Internals",
        "Concurrency",
        "Microservices",
        "Multi-Module"
      ])
    )
    .optional(),
  category: z.enum([
    "Redis",
    "Distributed Systems",
    "Database Internals",
    "Concurrency",
    "Microservices",
    "Multi-Module"
  ])
});

const redis = defineCollection({ type: "content", schema: baseSchema });
const distributed = defineCollection({ type: "content", schema: baseSchema });
const database = defineCollection({ type: "content", schema: baseSchema });
const concurrency = defineCollection({ type: "content", schema: baseSchema });
const microservices = defineCollection({ type: "content", schema: baseSchema });
const multiModule = defineCollection({ type: "content", schema: baseSchema });

export const collections = {
  redis,
  distributed,
  database,
  concurrency,
  microservices,
  "multi-module": multiModule
};
