import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

// Next.js reads the UploadThing token from `.env` automatically.
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});