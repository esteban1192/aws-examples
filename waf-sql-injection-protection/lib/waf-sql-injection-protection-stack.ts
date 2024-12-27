import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as waf from 'aws-cdk-lib/aws-wafv2';
import * as core from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class WafSqlInjectionProtectionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const myLambda = new lambda.Function(this, 'MyLambdaFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda-function')
    });

    const api = new apigw.RestApi(this, 'MyApi');
    const vulnerableEndpointResource = api.root.addResource('vulnerable-endpoint');
    vulnerableEndpointResource.addMethod('GET', new apigw.LambdaIntegration(myLambda));

    new waf.CfnWebACL(this, 'MyWebACL', {
      defaultAction: {
        allow: {}
      },
      scope: 'REGIONAL',
      name: 'MyWebACL',
      rules: [
        {
          name: 'SQLInjectionRule',
          priority: 1,
          statement: {
            sqliMatchStatement: {
              fieldToMatch: {
                jsonBody: {
                  matchPattern: {
                    all: 'ALL'
                  },
                  matchScope: 'VALUE'
                }
              },
              textTransformations: [],
            }
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: false,
            metricName: 'SQLInjection',
            sampledRequestsEnabled: false
          }
        }
      ],
      visibilityConfig: {
        cloudWatchMetricsEnabled: false,
        metricName: 'SQLInjection',
        sampledRequestsEnabled: false
      }
    });
  }
}