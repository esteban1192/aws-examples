import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as iam from 'aws-cdk-lib/aws-iam';

export class Ec2ScheduledScalingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const instanceRole = new iam.Role(this, 'InstanceSSMRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });
  
    instanceRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

    const vpc = new ec2.Vpc(this, 'MyVpc', {
      maxAzs: 2,
    });

    const ami = new ec2.AmazonLinuxImage({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023,
      userData: ec2.UserData.custom(`
        #!/bin/bash
        sudo amazon-linux-extras install epel
        sudo yum install -y stress
      `),
    });

    const asg = new autoscaling.AutoScalingGroup(this, 'MyASG', {
      vpc,
      instanceType: new ec2.InstanceType('t3.micro'),
      machineImage: ami,
      minCapacity: 1,
      maxCapacity: 5,
      role: instanceRole
    });

    asg.scaleOnCpuUtilization('KeepSpareCPU', {
      targetUtilizationPercent: 50
    });

    asg.scaleOnSchedule('ScaleUpMorning', {
      schedule: autoscaling.Schedule.cron({
        hour: '0',
        minute: '40',
      }),
      minCapacity: 3,
    });

    asg.scaleOnSchedule('ScaleDownEvening', {
      schedule: autoscaling.Schedule.cron({
        hour: '0',
        minute: '50',
      }),
      minCapacity: 1,
    });
  }
}
