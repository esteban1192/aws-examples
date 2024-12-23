import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as aws_rds from 'aws-cdk-lib/aws-rds';
import * as aws_ec2 from 'aws-cdk-lib/aws-ec2';
import { clusterEngine, vpcConfig } from '../constants/constants';
import { SecondaryClusterStack } from './secondary-cluster-stack';
import { addPublicEc2ToVpc } from '../helpers/addPublicEc2ToVPC';

interface GlobalDatabaseStackProps extends cdk.StackProps {
  secondaryRegions: string[]
}

export class AuroraGlobalDatabaseSimpleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GlobalDatabaseStackProps) {
    super(scope, id, props);

    const vpc = new aws_ec2.Vpc(this, 'AuroraVpc', vpcConfig);

    const mainClusterSecurityGroup = new aws_ec2.SecurityGroup(this, 'MainClusterSecurityGroup', {
      vpc,
      description: 'Security group for Aurora main cluster',
      allowAllOutbound: true,
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
      securityGroups: [mainClusterSecurityGroup],
    });

    const globalCluster = new aws_rds.CfnGlobalCluster(this, 'GlobalCluster', {
      sourceDbClusterIdentifier: mainCluster.clusterIdentifier,
      globalClusterIdentifier: 'global-cluster'
    });

    const instance = addPublicEc2ToVpc(vpc);

    const ec2InstanceSecurityGroup = instance.connections.securityGroups[0];

    mainClusterSecurityGroup.addIngressRule(
      ec2InstanceSecurityGroup,
      aws_ec2.Port.tcp(3306), // Adjust port based on your Aurora engine
      'Allow EC2 instance to connect to Aurora Cluster'
    );

    props.secondaryRegions.forEach((secondaryRegion: string) => {
      if (globalCluster.globalClusterIdentifier === undefined) {
        throw new Error("Global Cluster Identifier needs to be provided");
      }
      const secondaryCluster = new SecondaryClusterStack(this, `SecondaryClusterStack-${secondaryRegion}`, {
        env: {
          region: secondaryRegion
        },
        globalClusterIdentifier: globalCluster.globalClusterIdentifier,
        globalClusterArn: mainCluster.clusterArn,
        crossRegionReferences: true
      });
      secondaryCluster.addDependency(this);
    });
  }
}
