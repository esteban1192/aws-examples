import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as aws_rds from 'aws-cdk-lib/aws-rds';
import * as aws_ec2 from 'aws-cdk-lib/aws-ec2';
import * as cr from 'aws-cdk-lib/custom-resources';

interface SecondaryClusterStackProps extends cdk.StackProps {
    globalCluster: aws_rds.CfnGlobalCluster
}

export class SecondaryClusterStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: SecondaryClusterStackProps) {
        super(scope, id, props);

        const clusterIdentifier = `secondary-cluster-${this.region}`;

        const addRegionResource = new cr.AwsCustomResource(this, 'GlobalDBSecondaryCluster', {
            onUpdate: {
                service: 'RDS',
                action: 'CreateDBCluster',
                parameters: {
                    GlobalClusterIdentifier: props.globalCluster.globalClusterIdentifier,
                    DBClusterIdentifier: clusterIdentifier,
                    Engine: 'aurora-mysql',
                    MasterUsername: 'admin',
                    MasterUserPassword: 'somepassword'
                },
                physicalResourceId: {
                    id: 'GlobalDBSecondaryCluster',
                },
            },
            onDelete: {
                service: 'RDS',
                action: 'DeleteDBCluster',
                parameters: {
                    DBClusterIdentifier: clusterIdentifier,
                    SkipFinalSnapshot: true,
                },
            },
            policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
            }),
        });
    }
}