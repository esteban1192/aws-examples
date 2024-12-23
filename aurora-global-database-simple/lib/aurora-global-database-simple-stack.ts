import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as aws_rds from 'aws-cdk-lib/aws-rds';
import * as aws_ec2 from 'aws-cdk-lib/aws-ec2';
import { PrimaryClusterStack } from './primary-cluster-stack';
import { SecondaryClusterStack } from './secondary-cluster-stack';
import { addPublicEc2InstanceToVpc } from '../helpers/addPublicEc2ToVPC';

interface GlobalDatabaseStackProps extends cdk.StackProps {
  primaryRegion: string,
  secondaryRegions: string[]
}

export class AuroraGlobalDatabaseSimpleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GlobalDatabaseStackProps) {
    super(scope, id, props);

    const primaryClusterStack = new PrimaryClusterStack(this, 'PrimaryClusterStack', {
      env: {
        region: props.primaryRegion
      }
    });

    const { primaryCluster } = primaryClusterStack;

    const globalCluster = new aws_rds.CfnGlobalCluster(this, 'GlobalCluster', {
      sourceDbClusterIdentifier: primaryCluster.clusterIdentifier,
      globalClusterIdentifier: 'global-cluster'
    });
    globalCluster.node.addDependency(primaryClusterStack)

    props.secondaryRegions.forEach((secondaryRegion: string) => {
      if (globalCluster.globalClusterIdentifier === undefined) {
        throw new Error("Global Cluster Identifier needs to be provided");
      }
      const secondaryClusterStack = new SecondaryClusterStack(this, `SecondaryClusterStack-${secondaryRegion}`, {
        env: {
          region: secondaryRegion
        },
        globalClusterIdentifier: globalCluster.globalClusterIdentifier,
        globalClusterArn: primaryCluster.clusterArn,
        crossRegionReferences: true
      });
      secondaryClusterStack.node.addDependency(globalCluster);
    });
  }
}
