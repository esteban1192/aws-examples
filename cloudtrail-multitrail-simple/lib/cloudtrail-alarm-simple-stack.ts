import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

export class CloudtrailMultitrailSimpleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const logGroup = new logs.LogGroup(this, 'TrailLogGroup', {
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      logGroupName: 'TrailLogGroup',
    });

    new cloudtrail.Trail(this, 'IamEventTrail', {
      includeGlobalServiceEvents: false,
      managementEvents: cloudtrail.ReadWriteType.WRITE_ONLY,
      sendToCloudWatchLogs: true,
      isMultiRegionTrail: false,
      cloudWatchLogGroup: logGroup,
    });

    const metricFilter = new logs.MetricFilter(this, 'IamChangeMetricFilter', {
      logGroup,
      filterPattern: logs.FilterPattern.stringValue('$.eventSource', '=', 'lambda.amazonaws.com'),
      metricNamespace: 'IAMMetrics',
      metricName: 'IamChanges',
      metricValue: '1',
      filterName: 'IamChangeMetricFilter',
      dimensions: {
        EventSource: '$.eventSource'
      }
    });

    const alarm = new cloudwatch.Alarm(this, 'IamChangeAlarm', {
      metric: metricFilter.metric({
        statistic: cloudwatch.Stats.SUM,
        dimensionsMap: {
          EventSource: 'lambda.amazonaws.com'
        }
      }),
      threshold: 1,
      evaluationPeriods: 1,
    });

    const topic = new sns.Topic(this, 'IamChangeNotificationTopic', {
      displayName: 'IAM Change Notification Topic',
    });

    topic.addSubscription(new sns_subscriptions.EmailSubscription('estebanospinasaldarriaga@gmail.com'));

    alarm.addAlarmAction({
      bind: () => ({
        alarmActionArn: topic.topicArn,
      }),
    });
  }
}
