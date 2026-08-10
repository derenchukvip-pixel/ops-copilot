import type { NextConfig } from "next";

/**
 * The console is a static site. There is no server component of it at all: the browser talks to
 * the Java API directly, or — in a demo build — to fixtures compiled into the bundle.
 *
 * That is what makes it publishable on GitHub Pages, and it is also why there is nowhere to
 * hide a secret. Nothing here should ever be given one.
 */
const nextConfig: NextConfig = {
  output: "export",

  /**
   * GitHub Pages serves a project site from a subdirectory, so every asset URL needs the repo
   * name in front of it. Empty for local development and for any host that serves from a root.
   */
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,

  /**
   * Pages has no rewrite rules: a refresh on /tickets would 404 unless that path is a real
   * directory with an index.html in it. Trailing slashes make the export produce exactly that.
   */
  trailingSlash: true,

  // The optimizer needs a server. There is none.
  images: { unoptimized: true },
};

export default nextConfig;
