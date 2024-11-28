import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';

export class ServerlessSimpleImageProcessingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const originalsBucket = new s3.Bucket(this, 'OriginalsBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Only for dev environments
      bucketName: `originals-bucket-${this.account}`,
    });

    const thumbnailsBucket = new s3.Bucket(this, 'ThumbnailsBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Only for dev environments
      bucketName: `thumbnails-bucket-${this.account}`,
    });

    // CloudFront setup
    const oac = new cloudfront.S3OriginAccessControl(this, 'S3OriginAccessControl', {
      originAccessControlName: 'S3OriginAccessControl',
    });
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(thumbnailsBucket, {
      originAccessControl: oac,
    });
    new cloudfront.Distribution(this, 'CloudfrontDistribution', {
      defaultBehavior: {
        origin: s3Origin,
      },
    });

    // Lambda Function to handle image upload
    const layerVersion = new lambda.LayerVersion(this, 'UploadHandlerLayerVersion', {
      code: lambda.Code.fromAsset(path.join(__dirname, 'image-uploader', 'layer-version')),
    })
    const uploadHandler = new lambda.Function(this, 'UploadHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'image-uploader')),
      environment: {
        BUCKET_NAME: originalsBucket.bucketName,
      },
      layers: [layerVersion]
    });
    originalsBucket.grantPut(uploadHandler);

    const api = new apigateway.RestApi(this, 'ImageUploadApi', {
      restApiName: 'Image Upload API',
    });

    const imageResource = api.root.addResource('image');
    imageResource.addMethod('POST', new apigateway.LambdaIntegration(uploadHandler));
  }
}
