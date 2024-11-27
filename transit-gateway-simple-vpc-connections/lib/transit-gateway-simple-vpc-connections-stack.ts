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

    const attachment0 = this.createTransitGatewayAttachment(transitGateway, vpc0, 'Attachment-VPC0');
    attachment0.addDependency(transitGateway)
    const attachment1 = this.createTransitGatewayAttachment(transitGateway, vpc1, 'Attachment-VPC1');
    attachment1.addDependency(transitGateway);
    const attachment2 = this.createTransitGatewayAttachment(transitGateway, vpc2, 'Attachment-VPC2');
    attachment2.addDependency(transitGateway);

    this.addRouteToTransitGateway(vpc0, transitGateway).map((route) => route.addDependency(attachment0))
    this.addRouteToTransitGateway(vpc1, transitGateway).map((route) => route.addDependency(attachment1))
    this.addRouteToTransitGateway(vpc2, transitGateway).map((route) => route.addDependency(attachment2))

    const instance0 = this.addEc2InstanceToIsolatedSubnet(vpc0);
    const instance1 = this.addEc2InstanceToIsolatedSubnet(vpc1);
    const instance2 = this.addEc2InstanceToIsolatedSubnet(vpc2);

    [
      { instance: instance0, vpc: vpc0 }, 
      { instance: instance1, vpc: vpc1 },
      { instance: instance2, vpc: vpc2 }
    ].map(({instance, vpc}) => {
      this.createInstanceConnectEndpoint(instance, vpc)
    })
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
  ): ec2.CfnTransitGatewayAttachment {
    return new ec2.CfnTransitGatewayAttachment(this, attachmentId, {
      subnetIds: vpc.isolatedSubnets.map(subnet => subnet.subnetId),
      transitGatewayId: transitGateway.attrId,
      vpcId: vpc.vpcId,
    });
  }

  // Add route to transit gateway in each isolated subnet's route table
  private addRouteToTransitGateway(vpc: ec2.Vpc, transitGateway: ec2.CfnTransitGateway): ec2.CfnRoute[] {
    return vpc.isolatedSubnets.map(subnet => {
      return new ec2.CfnRoute(this, `Route-${vpc.node.id}-${subnet.node.id}`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: '0.0.0.0/0', // You can adjust the CIDR block as needed
        transitGatewayId: transitGateway.attrId,
      });
    });
  }

  private createInstanceConnectEndpoint(instance: ec2.Instance, vpc: ec2.Vpc) {
    const instanceConnectEndpointSg = new ec2.SecurityGroup(this, `InstanceConnectSG-${vpc.node.id}`, {
      vpc,
      description: 'Security group for Instance Connect Endpoint',
    })

    const instanceConnectEndpoint = new ec2.CfnInstanceConnectEndpoint(this, `InstanceConnectEndpoint${vpc.node.id}`, {
      subnetId: vpc.isolatedSubnets[0].subnetId,
      securityGroupIds: [instanceConnectEndpointSg.securityGroupId]
    });
    instanceConnectEndpoint.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    instance.connections.securityGroups.map((ec2InstanceSecurityGroup: ec2.ISecurityGroup) => {
      ec2InstanceSecurityGroup.addIngressRule(instanceConnectEndpointSg, ec2.Port.tcp(22))
    });
  }

  private addEc2InstanceToIsolatedSubnet(vpc: ec2.Vpc): ec2.Instance {
    const ec2Instance = new ec2.Instance(this, `Ec2Instance-${vpc.node.id}`, {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023 }),
      vpc,
      vpcSubnets: { subnets: vpc.isolatedSubnets },
    });
    ec2Instance.connections.securityGroups.map(ec2InstanceSecurityGroup => {
      ec2InstanceSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.icmpPing()) // Allow ping from anywhere
    })
    return ec2Instance;
  }
}
