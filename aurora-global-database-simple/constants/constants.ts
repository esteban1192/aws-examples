import * as aws_rds from 'aws-cdk-lib/aws-rds';
import * as aws_ec2 from 'aws-cdk-lib/aws-ec2';

export const clusterEngine = aws_rds.DatabaseClusterEngine.auroraMysql({
    version: aws_rds.AuroraMysqlEngineVersion.VER_3_08_0,
});

export const vpcConfig: aws_ec2.VpcProps = {
    maxAzs: 2,
    subnetConfiguration: [
        {
            cidrMask: 24,
            name: 'PrivateSubnet',
            subnetType: aws_ec2.SubnetType.PRIVATE_ISOLATED,
        },
        {
            cidrMask: 24,
            name: 'PublicSubnet',
            subnetType: aws_ec2.SubnetType.PUBLIC,
        },
    ],
    natGateways: 0
}

const instanceClass = aws_ec2.InstanceClass.R5;
const instanceSize = aws_ec2.InstanceSize.LARGE
export const ec2InstanceType = aws_ec2.InstanceType.of(instanceClass, instanceSize)
export const rdsInstanceType = `db.${instanceClass}.${instanceSize}`;