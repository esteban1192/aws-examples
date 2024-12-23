import { 
  Instance, 
  InstanceType, 
  Vpc, 
  SubnetType, 
  InstanceClass, 
  InstanceSize, 
  AmazonLinuxImage, 
  AmazonLinuxGeneration, 
  SecurityGroup, 
  Port, 
  UserData
} from 'aws-cdk-lib/aws-ec2';
import { Role, ServicePrincipal, ManagedPolicy } from 'aws-cdk-lib/aws-iam';

export const addPublicEc2ToVpc = (vpc: Vpc): Instance => {
  const instanceRole = new Role(vpc.stack, 'InstanceSSMRole', {
    assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
  });

  instanceRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

  const instanceSecurityGroup = new SecurityGroup(vpc.stack, 'InstanceSecurityGroup', {
    vpc,
    description: 'Security group for public EC2 instance',
    allowAllOutbound: true, // Allow all outbound traffic
  });

  const userData = UserData.forLinux()
  userData.addCommands('sudo dnf install -y mariadb105');

  const instance = new Instance(vpc.stack, 'MyPublicInstance', {
    instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
    machineImage: new AmazonLinuxImage({
      generation: AmazonLinuxGeneration.AMAZON_LINUX_2023,
    }),
    vpcSubnets: {
      subnetType: SubnetType.PUBLIC,
    },
    vpc,
    role: instanceRole,
    securityGroup: instanceSecurityGroup,
    userData
  });

  return instance;
};
