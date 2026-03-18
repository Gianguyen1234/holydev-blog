import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

function rehypeExternalLinks() {
  return (tree) => {
    const visit = (node) => {
      if (!node || typeof node !== "object") return;

      if (node.type === "element" && node.tagName === "a") {
        const href = node.properties?.href;
        if (typeof href === "string" && /^https?:\/\//i.test(href)) {
          node.properties = node.properties ?? {};
          node.properties.target = "_blank";
          node.properties.rel = "noopener noreferrer";
        }
      }

      if (Array.isArray(node.children)) {
        for (const child of node.children) visit(child);
      }
    };

    visit(tree);
  };
}

const rehypePlugins = [rehypeExternalLinks];

export default defineConfig({
  site: "https://holydev.uk",
  output: "static",
  markdown: {
    rehypePlugins,
    shikiConfig: {
      theme: "github-dark"
    }
  },
  integrations: [sitemap()]
});
