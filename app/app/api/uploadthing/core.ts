import { createUploadthing, type FileRouter } from 'uploadthing/next';

const f = createUploadthing();

export const ourFileRouter = {
  pdfUploader: f({ pdf: { maxFileSize: '32MB' } })
    .middleware(async () => ({}))
    .onUploadComplete(async ({ file }) => {
      return { url: file.url };
    }),
  videoUploader: f({ video: { maxFileSize: '512MB' } })
    .middleware(async () => ({}))
    .onUploadComplete(async ({ file }) => {
      return { url: file.url };
    }),
  imageUploader: f({ image: { maxFileSize: '8MB' } })
    .middleware(async () => ({}))
    .onUploadComplete(async ({ file }) => {
      return { url: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
