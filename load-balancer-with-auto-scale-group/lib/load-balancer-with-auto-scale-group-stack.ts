import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as iam from 'aws-cdk-lib/aws-iam';

export class LoadBalancerWithAutoScaleGroupStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = this.createVpc();

    const albSecurityGroup = this.createAlbSecurityGroup(vpc);
    const alb = this.createAlb(vpc, albSecurityGroup);

    const asgSecurityGroup = this.createEc2SecurityGroupForAsg(vpc, albSecurityGroup);
    const asg = this.createAutoScalingGroup(vpc, asgSecurityGroup);

    this.setupAlbListenerAndTargets(alb, asg);

    this.addVpcEndpoints(vpc);

    this.outputAlbDns(alb);
  }

  private createVpc(): ec2.Vpc {
    return new ec2.Vpc(this, 'VPC', {
      maxAzs: 3,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
        },
      ],
    });
  }

  private addVpcEndpoints(vpc: ec2.Vpc): void {
    new ec2.InterfaceVpcEndpoint(this, 'SSMEndpoint', {
      vpc,
      service: ec2.InterfaceVpcEndpointAwsService.SSM,
    });
  }

  private createAlbSecurityGroup(vpc: ec2.Vpc): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'AlbSecurityGroup', { vpc });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow inbound HTTP traffic');
    return sg;
  }

  private createAlb(vpc: ec2.Vpc, albSecurityGroup: ec2.SecurityGroup): elbv2.ApplicationLoadBalancer {
    return new elbv2.ApplicationLoadBalancer(this, 'ApplicationLoadBalancer', {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
    });
  }

  private createEc2SecurityGroupForAsg(vpc: ec2.Vpc, albSecurityGroup: ec2.SecurityGroup): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'Ec2SecurityGroup', { vpc });
    sg.addIngressRule(albSecurityGroup, ec2.Port.tcp(80), 'Allow traffic from ALB');
    return sg;
  }
  private createAutoScalingGroup(vpc: ec2.Vpc, asgSecurityGroup: ec2.SecurityGroup): autoscaling.AutoScalingGroup {
    const role = new iam.Role(this, 'Ec2InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
    });

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'sudo dnf upgrade -y',
      'sudo dnf install -y httpd stress',
      'sudo systemctl enable httpd',
      'sudo systemctl start httpd',
      `echo "$HOSTNAME" | sudo tee /var/www/html/index.html`
    );

    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'AutoScalingGroup', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023 }),
      minCapacity: 1,
      desiredCapacity: 1,
      maxCapacity: 3,
      securityGroup: asgSecurityGroup,
      role,
      userData,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });
    autoScalingGroup.scaleOnCpuUtilization('CPUUtilizationScalingPolicy', {
      targetUtilizationPercent: 50
    });
    return autoScalingGroup;
  }

  private setupAlbListenerAndTargets(alb: elbv2.ApplicationLoadBalancer, asg: autoscaling.AutoScalingGroup): void {
    const listener = alb.addListener('HttpListener', { port: 80 });
    listener.addTargets('HttpTargetGroup', {
      port: 80,
      targets: [asg]
    });
  }

  private outputAlbDns(alb: elbv2.ApplicationLoadBalancer): void {
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      description: 'The DNS name of the load balancer',
    });
  }
}
