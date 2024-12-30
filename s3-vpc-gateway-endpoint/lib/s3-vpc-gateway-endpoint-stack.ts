import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export class S3VpcGatewayEndpointStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'MyVpc', {
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      createInternetGateway: false
    });

    const bucket = new s3.Bucket(this, 'MyBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        S3AccessPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['s3:GetObject', 's3:ListBucket'],
              resources: [
                `${bucket.bucketArn}`,
                `${bucket.bucketArn}/*`,
              ],
            }),
          ],
        }),
      },
    });

    new lambda.Function(this, 'MyLambda', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda-function')),
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
      role: lambdaRole,
    });

    const s3BucketEndpoint = new ec2.GatewayVpcEndpoint(this, 'VpcEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      vpc: vpc,
    });

    /**
     * https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-access.html
     * As of today that link says: "With gateway endpoints, the Principal element must be set to *. To specify a principal, use the aws:PrincipalArn condition key."
     */
    s3BucketEndpoint.addToPolicy(
      new iam.PolicyStatement({
        principals: [new iam.StarPrincipal()],
        actions: ['s3:GetObject', 's3:ListBucket'],
        effect: iam.Effect.ALLOW,
        resources: [
          `${bucket.bucketArn}`,
          `${bucket.bucketArn}/*`,
        ],
        conditions: {
          StringEquals: {
            'aws:PrincipalArn': lambdaRole.roleArn,
          },
        },
      })
    );
  }
}
