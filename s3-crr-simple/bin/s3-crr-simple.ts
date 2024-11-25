#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { S3CrrSimpleStack } from '../lib/s3-crr-simple-stack';
import { S3DestinationBucketStack } from '../lib/s3-destination-bucket-stack';

const app = new cdk.App();
const accountId = '000000000000' //set your own account id
const s3DestinationStack = new S3DestinationBucketStack(app, 'S3DestinationStack', {
  env: {
    region: 'sa-east-1',
    account: accountId
  },
});
const s3CrrSimpleStack = new S3CrrSimpleStack(app, 'S3CrrSimpleStack', {
  destinationBucket: s3DestinationStack.destinationBucket,
  env: {
    region: 'us-east-1',
    account: accountId
  }
});
s3CrrSimpleStack.addDependency(s3DestinationStack);