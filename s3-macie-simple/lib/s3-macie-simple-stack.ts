import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket, BlockPublicAccess } from 'aws-cdk-lib/aws-s3';
import * as macie from 'aws-cdk-lib/aws-macie';
import { Role, ServicePrincipal, PolicyStatement, PolicyDocument } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSub from 'aws-cdk-lib/aws-sns-subscriptions';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';

export class S3MacieSimpleStack extends cdk.Stack {
  private email: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.email = 'setyourownemail@example.com';

    const bucket = new Bucket(this, 'SensitiveDataBucket', {
      versioned: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const macieSession = new macie.CfnSession(this, 'MacieSession', {
      findingPublishingFrequency: 'FIFTEEN_MINUTES', // Options: FIFTEEN_MINUTES, ONE_HOUR, SIX_HOURS
      status: 'ENABLED',
    });

    const macieRole = new Role(this, 'MacieServiceRole', {
      assumedBy: new ServicePrincipal('macie.amazonaws.com'),
    });

    bucket.addToResourcePolicy(
      new PolicyStatement({
        actions: ['s3:GetObject', 's3:ListBucket'],
        resources: [
          bucket.bucketArn,
          `${bucket.bucketArn}/*`,
        ],
        principals: [macieRole.grantPrincipal],
      })
    );

    const lambdaRole = new Role(this, 'MacieLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        MaciePermissions: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: [
                'macie2:CreateClassificationJob',
                'macie2:DescribeClassificationJob',
                's3:ListAllMyBuckets',
                's3:GetBucketLocation',
              ],
              resources: ['*'], // Adjust as needed for more granular permissions
            }),
            new PolicyStatement({
              actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    const macieLambda = new lambda.Function(this, 'CreateMacieJobFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda-handler')),
      environment: {
        BUCKET_NAME: bucket.bucketName,
        AWS_ACCOUNT_ID: this.account
      },
      role: lambdaRole,
      functionName: 'CreateMacieJob',
    });

    const snsTopic = new sns.Topic(this, 'MacieFindingsTopic', {
      displayName: 'Macie Findings Notifications',
    });

    snsTopic.addSubscription(new snsSub.EmailSubscription(this.email));

    const eventRule = new events.Rule(this, 'MacieFindingsRule', {
      eventPattern: {
        source: ['aws.macie'],
        detailType: ['Macie Finding']
      }
    });

    eventRule.addTarget(new eventsTargets.SnsTopic(snsTopic));

    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
    });

    new cdk.CfnOutput(this, 'MacieSessionStatus', {
      value: macieSession.status || 'DISABLED',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: macieLambda.functionName,
    });

    new cdk.CfnOutput(this, 'SNSTopicArn', {
      value: snsTopic.topicArn,
    });
  }
}
