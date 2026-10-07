import { createUploadthing, type FileRouter } from "uploadthing/next";
import { getServerSession } from "next-auth/next";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";

const f = createUploadthing();

async function getAuthUser(req: any) {
  try {
    if (req) {
      const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
      if (token?.id) return { userId: token.id as string };
    }
  } catch (e) {
    console.error("UploadThing getToken error:", e);
  }

  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) return { userId: session.user.id };
  } catch (e) {
    console.error("UploadThing getServerSession error:", e);
  }

  return null;
}

export const ourFileRouter = {
  imageUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const auth = await getAuthUser(req);
      if (!auth) throw new Error("Unauthorized");
      return auth;
    })
    .onUploadComplete(async ({ file }) => {
      const fileUrl = (file as any).ufsUrl || file.url;
      return { url: fileUrl };
    }),

  pdfUploader: f({ 
    pdf: { maxFileSize: "16MB" },
    blob: { maxFileSize: "16MB" },
    image: { maxFileSize: "16MB" }
  })
    .middleware(async ({ req }) => {
      const auth = await getAuthUser(req);
      if (!auth) throw new Error("Unauthorized");
      return auth;
    })
    .onUploadComplete(async ({ file }) => {
      const fileUrl = (file as any).ufsUrl || file.url;
      return { url: fileUrl };
    }),

  videoUploader: f({ 
    video: { maxFileSize: "512MB", maxFileCount: 1 }
  })
    .middleware(async ({ req }) => {
      const auth = await getAuthUser(req);
      if (!auth) throw new Error("Unauthorized");
      return auth;
    })
    .onUploadComplete(async ({ file }) => {
      const fileUrl = (file as any).ufsUrl || file.url;
      return { url: fileUrl, name: file.name, size: file.size };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;