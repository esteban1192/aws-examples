import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3Notifications from 'aws-cdk-lib/aws-s3-notifications';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as stepfunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import * as path from 'path';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class StepFunctionsSimpleExampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const dynamoTable = this.createDynamoTable();

    const fileTypeDetectorLayer = this.createLayerVersion('FileTypeDetectorLayer', 'file-type-detector/layer-version', 'FileTypeDetector');

    const fileTypeDetectorFunction = this.createLambdaFunction('FileTypeDetectorFunction', 'FileTypeDetector', 'file-type-detector', undefined, fileTypeDetectorLayer);
    const xmlProcessorFunction = this.createLambdaFunction('XMLProcessorFunction', 'XMLProcessor', 'xml-processor');
    const csvProcessorFunction = this.createLambdaFunction('CSVProcessorFunction', 'CSVProcessor', 'csv-processor');
    const jsonProcessorFunction = this.createLambdaFunction('JSONProcessorFunction', 'JSONProcessor', 'json-processor', { TABLE_NAME: dynamoTable.tableName });
    const yamlProcessorFunction = this.createLambdaFunction('YAMLProcessorFunction', 'YAMLProcessor', 'yaml-processor');

    dynamoTable.grantWriteData(xmlProcessorFunction);
    dynamoTable.grantWriteData(csvProcessorFunction);
    dynamoTable.grantWriteData(jsonProcessorFunction);
    dynamoTable.grantWriteData(yamlProcessorFunction);

    const fileTypeDetectorTask = this.createFileTypeDetectorTask(fileTypeDetectorFunction);
    const xmlProcessorTask = this.createProcessingTask('XMLProcessorTask', xmlProcessorFunction, 'XMLProcessingSuccess', 'XMLProcessingFailure');
    const csvProcessorTask = this.createProcessingTask('CSVProcessorTask', csvProcessorFunction, 'CSVProcessingSuccess', 'CSVProcessingFailure');
    const jsonProcessorTask = this.createProcessingTask('JSONProcessorTask', jsonProcessorFunction, 'JSONProcessingSuccess', 'JSONProcessingFailure');
    const yamlProcessorTask = this.createProcessingTask('YAMLProcessorTask', yamlProcessorFunction, 'YAMLProcessingSuccess', 'YAMLProcessingFailure');

    const stateMachine = this.createStateMachine(fileTypeDetectorTask, xmlProcessorTask, csvProcessorTask, jsonProcessorTask, yamlProcessorTask);

    const s3NotificationHandler = this.createLambdaFunction('S3NotificationHandler', 'S3NotificationHandler', 's3-notification-handler', {
      STATE_MACHINE_ARN: stateMachine.stateMachineArn,
    });

    const bucket = this.createS3Bucket(s3NotificationHandler);
    bucket.grantRead(fileTypeDetectorFunction);
    bucket.grantRead(jsonProcessorFunction);

    stateMachine.grantStartExecution(s3NotificationHandler);
    bucket.grantRead(s3NotificationHandler);
  }

  private createDynamoTable(): dynamodb.Table {
    return new dynamodb.Table(this, 'DynamoTable', {
      partitionKey: { name: 'objectKey', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }

  private createLayerVersion(id: string, dirname: string, layerName: string) {
    return new lambda.LayerVersion(this, id, {
      code: lambda.Code.fromAsset(path.join(__dirname, dirname)),
      layerVersionName: layerName
    });
  }

  private createLambdaFunction(id: string, functionName: string, dirname: string, environment?: { [key: string]: string }, layerVersion?: lambda.ILayerVersion): lambda.Function {
    const lambdaFunction = new lambda.Function(this, id, {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, dirname)),
      functionName,
      environment,
      timeout: cdk.Duration.seconds(10)
    });

    if (layerVersion) {
      lambdaFunction.addLayers(layerVersion);
    }

    return lambdaFunction;
  }

  private createFileTypeDetectorTask(fileTypeDetectorFunction: lambda.Function) {
    return new stepfunctionsTasks.LambdaInvoke(this, 'FileTypeDetectorTask', {
      lambdaFunction: fileTypeDetectorFunction,
      inputPath: '$.objectInfo',
    });
  }

  private createProcessingTask(id: string, lambdaFunction: lambda.Function, successId: string, failureId: string) {
    const lambdaInvoke = new stepfunctionsTasks.LambdaInvoke(this, id, {
      lambdaFunction,
      inputPath: '$.Payload',
    });
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
  }

  private createStateMachine(fileTypeDetectorTask: stepfunctionsTasks.LambdaInvoke, xmlProcessorTask: stepfunctionsTasks.LambdaInvoke, csvProcessorTask: stepfunctionsTasks.LambdaInvoke, jsonProcessorTask: stepfunctionsTasks.LambdaInvoke, yamlProcessorTask: stepfunctionsTasks.LambdaInvoke) {
    const definition = fileTypeDetectorTask.next(
      new stepfunctions.Choice(this, 'FileTypeChoice')
        .when(stepfunctions.Condition.stringMatches('$.Payload.contentType', 'application/xml'), xmlProcessorTask)
        .when(stepfunctions.Condition.stringMatches('$.Payload.contentType', 'text/csv'), csvProcessorTask)
        .when(stepfunctions.Condition.stringMatches('$.Payload.contentType', 'application/json'), jsonProcessorTask)
        .when(stepfunctions.Condition.stringMatches('$.Payload.contentType', 'text/yaml'), yamlProcessorTask)
        .otherwise(new stepfunctions.Fail(this, 'UnsupportedContentType'))
    );

    return new stepfunctions.StateMachine(this, 'StateMachine', {
      definitionBody: stepfunctions.DefinitionBody.fromChainable(definition),
    });
  }

  private createS3Bucket(s3NotificationHandler: lambda.Function) {
    const bucket = new s3.Bucket(this, 'S3Bucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3Notifications.LambdaDestination(s3NotificationHandler)
    );

    return bucket;
  }
}
