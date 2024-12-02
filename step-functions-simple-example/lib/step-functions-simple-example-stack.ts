import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as stepfunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import * as path from 'path';

export class StepFunctionsSimpleExampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const createLambdaFunction = (id: string, functionName: string) => {
      return new lambda.Function(this, id, {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path.join(__dirname, 'file-type-detector')),
        functionName,
      });
    };

    const fileTypeDetectorFunction = createLambdaFunction('FileTypeDetectorFunction', 'FileTypeDetector');
    const xmlProcessorFunction = createLambdaFunction('XMLProcessorFunction', 'XMLProcessor');
    const csvProcessorFunction = createLambdaFunction('CSVProcessorFunction', 'CSVProcessor');
    const jsonProcessorFunction = createLambdaFunction('JSONProcessorFunction', 'JSONProcessor');
    const yamlProcessorFunction = createLambdaFunction('YAMLProcessorFunction', 'YAMLProcessor');

    const fileTypeDetectorTask = new stepfunctionsTasks.LambdaInvoke(this, 'FileTypeDetectorTask', {
      lambdaFunction: fileTypeDetectorFunction,
      inputPath: '$.objectInfo',
      outputPath: '$.bucketName',
    });

    const createProcessingTask = (id: string, lambdaFunction: lambda.Function, successId: string) => {
      return new stepfunctionsTasks.LambdaInvoke(this, id, {
        lambdaFunction,
        inputPath: '$.objectContent',
        outputPath: '$.result',
      }).next(new stepfunctions.Succeed(this, successId));
    };

    const xmlProcessorTask = createProcessingTask('XMLProcessorTask', xmlProcessorFunction, 'XMLProcessingDone');
    const csvProcessorTask = createProcessingTask('CSVProcessorTask', csvProcessorFunction, 'CSVProcessingDone');
    const jsonProcessorTask = createProcessingTask('JSONProcessorTask', jsonProcessorFunction, 'JSONProcessingDone');
    const yamlProcessorTask = createProcessingTask('YAMLProcessorTask', yamlProcessorFunction, 'YAMLProcessingDone');

    const definition = fileTypeDetectorTask.next(
      new stepfunctions.Choice(this, 'FileTypeChoice')
        .when(stepfunctions.Condition.stringMatches('$.contentType', 'xml'), xmlProcessorTask)
        .when(stepfunctions.Condition.stringMatches('$.contentType', 'csv'), csvProcessorTask)
        .when(stepfunctions.Condition.stringMatches('$.contentType', 'json'), jsonProcessorTask)
        .when(stepfunctions.Condition.stringMatches('$.contentType', 'yaml'), yamlProcessorTask)
        .otherwise(new stepfunctions.Fail(this, 'UnsupportedContentType'))
    );

    new stepfunctions.StateMachine(this, 'StateMachine', {
      definitionBody: stepfunctions.DefinitionBody.fromChainable(definition),
    });
  }
}
