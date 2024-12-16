import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

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

    const mathExpression = new cloudwatch.MathExpression({
      expression: '(bucket1Metric > 7) + (bucket2Metric > 7)',
      usingMetrics: {
        bucket1Metric: metricFilter.metric({
          dimensionsMap: {
            'BucketName': watchedBucket1.bucketName
          },
          statistic: cloudwatch.Stats.SUM
        }),
        bucket2Metric: metricFilter.metric({
          dimensionsMap: {
            'BucketName': watchedBucket2.bucketName
          },
          statistic: cloudwatch.Stats.SUM
        })
      },
    });

    const alarm = new cloudwatch.Alarm(this, 'Alarm', {
      metric: mathExpression,
      threshold: 1,
      evaluationPeriods: 1,
    });

    const topic = new sns.Topic(this, 'AlarmNotificationTopic', {
      displayName: 'Alarm Notification Topic',
    });

    topic.addSubscription(new sns_subscriptions.EmailSubscription('estebanospinasaldarriaga@gmail.com'));

    alarm.addAlarmAction({
      bind: () => ({
        alarmActionArn: topic.topicArn,
      }),
    });
  }
}
