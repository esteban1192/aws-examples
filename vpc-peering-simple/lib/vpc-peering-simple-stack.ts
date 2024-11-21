import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';

export class VpcPeeringSimpleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc1 = this.createVpc('VPC1', '10.0.0.0/16');
    
    const publicSubnet = (vpc1.publicSubnets[0] as ec2.Subnet)

    const vpc2 = this.createVpc('VPC2', '10.1.0.0/16');
    const privateSubnet2 = vpc2.isolatedSubnets[0] as ec2.Subnet
    const privateSubnet3 = vpc2.isolatedSubnets[1] as ec2.Subnet;

    let subnets = [];
    if(privateSubnet2) subnets.push(privateSubnet2)
    if(privateSubnet3) subnets.push(privateSubnet3)

    const subnetGroup = this.createRdsSubnetGroup('VPC1PrivateSubnetGroup', vpc2, subnets);

    const vpcPeering = this.createVpcPeering('VpcPeering', vpc1, vpc2);

    this.addVpcPeeringRoutes(publicSubnet, vpc2.vpcCidrBlock, vpcPeering);
    if(privateSubnet2) this.addVpcPeeringRoutes(privateSubnet2, vpc1.vpcCidrBlock, vpcPeering);
    if(privateSubnet3) this.addVpcPeeringRoutes(privateSubnet3, vpc1.vpcCidrBlock, vpcPeering);

    const instanceSecurityGroup = this.createSecurityGroup('InstanceSG', vpc1, 'Allow SSH access', 22);
    const dbSecurityGroup = this.createDbSecurityGroup('DbSG', vpc2, instanceSecurityGroup);

    this.createEc2Instance('EC2Instance', vpc1, publicSubnet, instanceSecurityGroup);

    this.createRdsInstance('MySQLRDS', vpc2, dbSecurityGroup, subnetGroup);

    new cdk.CfnOutput(this, 'Vpc1Id', { value: vpc1.vpcId });
    new cdk.CfnOutput(this, 'Vpc2Id', { value: vpc2.vpcId });
    new cdk.CfnOutput(this, 'VpcPeeringId', { value: vpcPeering.ref });
  }

  private createVpc(id: string, cidr: string): ec2.Vpc {
    return new ec2.Vpc(this, id, {
      cidr,
      maxAzs: 2,
      subnetConfiguration: [  
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        }
      ]
    });
  }

  private createSubnet(vpc: ec2.Vpc, id: string, cidrBlock: string, availabilityZone: string, publicSubnet: boolean): ec2.PrivateSubnet {
    if(publicSubnet) return new ec2.PublicSubnet(this, id, {
      vpcId: vpc.vpcId,
      cidrBlock,
      availabilityZone,
    });
    return new ec2.PrivateSubnet(this, id, {
      vpcId: vpc.vpcId,
      cidrBlock,
      availabilityZone,
    });
  }

  private createRdsSubnetGroup(id: string, vpc: ec2.Vpc, subnets: ec2.Subnet[]): rds.SubnetGroup {
    return new rds.SubnetGroup(this, id, {
      vpc,
      description: 'The private subnet to place the RDS instance',
      vpcSubnets: { subnets },
    });
  }

  private createVpcPeering(id: string, vpc1: ec2.Vpc, vpc2: ec2.Vpc): ec2.CfnVPCPeeringConnection {
    return new ec2.CfnVPCPeeringConnection(this, id, {
      vpcId: vpc1.vpcId,
      peerVpcId: vpc2.vpcId,
    });
  }

  private addVpcPeeringRoutes(subnet: ec2.PrivateSubnet, destinationCidr: string, vpcPeering: ec2.CfnVPCPeeringConnection) {
    subnet.addRoute(`${subnet.node.id}RouteToPeering`, {
      destinationCidrBlock: destinationCidr,
      routerId: vpcPeering.attrId,
      routerType: ec2.RouterType.VPC_PEERING_CONNECTION,
    });
  }

  private createSecurityGroup(id: string, vpc: ec2.Vpc, description: string, port: number): ec2.SecurityGroup {
    const securityGroup = new ec2.SecurityGroup(this, id, {
      vpc,
      allowAllOutbound: true,
      securityGroupName: id,
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(port), description);
    return securityGroup;
  }

  private createDbSecurityGroup(id: string, vpc: ec2.Vpc, instanceSecurityGroup: ec2.SecurityGroup): ec2.SecurityGroup {
    const dbSecurityGroup = new ec2.SecurityGroup(this, id, {
      vpc,
      allowAllOutbound: true,
      securityGroupName: id,
    });
    dbSecurityGroup.addIngressRule(ec2.Peer.securityGroupId(instanceSecurityGroup.securityGroupId), ec2.Port.tcp(3306), 'Allow MySQL access from EC2 instance');
    return dbSecurityGroup;
  }

  private createEc2Instance(id: string, vpc: ec2.Vpc, subnet: ec2.ISubnet, securityGroup: ec2.SecurityGroup) {
    new ec2.Instance(this, id, {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023 }),
      vpc,
      securityGroup,
      vpcSubnets: { subnets: [subnet] },
    });
  }

  private createRdsInstance(id: string, vpc: ec2.Vpc, securityGroup: ec2.SecurityGroup, subnetGroup: rds.SubnetGroup) {
    new rds.DatabaseInstance(this, id, {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0_35,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      securityGroups: [securityGroup],
      subnetGroup,
      multiAz: false,
      allocatedStorage: 20,
      databaseName: 'MyDatabase',
      publiclyAccessible: false,
      deletionProtection: false,
    });
  }
}
