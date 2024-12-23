import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as aws_rds from 'aws-cdk-lib/aws-rds';
import * as aws_ec2 from 'aws-cdk-lib/aws-ec2';
import { clusterEngine, ec2InstanceType, rdsInstanceType, vpcConfig } from '../constants/constants';
import { addPublicEc2InstanceToVpc } from '../helpers/addPublicEc2ToVPC';

interface SecondaryClusterStackProps extends cdk.StackProps {
    globalClusterIdentifier: string;
    globalClusterArn: string;
}

export class SecondaryClusterStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: SecondaryClusterStackProps) {
        super(scope, id, props);

        const vpc = new aws_ec2.Vpc(this, 'SecondaryClusterVpc', vpcConfig);

        const instance = addPublicEc2InstanceToVpc(vpc);

        const ec2InstanceSecurityGroup = instance.connections.securityGroups[0];

        const subnetGroup = new aws_rds.CfnDBSubnetGroup(this, 'DBSubnetGroup', {
            dbSubnetGroupDescription: 'Subnet group for secondary cluster',
            subnetIds: vpc.isolatedSubnets.map(subnet => subnet.subnetId),
        });

        const clusterSecurityGroup = new aws_ec2.SecurityGroup(this, 'DBSecurityGroup', {
            vpc,
        });

        const cluster = new aws_rds.CfnDBCluster(this, 'Cluster', {
            globalClusterIdentifier: props.globalClusterIdentifier,
            engine: clusterEngine.engineType,
            engineVersion: clusterEngine.engineVersion?.fullVersion,
            dbSubnetGroupName: subnetGroup.ref,
            vpcSecurityGroupIds: [clusterSecurityGroup.securityGroupId],
            enableGlobalWriteForwarding: true,
        });

        clusterSecurityGroup.addIngressRule(
            ec2InstanceSecurityGroup,
            aws_ec2.Port.tcp(3306),
            'Allow EC2 instance to connect to Aurora Cluster'
        );

        const dbInstance = new aws_rds.CfnDBInstance(this, 'DBInstance', {
            dbClusterIdentifier: cluster.ref,
            dbInstanceClass: rdsInstanceType,
            engine: clusterEngine.engineType,
        });

        dbInstance.addDependency(cluster);
    }
}
