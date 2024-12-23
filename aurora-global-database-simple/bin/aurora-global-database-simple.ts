#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuroraGlobalDatabaseSimpleStack } from '../lib/aurora-global-database-simple-stack';
import { SecondaryClusterStack } from '../lib/secondary-cluster-stack';

const app = new cdk.App();
const primaryRegion = 'us-east-1';
const secondaryRegions = [
  // 'sa-east-1',
  'eu-west-2'
];

new AuroraGlobalDatabaseSimpleStack(app, 'AuroraGlobalDatabaseSimpleStack', {
  env: {
    region: primaryRegion
  },
  secondaryRegions: secondaryRegions,
  primaryRegion: primaryRegion
});