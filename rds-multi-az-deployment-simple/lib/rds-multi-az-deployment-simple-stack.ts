import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class RdsMultiAzDeploymentSimpleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'MyVpc', {
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24
        },
        {
          name: 'PrivateWithEgressSubnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24
        },
      ],
      natGateways: 1,
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
    });

    // RDS Security Group
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc,
      description: 'Allow database access',
      allowAllOutbound: true,
    });

    dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(3306),
      'Allow MySQL access from any resource in the vpc'
    );

    const dbCredentials = new secretsmanager.Secret(this, 'DbCredentials', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }),
        generateStringKey: 'password',
        excludeCharacters: '/@"\' ',
      },
    });

    new rds.DatabaseInstance(this, 'MyRdsInstance', {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0_35,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      multiAz: true,
      allocatedStorage: 20,
      credentials: rds.Credentials.fromSecret(dbCredentials),
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [dbSecurityGroup],
      databaseName: 'MyDatabase',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });

    const ec2SecurityGroup = new ec2.SecurityGroup(this, 'Ec2SecurityGroup', {
      vpc,
      description: 'Allow SSH access',
      allowAllOutbound: true,
    });

    ec2SecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(22),
      'Allow SSH access within VPC'
    );

    const ec2UserData = ec2.UserData.forLinux()
    ec2UserData.addCommands(
      'sudo dnf install -y mariadb105'
    );
    const ec2Instance = new ec2.Instance(this, 'MyEc2Instance', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023 }),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroup: ec2SecurityGroup,
      userData: ec2UserData,
    });

    const instanceConnectSg = new ec2.SecurityGroup(this, 'InstanceConnectSG', {
      vpc,
      description: 'Security group for Instance Connect Endpoint',
    });
    const instanceConnectEndpoint = new ec2.CfnInstanceConnectEndpoint(this, 'MyCfnInstanceConnectEndpoint', {
      subnetId: vpc.privateSubnets[0].subnetId,
      securityGroupIds: [instanceConnectSg.securityGroupId],
    });
    instanceConnectEndpoint.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY)
    ec2SecurityGroup.addIngressRule(instanceConnectSg, ec2.Port.tcp(22));

    new cdk.CfnOutput(this, 'DbSecretName', {
      value: dbCredentials.secretName,
      description: 'The name of the secret storing RDS credentials',
    });

    new cdk.CfnOutput(this, 'Ec2InstanceId', {
      value: ec2Instance.instanceId,
      description: 'The ID of the EC2 instance',
    });
  }
}
