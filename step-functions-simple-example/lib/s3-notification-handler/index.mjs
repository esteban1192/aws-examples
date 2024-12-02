import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";

export const handler = async (event) => {
  try {
    const record = event.Records[0];
    const bucketName = record.s3.bucket.name;
    const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    const input = JSON.stringify({
      objectInfo: {
        bucketName,
        objectKey
      }
    });

    const sfnClient = new SFNClient({});
    const stateMachineArn = process.env.STATE_MACHINE_ARN;

    const response = await startExecution({ sfnClient, stateMachineArn, input });

    console.log('State Machine execution started:', response);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'State machine execution started successfully!',
        executionArn: response.executionArn,
      }),
    };
  } catch (error) {
    console.error('Error invoking state machine:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to start state machine execution',
        error: error.message,
      }),
    };
  }
};

/**
 * Function to start the execution of a state machine.
 * 
 * @param {Object} params - Parameters for starting the execution.
 * @param {SFNClient} params.sfnClient - The Step Functions client.
 * @param {string} params.stateMachineArn - The ARN of the state machine.
 * @param {string} params.input - The input to pass to the state machine.
 */
async function startExecution({ sfnClient, stateMachineArn, input }) {
  const params = {
    stateMachineArn,
    input
  };

  const command = new StartExecutionCommand(params);
  const response = await sfnClient.send(command);

  return response;
}
