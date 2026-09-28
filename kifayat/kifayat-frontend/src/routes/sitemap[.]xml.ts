// The backend serves the real sitemap at /api/sitemap.xml.
// This file exists only so TanStack Router does not throw on the route.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sitemap.xml")({
  component: () => null,
});
