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

    const originalsBucket = this.createBucket('OriginalsBucket', `originals-bucket-${this.account}`);
    const thumbnailsBucket = this.createBucket('ThumbnailsBucket', `thumbnails-bucket-${this.account}`);

    this.setupCloudFront(thumbnailsBucket);

    const uploadHandler = this.createUploadHandler(originalsBucket);
    this.setupApiGateway(uploadHandler);

    originalsBucket.grantPut(uploadHandler);
  }

  private createBucket(id: string, bucketName: string): s3.Bucket {
    return new s3.Bucket(this, id, {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Only for dev environments
      bucketName,
    });
  }

  private setupCloudFront(bucket: s3.Bucket): void {
    const oac = new cloudfront.S3OriginAccessControl(this, 'S3OriginAccessControl', {
      originAccessControlName: 'S3OriginAccessControl',
    });
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(bucket, {
      originAccessControl: oac,
    });
    new cloudfront.Distribution(this, 'CloudfrontDistribution', {
      defaultBehavior: {
        origin: s3Origin,
      },
    });
  }

  private createUploadHandler(bucket: s3.Bucket): lambda.Function {
    const layerVersion = new lambda.LayerVersion(this, 'UploadHandlerLayerVersion', {
      code: lambda.Code.fromAsset(path.join(__dirname, 'image-uploader', 'layer-version')),
    });

    return new lambda.Function(this, 'UploadHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'image-uploader')),
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
      layers: [layerVersion],
    });
  }

  private setupApiGateway(uploadHandler: lambda.Function): void {
    const api = new apigateway.RestApi(this, 'ImageUploadApi', {
      restApiName: 'Image Upload API',
    });

    const imageResource = api.root.addResource('image');
    imageResource.addMethod('POST', new apigateway.LambdaIntegration(uploadHandler));
  }
}
