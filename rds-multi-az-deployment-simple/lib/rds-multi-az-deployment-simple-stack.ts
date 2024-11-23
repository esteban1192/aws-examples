import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class RdsMultiAzDeploymentSimpleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = this.createVpc();
    const dbCredentials = this.createDatabaseCredentials();
    const dbSecurityGroup = this.createDbSecurityGroup(vpc);
    this.createRdsInstance(vpc, dbCredentials, dbSecurityGroup);
    const ec2SecurityGroup = this.createEc2SecurityGroup(vpc);
    const ec2Instance = this.createEc2Instance(vpc, ec2SecurityGroup);
    this.createInstanceConnectEndpoint(vpc, ec2SecurityGroup);

    this.createOutputs(dbCredentials, ec2Instance);
  }

  private createVpc(): ec2.Vpc {
    return new ec2.Vpc(this, 'MyVpc', {
      maxAzs: 2,
      natGateways: 1,
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'PrivateWithEgress',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });
  }

  private createDatabaseCredentials(): secretsmanager.Secret {
    return new secretsmanager.Secret(this, 'DbCredentials', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }),
        generateStringKey: 'password',
        excludeCharacters: '/@"\' ',
      },
    });
  }

  private createDbSecurityGroup(vpc: ec2.Vpc): ec2.SecurityGroup {
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc,
      description: 'Allow database access',
      allowAllOutbound: true,
    });

    dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(3306),
      'Allow MySQL access from any resource in the VPC'
    );

    return dbSecurityGroup;
  }

  private createRdsInstance(vpc: ec2.Vpc, dbCredentials: secretsmanager.Secret, dbSecurityGroup: ec2.SecurityGroup) {
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
  }

  private createEc2SecurityGroup(vpc: ec2.Vpc): ec2.SecurityGroup {
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

    return ec2SecurityGroup;
  }

  private createEc2Instance(vpc: ec2.Vpc, ec2SecurityGroup: ec2.SecurityGroup): ec2.Instance {
    const ec2UserData = ec2.UserData.forLinux();
    ec2UserData.addCommands('sudo dnf install -y mariadb105');

    return new ec2.Instance(this, 'MyEc2Instance', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023 }),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroup: ec2SecurityGroup,
      userData: ec2UserData,
    });
  }

  private createInstanceConnectEndpoint(vpc: ec2.Vpc, ec2SecurityGroup: ec2.SecurityGroup): ec2.CfnInstanceConnectEndpoint {
    const instanceConnectSg = new ec2.SecurityGroup(this, 'InstanceConnectSG', {
      vpc,
      description: 'Security group for Instance Connect Endpoint',
    });

    const instanceConnectEndpoint = new ec2.CfnInstanceConnectEndpoint(this, 'MyCfnInstanceConnectEndpoint', {
      subnetId: vpc.privateSubnets[0].subnetId,
      securityGroupIds: [instanceConnectSg.securityGroupId],
    });

    instanceConnectEndpoint.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
    ec2SecurityGroup.addIngressRule(instanceConnectSg, ec2.Port.tcp(22));

    return instanceConnectEndpoint;
  }

  private createOutputs(dbCredentials: secretsmanager.Secret, ec2Instance: ec2.Instance) {
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
