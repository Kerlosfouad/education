import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const f = createUploadthing();

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Unauthorized');
  return { userId: session.user.id };
}

export const ourFileRouter = {
  pdfUploader: f({ pdf: { maxFileSize: '32MB' } })
    .middleware(requireAuth)
    .onUploadComplete(async ({ file }) => {
      return { url: file.url };
    }),
  videoUploader: f({ video: { maxFileSize: '512MB' } })
    .middleware(requireAuth)
    .onUploadComplete(async ({ file }) => {
      return { url: file.url };
    }),
  imageUploader: f({ image: { maxFileSize: '8MB' } })
    .middleware(requireAuth)
    .onUploadComplete(async ({ file }) => {
      return { url: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
