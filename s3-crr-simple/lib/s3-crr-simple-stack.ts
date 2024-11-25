import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

interface S3CrrSimpleStackProps extends cdk.StackProps {
  destinationBucket: s3.Bucket
}
export class S3CrrSimpleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: S3CrrSimpleStackProps) {
    super(scope, id, props);

    const destinationBucket = props.destinationBucket;
    const sourceBucket = this.createSourceBucket();
    const crrRole = this.createCrrRole(sourceBucket, destinationBucket);

    this.setupBucketReplication(sourceBucket, destinationBucket, crrRole);
  }

  private createSourceBucket(): s3.Bucket {
    return new s3.Bucket(this, 'SourceBucket', {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development; remove in production
      autoDeleteObjects: true, // For development; remove in production
      bucketName: `source-bucket-${this.account}`
    });
  }

  private createCrrRole(sourceBucket: s3.Bucket, destinationBucket: s3.Bucket): iam.Role {
    const crrRole = new iam.Role(this, 'CRRRole', {
      assumedBy: new iam.ServicePrincipal('s3.amazonaws.com'),
      roleName: 'S3CRRRole'
    });

    // Add permissions for replication
    this.addReplicationPermissions(crrRole, sourceBucket, destinationBucket);

    // Grant the role necessary access to the buckets
    sourceBucket.grantRead(crrRole);
    destinationBucket.grantWrite(crrRole);

    return crrRole;
  }

  private addReplicationPermissions(crrRole: iam.Role, sourceBucket: s3.Bucket, destinationBucket: s3.Bucket): void {
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
  }

  private setupBucketReplication(sourceBucket: s3.Bucket, destinationBucket: s3.Bucket, crrRole: iam.Role): void {
    // Using the CloudFormation (Cfn) resource to directly configure replication
    // because the higher-level S3 construct does not expose the replication configuration directly.
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
  }
}
