import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class TransitGatewaySimpleVpcConnectionsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const transitGateway = this.createTransitGateway();

    const vpcs = [
      { id: 'VPC0', cidrBlock: '10.0.0.0/16' },
      { id: 'VPC1', cidrBlock: '10.1.0.0/16' },
      { id: 'VPC2', cidrBlock: '10.2.0.0/16' },
    ];

    const attachments = vpcs.map(({ id, cidrBlock }) => {
      const vpc = this.createVpc(id, cidrBlock);
      const attachment = this.createTransitGatewayAttachment(transitGateway, vpc, `Attachment-${id}`);
      this.addRouteToTransitGateway(vpc, transitGateway).forEach(route => route.addDependency(attachment));
      return { vpc, attachment };
    });

    attachments.forEach(({ vpc }) => {
      const instance = this.addEc2InstanceToIsolatedSubnet(vpc);
      this.createInstanceConnectEndpoint(instance, vpc);
    });
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
      vpcName: id
    });
  }

  private createTransitGatewayAttachment(
    transitGateway: ec2.CfnTransitGateway,
    vpc: ec2.Vpc,
    attachmentId: string
  ): ec2.CfnTransitGatewayAttachment {
    return new ec2.CfnTransitGatewayAttachment(this, attachmentId, {
      subnetIds: vpc.isolatedSubnets.map(subnet => subnet.subnetId),
      transitGatewayId: transitGateway.attrId,
      vpcId: vpc.vpcId,
    });
  }

  private addRouteToTransitGateway(vpc: ec2.Vpc, transitGateway: ec2.CfnTransitGateway): ec2.CfnRoute[] {
    return vpc.isolatedSubnets.map(subnet => new ec2.CfnRoute(this, `Route-${vpc.node.id}-${subnet.node.id}`, {
      routeTableId: subnet.routeTable.routeTableId,
      destinationCidrBlock: '0.0.0.0/0',
      transitGatewayId: transitGateway.attrId,
    }));
  }

  private createInstanceConnectEndpoint(instance: ec2.Instance, vpc: ec2.Vpc) {
    const instanceConnectEndpointSg = new ec2.SecurityGroup(this, `InstanceConnectSG-${vpc.node.id}`, {
      vpc,
      description: 'Security group for Instance Connect Endpoint',
    });

    const instanceConnectEndpoint = new ec2.CfnInstanceConnectEndpoint(this, `InstanceConnectEndpoint-${vpc.node.id}`, {
      subnetId: vpc.isolatedSubnets[0].subnetId,
      securityGroupIds: [instanceConnectEndpointSg.securityGroupId],
    });
    instanceConnectEndpoint.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    instance.connections.securityGroups.forEach((ec2InstanceSecurityGroup: ec2.ISecurityGroup) => {
      ec2InstanceSecurityGroup.addIngressRule(instanceConnectEndpointSg, ec2.Port.tcp(22));
    });
  }

  private addEc2InstanceToIsolatedSubnet(vpc: ec2.Vpc): ec2.Instance {
    const ec2Instance = new ec2.Instance(this, `Ec2Instance-${vpc.node.id}`, {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023 }),
      vpc,
      vpcSubnets: { subnets: vpc.isolatedSubnets },
    });

    ec2Instance.connections.securityGroups.forEach(ec2InstanceSecurityGroup => {
      ec2InstanceSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.icmpPing()); // Allow ping from anywhere
    });

    return ec2Instance;
  }
}
