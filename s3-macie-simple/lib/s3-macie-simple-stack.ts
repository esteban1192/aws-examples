import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket, BlockPublicAccess } from 'aws-cdk-lib/aws-s3';
import * as macie from 'aws-cdk-lib/aws-macie';
import { Role, ServicePrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';

export class S3MacieSimpleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new Bucket(this, 'SensitiveDataBucket', {
      versioned: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
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

    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
    });

    new cdk.CfnOutput(this, 'MacieSessionStatus', {
      value: macieSession.status || 'DISABLED',
    });
  }
}
