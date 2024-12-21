import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as aws_rds from 'aws-cdk-lib/aws-rds';
import * as aws_ec2 from 'aws-cdk-lib/aws-ec2';
import { clusterEngine, vpcConfig } from '../constants/constants';

interface SecondaryClusterStackProps extends cdk.StackProps {
    globalClusterIdentifier: string;
}

export class SecondaryClusterStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: SecondaryClusterStackProps) {
        super(scope, id, props);

        const vpc = new aws_ec2.Vpc(this, 'SecondaryClusterVpc', vpcConfig);

        const subnetGroup = new aws_rds.CfnDBSubnetGroup(this, 'DBSubnetGroup', {
            dbSubnetGroupDescription: 'Subnet group for secondary cluster',
            subnetIds: vpc.isolatedSubnets.map(subnet => subnet.subnetId),
        });

        const securityGroup = new aws_ec2.SecurityGroup(this, 'DBSecurityGroup', {
            vpc,
        });

        const cluster = new aws_rds.CfnDBCluster(this, 'Cluster', {
            globalClusterIdentifier: props.globalClusterIdentifier,
            engine: clusterEngine.engineType,
            engineVersion: clusterEngine.engineVersion?.fullVersion,
            dbSubnetGroupName: subnetGroup.ref,
            vpcSecurityGroupIds: [securityGroup.securityGroupId],
        });

        const dbInstance = new aws_rds.CfnDBInstance(this, 'DBInstance', {
            dbClusterIdentifier: cluster.ref,
            dbInstanceClass: 'db.r5.large',
            engine: clusterEngine.engineType
        });

        dbInstance.addDependency(cluster);
    }
}
