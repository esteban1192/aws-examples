import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling'

export class EfsEc2SimpleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 3,
      subnetConfiguration: [
        {
          name: 'IsolatedSubnet',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
        {
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
      natGateways: 0
    });

    const fileSystemSecurityGroup = new ec2.SecurityGroup(this, 'EFSSecurityGroup', {
      vpc,
    });
    const fileSystem = new efs.FileSystem(this, 'FileSystem', {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroup: fileSystemSecurityGroup,
      enableAutomaticBackups: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const instancesSecurityGroup = new ec2.SecurityGroup(this, 'InstancesSecurityGroup', {
      vpc,
    });
    fileSystemSecurityGroup.addIngressRule(
      ec2.Peer.securityGroupId(instancesSecurityGroup.securityGroupId),
      ec2.Port.NFS,
      'Allow instances to access EFS'
    );

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'sudo dnf update -y',
      'sudo dnf install -y amazon-efs-utils',
      'mkdir -p /mnt/efs',
      `sudo mount -t efs -o tls -o iam ${fileSystem.fileSystemId}:/ /mnt/efs/`,
      'sudo chown ec2-user /mnt/efs'
    );

    const instancesRole = new iam.Role(this, 'SSMRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });
    instancesRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));
    fileSystem.grant(instancesRole, 'elasticfilesystem:ClientMount', 'elasticfilesystem:ClientWrite');

    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, `AutoScalingGroup`, {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023
      }),
      securityGroup: instancesSecurityGroup,
      role: instancesRole,
      minCapacity: 3,
      maxCapacity: 3,
      userData: userData
    });
    autoScalingGroup.node.addDependency(fileSystem);
  };
}
