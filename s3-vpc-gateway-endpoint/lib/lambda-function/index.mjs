import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

export const handler = async (event) => {
  const bucketName = process.env.BUCKET_NAME;
  if (!bucketName) {
    throw new Error("Bucket name not found in environment variables");
  }

  const { objectKey } = event;

  console.log("event object", JSON.stringify(event));

  const client = new S3Client();
  const input = {
    Bucket: bucketName,
    Key: objectKey,
  };

  try {
    const command = new GetObjectCommand(input);
    const response = await client.send(command);

    console.log("Successfull response:", JSON.stringify(response));

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Successfully retrieved object",
      }),
    };
  } catch (error) {
    console.error("Error retrieving object:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Failed to retrieve object",
        error: error.message,
      }),
    };
  }
};
