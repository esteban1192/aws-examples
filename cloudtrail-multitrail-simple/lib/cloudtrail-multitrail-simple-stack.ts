import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';

export class CloudtrailMultitrailSimpleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const loggingBucket = new s3.Bucket(this, 'LoggingBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const watchedBucket = new s3.Bucket(this, 'WatchedBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const dataEventTrail = new cloudtrail.Trail(this, 'DataEventTrail', {
      bucket: loggingBucket,
      includeGlobalServiceEvents: false,  // Do not include global service events
      managementEvents: cloudtrail.ReadWriteType.NONE, // Only log data events, not management events
      sendToCloudWatchLogs: true,
      isMultiRegionTrail: false,
    });

    dataEventTrail.addS3EventSelector(
      [{ bucket: watchedBucket }],
      { readWriteType: cloudtrail.ReadWriteType.ALL }
    );
  }
}
