import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as waf from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';
import * as path from 'path';

export class WafSqlInjectionProtectionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const myLambda = new lambda.Function(this, 'MyLambdaFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda-function'))
    });

    const api = new apigw.RestApi(this, 'MyApi');
    const vulnerableEndpointResource = api.root.addResource('vulnerable-endpoint');
    vulnerableEndpointResource.addMethod('POST', new apigw.LambdaIntegration(myLambda));

    const webAcl = new waf.CfnWebACL(this, 'MyWebACL', {
      defaultAction: {
        allow: {}
      },
      scope: 'REGIONAL',
      name: 'MyWebACL',
      customResponseBodies: {
        blocked: {
          contentType: "APPLICATION_JSON",
          content: JSON.stringify({ error: "Request blocked by waf" }),
        }
      },
      rules: [
        {
          name: 'SQLInjectionRule',
          priority: 1,
          statement: {
            sqliMatchStatement: {
              fieldToMatch: {
                jsonBody: {
                  matchPattern: {
                    all: {}
                  },
                  matchScope: 'VALUE'
                }
              },
              textTransformations: [
                { priority: 0, type: 'URL_DECODE' },
                { priority: 1, type: 'LOWERCASE' }
              ]
            }
          },
          action: {
            block: {
              customResponse: {
                responseCode: 403,
                customResponseBodyKey: 'blocked'
              }
            }
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'SQLInjection',
            sampledRequestsEnabled: true
          }
        }
      ],      
      visibilityConfig: {
        cloudWatchMetricsEnabled: false,
        metricName: 'WebACL',
        sampledRequestsEnabled: false
      }
    });

    const aclAssociation = new waf.CfnWebACLAssociation(this, 'ApiGatewayWafAssociation', {
      resourceArn: api.deploymentStage.stageArn,
      webAclArn: webAcl.attrArn
    });
    aclAssociation.node.addDependency(api);
  }
}