import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET(context) {
  const allEntries = [
    ...(await getCollection("redis")),
    ...(await getCollection("distributed")),
    ...(await getCollection("database")),
    ...(await getCollection("concurrency"))
  ];

  const items = allEntries
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
    .map((entry) => {
      const category = entry.collection;
      return {
        title: entry.data.title,
        description: entry.data.description,
        pubDate: entry.data.pubDate,
        link: `/${category}/${entry.slug}`
      };
    });

  return rss({
    title: "HolyDev Blog",
    description:
      "Ghi chú chuyên sâu về system design, distributed systems, Redis, database internals và concurrency.",
    site: context.site,
    items
  });
}
