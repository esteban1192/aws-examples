import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as aws_rds from 'aws-cdk-lib/aws-rds';
import * as aws_ec2 from 'aws-cdk-lib/aws-ec2';

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

    const mainCluster = new aws_rds.DatabaseCluster(this, 'DatabaseCluster', {
      engine: aws_rds.DatabaseClusterEngine.auroraMysql({
        version: aws_rds.AuroraMysqlEngineVersion.VER_3_08_0,
      }),
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
    })

  }

  public getGlobalCluster(): aws_rds.CfnGlobalCluster {
    return this.globalCluster;
  }
}
