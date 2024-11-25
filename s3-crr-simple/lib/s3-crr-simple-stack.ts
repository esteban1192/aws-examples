import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

export class S3CrrSimpleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Destination Bucket
    const destinationBucket = new s3.Bucket(this, 'DestinationBucket', {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development; remove in production
      autoDeleteObjects: true, // For development; remove in production
      bucketName: `destination-bucket-${this.account}`
    });

    // Source Bucket
    const sourceBucket = new s3.Bucket(this, 'SourceBucket', {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development; remove in production
      autoDeleteObjects: true, // For development; remove in production
      bucketName: `source-bucket-${this.account}`
    });

    // Create the CRR IAM Role
    const crrRole = new iam.Role(this, 'CRRRole', {
      assumedBy: new iam.ServicePrincipal('s3.amazonaws.com'),
    });

    // Add permissions for replication
    crrRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        's3:GetReplicationConfiguration',
        's3:ListBucket',
      ],
      resources: [`${sourceBucket.bucketArn}`], // List and get replication config for source bucket
    }));
    crrRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        's3:GetObjectVersionForReplication',
        's3:GetObjectVersionAcl',
        's3:GetObjectVersionTagging',
      ],
      resources: [`${sourceBucket.bucketArn}/*`], // Get object version metadata for source bucket
    }));
    crrRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        's3:ReplicateObject',
        's3:ReplicateDelete',
        's3:ReplicateTags',
      ],
      resources: [`${destinationBucket.bucketArn}/*`], // Allow replication to destination bucket
    }));

    // Add permissions for the source bucket to use the replication role
    sourceBucket.grantRead(crrRole);
    destinationBucket.grantWrite(crrRole);

    // Add Replication Configuration
    const sourceBucketCfn = sourceBucket.node.defaultChild as s3.CfnBucket;
    sourceBucketCfn.replicationConfiguration = {
      role: crrRole.roleArn,
      rules: [{
        id: 'ReplicateEverything',
        status: 'Enabled',
        destination: {
          bucket: destinationBucket.bucketArn,
        },
      }],
    };

    // Outputs
    new cdk.CfnOutput(this, 'SourceBucketName', {
      value: sourceBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'DestinationBucketName', {
      value: destinationBucket.bucketName,
    });
  }
}
