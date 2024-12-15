import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

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
      includeGlobalServiceEvents: false,
      managementEvents: cloudtrail.ReadWriteType.NONE,
      sendToCloudWatchLogs: true,
      isMultiRegionTrail: false,
    });

    const logGroup = dataEventTrail.logGroup as logs.LogGroup;

    dataEventTrail.addS3EventSelector(
      [{ bucket: watchedBucket }],
      { readWriteType: cloudtrail.ReadWriteType.ALL }
    );

    // Create a Metric Filter for 'PutObject' events
    const metricFilter = new logs.MetricFilter(this, 'PutObjectMetricFilter', {
      logGroup,
      filterPattern: logs.FilterPattern.stringValue('$.eventName', '=', 'PutObject'),
      metricNamespace: 'CustomMetrics',
      metricName: 'PutObjectEvents',
      metricValue: '1',
      dimensions: {
        'eventName': '$.eventName'
      },
      filterName: 'MultitrailTest'
    });
  }
}
