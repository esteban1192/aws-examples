import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

export class PrivateEc2InstanceWithInternetAccessStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the VPC
    const subnetConfiguration: ec2.SubnetConfiguration[] = [
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
    ];
    const vpc = new ec2.Vpc(this, 'MyVPC', {
      createInternetGateway: true,
      maxAzs: 1,
      natGatewayProvider: ec2.NatProvider.gateway(),
      natGateways: 1,
      subnetConfiguration,
    });

    // Add the EC2 instance
    const subnetSelection: ec2.SubnetSelection = {
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
    };
    const instanceRole = new iam.Role(this, 'InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });
    new ec2.Instance(this, 'PrivateInstance', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({ 
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023 
      }),
      vpcSubnets: subnetSelection,
      role: instanceRole
    });

    /**
     * Add an interface endpoint to
     * connect using Session Manager
     */
    new ec2.InterfaceVpcEndpoint(this, 'SSMEndpoint', {
      vpc,
      service: ec2.InterfaceVpcEndpointAwsService.SSM
    });
  }
}
