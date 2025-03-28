import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3_notifications from 'aws-cdk-lib/aws-s3-notifications'
import * as path from 'path';

export class ServerlessSimpleImageProcessingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const originalsBucket = this.createBucket('OriginalsBucket', `originals-bucket-${this.account}`);
    const thumbnailsBucket = this.createBucket('ThumbnailsBucket', `thumbnails-bucket-${this.account}`);

    const uploadHandler = this.createUploadHandler(originalsBucket);
    const thumbnailsGeneratorHandler = this.createThumbnailsGeneratorHandler(thumbnailsBucket);

    originalsBucket.grantPut(uploadHandler);
    thumbnailsBucket.grantPut(thumbnailsGeneratorHandler);
    originalsBucket.grantRead(thumbnailsGeneratorHandler);

    originalsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3_notifications.LambdaDestination(thumbnailsGeneratorHandler)
    );

    this.setupCloudFront(thumbnailsBucket);
    this.setupApiGateway(uploadHandler);
  }

  private createBucket(id: string, bucketName: string): s3.Bucket {
    return new s3.Bucket(this, id, {
      autoDeleteObjects: true, // Remove objects when the stack is destroyed
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
    return new lambda.Function(this, 'UploadHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'image-uploader')),
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
      functionName: 'OriginalsUploader'
    });
  }

  private createThumbnailsGeneratorHandler(bucket: s3.Bucket): lambda.Function {
    const layerVersion = new lambda.LayerVersion(this, 'ThumbnailsGeneratorHandlerLayerVersion', {
      code: lambda.Code.fromAsset(path.join(__dirname, 'thumbnails-generator', 'layer-version')),
    });
    return new lambda.Function(this, 'ThumbnailsGeneratorHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'thumbnails-generator')),
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
      functionName: 'ThumbnailsGenerator',
      layers: [layerVersion],
      timeout: cdk.Duration.seconds(10)
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
