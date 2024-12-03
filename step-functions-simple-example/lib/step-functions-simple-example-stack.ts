import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3Notifications from 'aws-cdk-lib/aws-s3-notifications';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as stepfunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import * as path from 'path';

export class StepFunctionsSimpleExampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const createLambdaFunction = (id: string, functionName: string, dirname: string, environment?: {[key: string]: string}) => {
      return new lambda.Function(this, id, {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path.join(__dirname, dirname)),
        functionName,
        environment
      });
    };

    const fileTypeDetectorFunction = createLambdaFunction('FileTypeDetectorFunction', 'FileTypeDetector', 'file-type-detector');
    const xmlProcessorFunction = createLambdaFunction('XMLProcessorFunction', 'XMLProcessor', 'xml-processor');
    const csvProcessorFunction = createLambdaFunction('CSVProcessorFunction', 'CSVProcessor', 'csv-processor');
    const jsonProcessorFunction = createLambdaFunction('JSONProcessorFunction', 'JSONProcessor', 'json-processor');
    const yamlProcessorFunction = createLambdaFunction('YAMLProcessorFunction', 'YAMLProcessor', 'yaml-processor');

    const fileTypeDetectorTask = new stepfunctionsTasks.LambdaInvoke(this, 'FileTypeDetectorTask', {
      lambdaFunction: fileTypeDetectorFunction,
      inputPath: '$.objectInfo',
    });

    const createProcessingTask = (id: string, lambdaFunction: lambda.Function, successId: string, failureId: string) => {
      const lambdaInvoke = new stepfunctionsTasks.LambdaInvoke(this, id, {
        lambdaFunction,
        inputPath: '$.Payload',
      })
      const choiceState = new stepfunctions.Choice(this, `${id}-Choice`)
        .when(
          stepfunctions.Condition.booleanEquals('$.Payload.success', true),
          new stepfunctions.Succeed(this, successId)
        )
        .otherwise(
          new stepfunctions.Fail(this, failureId, {
            error: 'Some error occurred while processing the file content',
            cause: 'The Lambda function did not return true.',
          })
        );
      lambdaInvoke.next(choiceState);
      return lambdaInvoke;
    };

    const xmlProcessorTask = createProcessingTask('XMLProcessorTask', xmlProcessorFunction, 'XMLProcessingSuccess', 'XMLProcessingFailure');
    const csvProcessorTask = createProcessingTask('CSVProcessorTask', csvProcessorFunction, 'CSVProcessingSuccess', 'CSVProcessingFailure');
    const jsonProcessorTask = createProcessingTask('JSONProcessorTask', jsonProcessorFunction, 'JSONProcessingSuccess', 'JSONProcessingFailure');
    const yamlProcessorTask = createProcessingTask('YAMLProcessorTask', yamlProcessorFunction, 'YAMLProcessingSuccess', 'YAMLProcessingFailure');

    const definition = fileTypeDetectorTask.next(
      new stepfunctions.Choice(this, 'FileTypeChoice')
        .when(stepfunctions.Condition.stringMatches('$.Payload.contentType', 'xml'), xmlProcessorTask)
        .when(stepfunctions.Condition.stringMatches('$.Payload.contentType', 'csv'), csvProcessorTask)
        .when(stepfunctions.Condition.stringMatches('$.Payload.contentType', 'json'), jsonProcessorTask)
        .when(stepfunctions.Condition.stringMatches('$.Payload.contentType', 'yaml'), yamlProcessorTask)
        .otherwise(new stepfunctions.Fail(this, 'UnsupportedContentType'))
    );

    const stateMachine = new stepfunctions.StateMachine(this, 'StateMachine', {
      definitionBody: stepfunctions.DefinitionBody.fromChainable(definition),
    });

    const s3NotificationHandler = createLambdaFunction('S3NotificationHandler', 'S3NotificationHandler', 's3-notification-handler', {
      STATE_MACHINE_ARN: stateMachine.stateMachineArn,
    })

    const bucket = new s3.Bucket(this, 'S3Bucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3Notifications.LambdaDestination(s3NotificationHandler)
    );

    stateMachine.grantStartExecution(s3NotificationHandler);
    bucket.grantRead(s3NotificationHandler);
  }
}
