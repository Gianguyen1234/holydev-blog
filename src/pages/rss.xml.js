import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET(context) {
  const allEntries = [
    ...(await getCollection("redis")),
    ...(await getCollection("distributed")),
    ...(await getCollection("database")),
    ...(await getCollection("concurrency")),
    ...(await getCollection("microservices")),
    ...(await getCollection("multi-module"))
  ];

  const items = allEntries
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
    .map((entry) => ({
      title: entry.data.title,
      description: entry.data.description,
      pubDate: entry.data.pubDate,
      link: `/${entry.collection}/${entry.slug}`
    }));

  return rss({
    title: "HolyDev Blog",
    description:
      "Ghi chu ky thuat chuyen sau ve system design, distributed systems, Redis, database internals, concurrency, microservices, va multi-module.",
    site: context.site,
    items
  });
}
