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
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
    });

    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc,
      description: 'Allow database access',
      allowAllOutbound: true,
    });

    dbSecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(3306), 'Allow MySQL access from any resource in the vpc');

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
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [dbSecurityGroup],
      databaseName: 'MyDatabase',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });

    new cdk.CfnOutput(this, 'DbSecretName', {
      value: dbCredentials.secretName,
      description: 'The name of the secret storing RDS credentials',
    });
  }
}
