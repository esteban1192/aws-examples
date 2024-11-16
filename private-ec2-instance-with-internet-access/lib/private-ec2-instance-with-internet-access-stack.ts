import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class PrivateEc2InstanceWithInternetAccessStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'MyVPC', {
      createInternetGateway: true, // This is the default
      maxAzs: 1, // Only one AZ for this example
      subnetConfiguration: [ // 1 public and 1 private subnet for each AZ
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

    const privateSubnet = vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
    }).subnets[0];

    const securityGroup = new ec2.SecurityGroup(this, 'InstanceSG', {
      vpc,
      allowAllOutbound: true, // This is the default
      description: 'Security group for private EC2 instance',
    });

    const instance = new ec2.Instance(this, 'PrivateInstance', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO), // Free tier ec2 instance
      machineImage: new ec2.AmazonLinuxImage({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2 }),
      vpcSubnets: { subnets: [privateSubnet] },
      securityGroup,
    });

    const instanceConnectSg = new ec2.SecurityGroup(this, 'InstanceConnectSG', {
      vpc,
      description: 'Security group for Instance Connect Endpoint',
      allowAllOutbound: true,
    });
    new ec2.CfnInstanceConnectEndpoint(this, 'MyCfnInstanceConnectEndpoint', {
      subnetId: privateSubnet.subnetId,
      securityGroupIds: [instanceConnectSg.securityGroupId]
    });
    securityGroup.addIngressRule(instanceConnectSg, ec2.Port.tcp(22));

    new cdk.CfnOutput(this, 'InstanceId', {
      value: instance.instanceId,
      description: 'ID of the private EC2 instance',
    });
  }
}
