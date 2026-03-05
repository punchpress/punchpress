import { initTRPC } from "@trpc/server";
import { createHTTPServer } from "@trpc/server/adapters/standalone";

const t = initTRPC.create();

const fontCatalog = [
  {
    id: "bebas-neue",
    label: "Bebas Neue",
    url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/bebasneue/BebasNeue-Regular.ttf",
  },
  {
    id: "anton",
    label: "Anton",
    url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/anton/Anton-Regular.ttf",
  },
  {
    id: "oswald",
    label: "Oswald",
    url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/oswald/Oswald%5Bwght%5D.ttf",
  },
];

const appRouter = t.router({
  editor: t.router({
    bootstrap: t.procedure.query(() => {
      return {
        accent: "#4c9eff",
        fonts: fontCatalog,
      };
    }),
  }),
});

const server = createHTTPServer({
  basePath: "/trpc/",
  router: appRouter,
});

const port = Number(process.env.PORT || 5274);

server.listen(port);
console.log(`tRPC server listening on http://localhost:${port}`);
