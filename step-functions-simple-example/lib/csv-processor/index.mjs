import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { parse } from 'csv-parse/sync';

const s3Client = new S3Client();
const dynamoDbClient = new DynamoDBClient();

export const handler = async (event) => {
  const { contentType, bucket, objectKey } = event;

  if (contentType !== 'text/csv') {
    console.error("Unsupported content type:", contentType);
    return {
      success: false,
      message: "Unsupported content type. Only 'text/csv' is allowed.",
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

    const records = parse(fileContent, {
      columns: true, // Use the first row as column headers
      skip_empty_lines: true, // Ignore empty lines
    });

    console.log("Parsed CSV Data:", records);

    const aggregatedData = {};

    for (const record of records) {
      for (const [key, value] of Object.entries(record)) {
        if (!aggregatedData[key]) {
          aggregatedData[key] = [];
        }
        aggregatedData[key].push(value);
      }
    }

    const params = {
      TableName: process.env.TABLE_NAME,
      Item: {
        ...aggregatedData,
        objectKey,
      },
    };

    await dynamoDbClient.send(new PutCommand(params));

    console.log(`Aggregated data stored in DynamoDB under key ${objectKey}.`);

    return {
      success: true,
      message: 'CSV data successfully aggregated and stored in DynamoDB.',
    };
  } catch (error) {
    console.error("Error processing event:", error);
    return {
      success: false,
      message: "Failed to process the CSV file.",
      error: error.message,
    };
  }
};
