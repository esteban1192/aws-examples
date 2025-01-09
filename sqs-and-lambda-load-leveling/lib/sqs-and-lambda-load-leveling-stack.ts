import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as path from 'path';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam'

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

    const integrationRole = new iam.Role(this, 'integration-role', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    });

    const api = new apigateway.RestApi(this, 'SqsApi', {
      restApiName: 'SQS API',
      description: 'API Gateway to send messages directly to SQS.',
    });

    sqsQueue.grantSendMessages(integrationRole)

    const sqsIntegration = new apigateway.AwsIntegration({
      service: 'sqs',
      path: `${cdk.Aws.ACCOUNT_ID}/${sqsQueue.queueName}`,
      integrationHttpMethod: 'POST',
      options: {
        credentialsRole: integrationRole,
        requestParameters: {
          'integration.request.header.Content-Type': "'application/x-www-form-urlencoded'",
        },
        requestTemplates: {
          'application/json': `Action=SendMessage&MessageBody=$input.body`,
        },
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': `{"message": "Message sent successfully."}`,
            },
          },
        ],
      },
    });

    const messages = api.root.addResource('messages');
    messages.addMethod('POST', sqsIntegration, {
      methodResponses: [
        {
          statusCode: '200',
        },
      ],
    });
  }
}
