import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class PrivateEc2InstanceWithInternetAccessStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'MyVPC', {
      maxAzs: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    const privateSubnet = vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnets[0];

    const privateInstanceSG = new ec2.SecurityGroup(this, 'InstanceSG', {
      vpc,
      description: 'Security group for private EC2 instance',
    });

    const privateInstance = new ec2.Instance(this, 'PrivateInstance', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2 }),
      vpcSubnets: { subnets: [privateSubnet] },
      securityGroup: privateInstanceSG,
    });

    const instanceConnectSg = new ec2.SecurityGroup(this, 'InstanceConnectSG', {
      vpc,
      description: 'Security group for Instance Connect Endpoint',
    });

    new ec2.CfnInstanceConnectEndpoint(this, 'MyCfnInstanceConnectEndpoint', {
      subnetId: privateSubnet.subnetId,
      securityGroupIds: [instanceConnectSg.securityGroupId],
    });

    privateInstanceSG.addIngressRule(instanceConnectSg, ec2.Port.tcp(22));

    new cdk.CfnOutput(this, 'InstanceId', {
      value: privateInstance.instanceId,
      description: 'ID of the private EC2 instance',
    });
  }
}
