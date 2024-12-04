import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import mime from "mime";

const s3Client = new S3Client();

export const handler = async (event) => {
  const { bucketName: bucket, objectKey } = event;
  const key = decodeURIComponent(objectKey.replace(/\+/g, " "));

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await s3Client.send(command);

    const contentType = mime.getType(key) || "unknown";

    return {
      contentType,
      message: contentType !== "unknown" ? "MIME type detected" : "Unable to determine MIME type",
    };
  } catch (error) {
    console.error("Error detecting content type:", error);
    return {
      contentType: "unknown",
      message: "Failed to retrieve or detect object metadata",
    };
  }
};
