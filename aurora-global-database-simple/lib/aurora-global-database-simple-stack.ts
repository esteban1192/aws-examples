import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as aws_rds from 'aws-cdk-lib/aws-rds';
import * as aws_ec2 from 'aws-cdk-lib/aws-ec2';
import { clusterEngine, vpcConfig } from '../constants/constants';
import { SecondaryClusterStack } from './secondary-cluster-stack';

interface GlobalDatabaseStackProps extends cdk.StackProps {
  secondaryRegions: string[]
}

export class AuroraGlobalDatabaseSimpleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GlobalDatabaseStackProps) {
    super(scope, id, props);

    const vpc = new aws_ec2.Vpc(this, 'AuroraVpc', vpcConfig);

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

    const globalCluster = new aws_rds.CfnGlobalCluster(this, 'GlobalCluster', {
      sourceDbClusterIdentifier: mainCluster.clusterIdentifier,
      globalClusterIdentifier: 'global-cluster'
    })

    props.secondaryRegions.forEach((secondaryRegion: string) => {
      if (globalCluster.globalClusterIdentifier === undefined) {
        throw new Error("Global Cluster Identifier needs to be provided");
      }
      const secondaryCluster = new SecondaryClusterStack(this, `SecondaryClusterStack-${secondaryRegion}`, {
        env: {
          region: secondaryRegion
        },
        globalClusterIdentifier: globalCluster.globalClusterIdentifier
      });
      secondaryCluster.addDependency(this);
    })
  }
}
