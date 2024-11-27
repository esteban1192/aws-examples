import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class TransitGatewaySimpleVpcConnectionsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const transitGateway = this.createTransitGateway();

    const vpc0 = this.createVpc('VPC0', '10.0.0.0/16');
    const vpc1 = this.createVpc('VPC1', '10.1.0.0/16');
    const vpc2 = this.createVpc('VPC2', '10.2.0.0/16');

    this.createTransitGatewayAttachment(transitGateway, vpc0, 'Attachment-VPC0');
    this.createTransitGatewayAttachment(transitGateway, vpc1, 'Attachment-VPC1');
    this.createTransitGatewayAttachment(transitGateway, vpc2, 'Attachment-VPC2');

    this.addEc2InstanceToIsolatedSubnet(vpc0);
    this.addEc2InstanceToIsolatedSubnet(vpc1);
    this.addEc2InstanceToIsolatedSubnet(vpc2);
  }

  private createTransitGateway(): ec2.CfnTransitGateway {
    return new ec2.CfnTransitGateway(this, 'MyTransitGateway', {
      amazonSideAsn: 64512,
      description: 'A central Transit Gateway for private subnet attachments',
      autoAcceptSharedAttachments: 'enable',
      defaultRouteTableAssociation: 'enable',
      defaultRouteTablePropagation: 'enable',
    });
  }

  private createVpc(id: string, cidrBlock: string): ec2.Vpc {
    return new ec2.Vpc(this, id, {
      createInternetGateway: false,
      ipAddresses: ec2.IpAddresses.cidr(cidrBlock),
      maxAzs: 1,
      subnetConfiguration: [
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });
  }

  private createTransitGatewayAttachment(
    transitGateway: ec2.CfnTransitGateway,
    vpc: ec2.Vpc,
    attachmentId: string
  ): void {
    new ec2.CfnTransitGatewayAttachment(this, attachmentId, {
      subnetIds: vpc.isolatedSubnets.map(subnet => subnet.subnetId),
      transitGatewayId: transitGateway.attrId,
      vpcId: vpc.vpcId,
    });
  }

  private addEc2InstanceToIsolatedSubnet(vpc: ec2.Vpc) {
    new ec2.Instance(this, `Ec2Instance-${vpc.node.id}`, {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023 }),
      vpc,
      vpcSubnets: { subnets: vpc.isolatedSubnets },
    });
  }
}
