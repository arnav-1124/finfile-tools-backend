import crypto from "node:crypto";
import path from "node:path";

import { supabase } from "../../config/supabase.js";

const bucketName = process.env.SUPABASE_STORAGE_BUCKET;

if (!bucketName) {
  throw new Error(
    "Missing required environment variable: SUPABASE_STORAGE_BUCKET",
  );
}

function createSafeFileName(fileName = "file") {
  const extension = path.extname(fileName).toLowerCase();
  const baseName = path
    .basename(fileName, extension)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

  return `${baseName || "file"}${extension}`;
}

export function createJobId() {
  return `job_${crypto.randomUUID()}`;
}

export async function uploadTempFileToStorage({ jobId, file }) {
  const fileId = `file_${crypto.randomUUID()}`;
  const safeFileName = createSafeFileName(file.originalname);

  const storagePath = `temp/pdf-image-to-excel/${jobId}/uploads/${fileId}-${safeFileName}`;

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  return {
    fileId,
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storagePath: data.path,
  };
}

export async function deleteTempJobFiles(jobId) {
  const prefix = `temp/pdf-image-to-excel/${jobId}`;

  const { data: files, error: listError } = await supabase.storage
    .from(bucketName)
    .list(prefix, {
      limit: 1000,
      offset: 0,
    });

  if (listError) {
    throw new Error(`Supabase list failed: ${listError.message}`);
  }

  if (!files?.length) {
    return {
      deletedCount: 0,
    };
  }

  const paths = files.map((file) => `${prefix}/${file.name}`);

  const { error: removeError } = await supabase.storage
    .from(bucketName)
    .remove(paths);

  if (removeError) {
    throw new Error(`Supabase cleanup failed: ${removeError.message}`);
  }

  return {
    deletedCount: paths.length,
  };
}
