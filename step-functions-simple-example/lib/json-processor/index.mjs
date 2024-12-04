import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand } from '@aws-sdk/lib-dynamodb';

const s3Client = new S3Client();
const dynamoDbClient = new DynamoDBClient();

export const handler = async (event) => {
  const { contentType, bucket, objectKey } = event;

  if (contentType !== 'application/json') {
    console.error("Unsupported content type:", contentType);
    return {
      success: false,
      message: "Unsupported content type. Only 'application/json' is allowed.",
    };
  }

  try {
    const s3Object = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      })
    );

    const fileContent = await s3Object.Body.transformToString();
    const jsonData = JSON.parse(fileContent);

    console.log("Parsed JSON Data:", jsonData);

    const params = {
      TableName: process.env.TABLE_NAME,
      Item: {
        ...jsonData,
        objectKey,
      },
    };

    await dynamoDbClient.send(new PutCommand(params));
    console.log("Data successfully written to DynamoDB");

    return {
      success: true,
      message: 'Data successfully stored in DynamoDB.',
    };
  } catch (error) {
    console.error("Error processing event:", error);
    return {
      success: false,
      message: "Failed to process the JSON file.",
      error: error.message,
    };
  }
};
