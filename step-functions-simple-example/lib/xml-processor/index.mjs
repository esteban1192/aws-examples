import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { parseStringPromise } from 'xml2js';

const s3Client = new S3Client();
const dynamoDbClient = new DynamoDBClient();

export const handler = async (event) => {
  const { contentType, bucket, objectKey } = event;

  if (contentType !== 'application/xml') {
    console.error("Unsupported content type:", contentType);
    return {
      success: false,
      message: "Unsupported content type. Only 'application/xml' is allowed.",
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
    const xmlData = await parseStringPromise(fileContent);

    console.log("Parsed XML Data:", xmlData);

    const params = {
      TableName: process.env.TABLE_NAME,
      Item: {
        ...xmlData,
        objectKey,
      },
    };

    await dynamoDbClient.send(new PutCommand(params));

    return {
      success: true,
      message: 'Data successfully stored in DynamoDB.',
    };
  } catch (error) {
    console.error("Error processing event:", error);
    return {
      success: false,
      message: "Failed to process the XML file.",
      error: error.message,
    };
  }
};
