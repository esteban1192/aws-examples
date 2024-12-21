import * as aws_rds from 'aws-cdk-lib/aws-rds';
import * as aws_ec2 from 'aws-cdk-lib/aws-ec2';

export const clusterEngine = aws_rds.DatabaseClusterEngine.auroraMysql({
    version: aws_rds.AuroraMysqlEngineVersion.VER_3_08_0,
});

export const vpcConfig = {
    maxAzs: 2,
    subnetConfiguration: [
        {
            cidrMask: 24,
            name: 'PrivateSubnet',
            subnetType: aws_ec2.SubnetType.PRIVATE_ISOLATED,
        },
    ],
}