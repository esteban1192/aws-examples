import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as s3 from 'aws-cdk-lib/aws-s3';

export class ServerlessSimpleImageProcessingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'OriginalsBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Only for dev environments
      bucketName: `originals-bucket-${this.account}`
    });
    const oac = new cloudfront.S3OriginAccessControl(this, 'S3OriginAccessControl', {
      originAccessControlName: 'S3OriginAccessControl',
    });
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(bucket, {
      originAccessControl: oac
    })
    new cloudfront.Distribution(this, 'CloudfrontDistribution', {
      defaultBehavior: {
        origin: s3Origin
      },
    });
  }
}
