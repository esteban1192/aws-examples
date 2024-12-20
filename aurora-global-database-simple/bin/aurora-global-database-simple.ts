#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuroraGlobalDatabaseSimpleStack } from '../lib/aurora-global-database-simple-stack';
import { SecondaryClusterStack } from '../lib/secondary-cluster-stack';

const app = new cdk.App();
const globalDatabaseStack = new AuroraGlobalDatabaseSimpleStack(app, 'AuroraGlobalDatabaseSimpleStack', {
  env: {
    region: 'us-east-1'
  }
});

new SecondaryClusterStack(app, 'SecondaryClusterStack', {
  env: {
    region: 'us-east-2'
  },
  globalCluster: globalDatabaseStack.getGlobalCluster()
});