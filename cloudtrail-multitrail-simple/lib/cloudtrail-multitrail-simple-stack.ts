import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as logs from 'aws-cdk-lib/aws-logs';

export class CloudtrailMultitrailSimpleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const loggingBucket = new s3.Bucket(this, 'LoggingBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const watchedBucket1 = new s3.Bucket(this, 'WatchedBucket1', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    const watchedBucket2 = new s3.Bucket(this, 'WatchedBucket2', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const logGroup = new logs.LogGroup(this, 'TrailLogGroup', {
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      logGroupName: 'TrailLogGroup',
    });

    const dataEventTrail = new cloudtrail.Trail(this, 'DataEventTrail', {
      bucket: loggingBucket,
      includeGlobalServiceEvents: false,
      managementEvents: cloudtrail.ReadWriteType.NONE,
      sendToCloudWatchLogs: true,
      isMultiRegionTrail: false,
      cloudWatchLogGroup: logGroup
    });

    dataEventTrail.addS3EventSelector(
      [{ bucket: watchedBucket1 }],
      { readWriteType: cloudtrail.ReadWriteType.WRITE_ONLY }
    );
    dataEventTrail.addS3EventSelector(
      [{ bucket: watchedBucket2 }],
      { readWriteType: cloudtrail.ReadWriteType.WRITE_ONLY }
    );

    const metricFilter = new logs.MetricFilter(this, 'PutObjectMetricFilter', {
      logGroup,
      filterPattern: logs.FilterPattern.stringValue('$.eventName', '=', 'PutObject'),
      metricNamespace: 'CustomMetrics',
      metricName: 'PutObjectEvents',
      metricValue: '1',
      dimensions: {
        'BucketName': '$.requestParameters.bucketName'
      },
      filterName: 'PutObjectMetricFilter'
    });
  }
}
