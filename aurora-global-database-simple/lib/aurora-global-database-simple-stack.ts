import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as aws_rds from 'aws-cdk-lib/aws-rds';
import * as aws_ec2 from 'aws-cdk-lib/aws-ec2';
import { clusterEngine } from './constants';
import { SecondaryClusterStack } from './secondary-cluster-stack';

export class AuroraGlobalDatabaseSimpleStack extends cdk.Stack {
  private globalCluster: aws_rds.CfnGlobalCluster;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new aws_ec2.Vpc(this, 'AuroraVpc', {
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PrivateSubnet',
          subnetType: aws_ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    const mainCluster = new aws_rds.DatabaseCluster(this, 'SourceDatabaseCluster', {
      engine: clusterEngine,
      vpc: vpc,
      vpcSubnets: {
        subnetType: aws_ec2.SubnetType.PRIVATE_ISOLATED,
      },
      writer: aws_rds.ClusterInstance.provisioned('ClusterWriterInstance', {
        instanceType: aws_ec2.InstanceType.of(aws_ec2.InstanceClass.R5, aws_ec2.InstanceSize.LARGE),
      }),
    });

    this.globalCluster = new aws_rds.CfnGlobalCluster(this, 'GlobalCluster', {
      sourceDbClusterIdentifier: mainCluster.clusterIdentifier,
      globalClusterIdentifier: 'global-cluster'
    })

    new SecondaryClusterStack(this, 'SecondaryClusterStackTest', {
      env: {
        region: 'us-east-2'
      },
      globalCluster: this.globalCluster
    });

  }

  public getGlobalCluster(): aws_rds.CfnGlobalCluster {
    return this.globalCluster;
  }
}
