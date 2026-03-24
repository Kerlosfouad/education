import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

// Next.js هيسحب الـ Token تلقائياً من الـ .env
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});