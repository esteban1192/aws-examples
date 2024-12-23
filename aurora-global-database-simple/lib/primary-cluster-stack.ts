import * as aws_ec2 from 'aws-cdk-lib/aws-ec2';
import * as aws_rds from 'aws-cdk-lib/aws-rds';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { clusterEngine, ec2InstanceType, vpcConfig } from '../constants/constants';
import { addPublicEc2InstanceToVpc } from '../helpers/addPublicEc2ToVPC';

export class PrimaryClusterStack extends cdk.Stack {
  public readonly primaryCluster: aws_rds.DatabaseCluster;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new aws_ec2.Vpc(this, 'AuroraVpc', vpcConfig);

    const primaryClusterSecurityGroup = new aws_ec2.SecurityGroup(this, 'PrimaryClusterSecurityGroup', {
      vpc: vpc,
      description: 'Security group for Aurora primary cluster',
      allowAllOutbound: true,
    });

    this.primaryCluster = new aws_rds.DatabaseCluster(this, 'SourceDatabaseCluster', {
      engine: clusterEngine,
      vpc: vpc,
      vpcSubnets: {
        subnetType: aws_ec2.SubnetType.PRIVATE_ISOLATED,
      },
      writer: aws_rds.ClusterInstance.provisioned('ClusterWriterInstance', {
        instanceType: ec2InstanceType,
      }),
      securityGroups: [primaryClusterSecurityGroup],
    });

    const instance = addPublicEc2InstanceToVpc(vpc);

    const ec2InstanceSecurityGroup = instance.connections.securityGroups[0];

    primaryClusterSecurityGroup.addIngressRule(
      ec2InstanceSecurityGroup,
      aws_ec2.Port.tcp(3306),
      'Allow EC2 instance to connect to Aurora Cluster'
    );
  }
}