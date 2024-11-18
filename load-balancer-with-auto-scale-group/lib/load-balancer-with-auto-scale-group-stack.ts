import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';

export class LoadBalancerWithAutoScaleGroupStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = this.createVpc();

    const instanceConnectSg = this.createInstanceConnectSecurityGroup(vpc);
    this.createInstanceConnectEndpoint(vpc, instanceConnectSg);

    const albSecurityGroup = this.createAlbSecurityGroup(vpc);
    const ec2SecurityGroup = this.createEc2SecurityGroup(vpc, albSecurityGroup, instanceConnectSg);

    const alb = this.createAlb(vpc, albSecurityGroup);

    const asg = this.createAutoScalingGroup(vpc, ec2SecurityGroup);

    this.addAlbListenerAndTargets(alb, asg);

    this.outputAlbDns(alb);
  }

  private createVpc(): ec2.Vpc {
    return new ec2.Vpc(this, 'VPC', {
      maxAzs: 3,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });
  }

  private createInstanceConnectSecurityGroup(vpc: ec2.Vpc): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'InstanceConnectSG', {
      vpc,
      description: 'Security group for Instance Connect Endpoint',
    });
    return sg;
  }

  private createInstanceConnectEndpoint(vpc: ec2.Vpc, securityGroup: ec2.SecurityGroup): ec2.CfnInstanceConnectEndpoint {
    const subnetId = vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnets[0].subnetId;
    return new ec2.CfnInstanceConnectEndpoint(this, 'MyCfnInstanceConnectEndpoint', {
      subnetId,
      securityGroupIds: [securityGroup.securityGroupId],
    });
  }

  private createAlbSecurityGroup(vpc: ec2.Vpc): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc,
    });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP traffic');
    return sg;
  }

  private createEc2SecurityGroup(vpc: ec2.Vpc, albSecurityGroup: ec2.SecurityGroup, instanceConnectEndpointSG: ec2.SecurityGroup): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'Ec2SecurityGroup', {
      vpc,
    });
    sg.addIngressRule(albSecurityGroup, ec2.Port.tcp(80), 'Allow HTTP traffic from ALB');
    sg.addIngressRule(instanceConnectEndpointSG, ec2.Port.tcp(22), 'Allow ssh connections from instance connect endpoint');
    return sg;
  }

  private createAlb(vpc: ec2.Vpc, securityGroup: ec2.SecurityGroup): elbv2.ApplicationLoadBalancer {
    return new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      internetFacing: true,
      securityGroup,
    });
  }

  private createAutoScalingGroup(vpc: ec2.Vpc, securityGroup: ec2.SecurityGroup): autoscaling.AutoScalingGroup {
    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'AutoScalingGroup', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2 }),
      minCapacity: 1,
      desiredCapacity: 1,
      maxCapacity: 3,
      securityGroup,
      userData: ec2.UserData.custom(`
        #!/bin/bash
        sudo amazon-linux-extras install epel
        sudo yum install -y stress
        sudo yum install -y httpd
        sudo systemctl enable httpd
        sudo systemctl start httpd
        sudo sh -c 'echo "$HOSTNAME" > /var/www/html/index.html'
      `),
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });
    autoScalingGroup.scaleOnCpuUtilization('KeepSpareCPU', {
      targetUtilizationPercent: 50
    });
    return autoScalingGroup;
  }

  private addAlbListenerAndTargets(alb: elbv2.ApplicationLoadBalancer, asg: autoscaling.AutoScalingGroup): void {
    const listener = alb.addListener('Listener', {
      port: 80,
    });
    listener.addTargets('TargetGroup', {
      port: 80,
      targets: [asg],
    });
  }

  private outputAlbDns(alb: elbv2.ApplicationLoadBalancer): void {
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
    });
  }
}
