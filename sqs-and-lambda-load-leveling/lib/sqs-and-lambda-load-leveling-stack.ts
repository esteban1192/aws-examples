import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources'
import * as path from 'path';

export class SqsAndLambdaLoadLevelingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const sqsQueue = new sqs.Queue(this, 'LoadLevelingQueue', {
      queueName: 'load-leveling-queue',
    });

    const lambdaFunction = new lambda.Function(this, 'LoadLevelingLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
      reservedConcurrentExecutions: 10,
    });

    lambdaFunction.addEventSource(new lambdaEventSources.SqsEventSource(sqsQueue, {
      batchSize: 5,
    }));
  }
}
