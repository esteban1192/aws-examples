import { Macie2Client, CreateClassificationJobCommand } from "@aws-sdk/client-macie2";

export const handler = async() => {
  const bucketName = process.env.BUCKET_NAME;
  const accountId = process.env.AWS_ACCOUNT_ID;

  if (!bucketName || !accountId) {
    console.error("Environment variables BUCKET_NAME or AWS_ACCOUNT_ID are not set.");
    return {
      statusCode: 400,
      body: "Missing required environment variables: BUCKET_NAME or AWS_ACCOUNT_ID.",
    };
  }

  const client = new Macie2Client();

  try {
    const input = {
      clientToken: `macie-job-${Date.now()}`,
      description: "Macie job to detect sensitive data in the specified S3 bucket",
      initialRun: true,
      jobType: "SCHEDULED",
      managedDataIdentifierSelector: "ALL",
      name: `MacieJob-${bucketName}-${Date.now()}`,
      s3JobDefinition: {
        bucketDefinitions: [
          {
            accountId,
            buckets: [bucketName],
          },
        ],
      },
      scheduleFrequency: {
        dailySchedule: {}
      },    
    };

    // Send the command to create the classification job
    const command = new CreateClassificationJobCommand(input);
    const response = await client.send(command);

    console.log("Macie job created:", response);
    return {
      statusCode: 200,
      body: `Macie job created successfully. Job ID: ${response.jobId}, ARN: ${response.jobArn}`,
    };
  } catch (error) {
    console.error("Error creating Macie job:", error);
    return {
      statusCode: 500,
      body: `Failed to create Macie job: ${error.message}`,
    };
  }
}
