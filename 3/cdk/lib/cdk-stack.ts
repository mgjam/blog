import cdk = require('@aws-cdk/core');
import iam = require('@aws-cdk/aws-iam');
import lambda = require('@aws-cdk/aws-lambda');
import appsync = require('@aws-cdk/aws-appsync');

export class CdkStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const outputLambda = this.createOutputLambda();
        const api = this.createApi();
        const schema = this.createSchema(api);
        const outputDataSource = this.createOutputDataSource(api, outputLambda);
        this.creatGetOutputResolver(api, schema, outputDataSource);
        const apiAccessKey = this.createApiAccessKey(api);
        this.createApiOutputs(api);
        this.createApiAccessKeyOutputs(apiAccessKey);
    }

    private createOutputLambda(): lambda.Function {
        const name = 'OutputLambda';
    
        return new lambda.Function(this, name, {
          functionName: name,
          runtime: lambda.Runtime.DOTNET_CORE_2_1,
          code: lambda.Code.asset('../src/appsync/bin/Release/netcoreapp2.1/publish'),
          handler: 'appsync::appsync.Function::FunctionHandler',
          timeout: cdk.Duration.seconds(15)
        });
    }

    private createApi(): appsync.CfnGraphQLApi {
        const name = 'Api';
        const cloudWatchLogsRoleArn = this.createApiCloudWatchRole().roleArn

        return new appsync.CfnGraphQLApi(this, name, {
            name: name,
            authenticationType: 'AWS_IAM',
            logConfig: {
                fieldLogLevel: 'ERROR',
                cloudWatchLogsRoleArn: cloudWatchLogsRoleArn
            }
        });
    }

    private createApiCloudWatchRole(): iam.Role {
        const name = 'ApiCloudWatchRole';

        return new iam.Role(this, name, {
            roleName: name,
            assumedBy: new iam.ServicePrincipal('appsync.amazonaws.com'),
            managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSAppSyncPushToCloudWatchLogs')]
        })
    }

    private createSchema(
        api: appsync.CfnGraphQLApi
    ): appsync.CfnGraphQLSchema {
        const name = 'Schema';
        const definition = `
            type Output {
                Numbers: [Int!]!
            }

            type Query {
                getOutput(number: Int!, count: Int!): Output!
            }
        `;
        const schema = new appsync.CfnGraphQLSchema(this, name, {
            apiId: api.attrApiId,
            definition: definition
        });

        schema.addDependsOn(api);

        return schema;
    }

    private createOutputDataSource(
        api: appsync.CfnGraphQLApi, 
        outputLambda: lambda.Function,
    ): appsync.CfnDataSource {
        const name = 'OutputDataSource';
        const invokeRole = this.createOutputLambdaInvokeRole(outputLambda);
        const consignmentsDataSource = new appsync.CfnDataSource(this, name, {
            apiId: api.attrApiId,
            name: name,
            type: 'AWS_LAMBDA',
            lambdaConfig: {
                lambdaFunctionArn: outputLambda.functionArn
            },
            serviceRoleArn: invokeRole.roleArn
        });

        consignmentsDataSource.addDependsOn(api);

        return consignmentsDataSource;
    }

    private createOutputLambdaInvokeRole(
        outputLambda: lambda.Function
    ): iam.Role {
        const name = 'OutputLambdaAppSyncInvokeRole';
        const invokeRole = new iam.Role(this, name, {
            roleName: name,
            assumedBy: new iam.ServicePrincipal('appsync.amazonaws.com')
        });
      
        invokeRole.attachInlinePolicy(this.createOutputLambdaInvokePolicy(outputLambda));
    
        return invokeRole;
    }

    private createOutputLambdaInvokePolicy(
        outputLambda: lambda.Function
    ): iam.Policy {
        const name = 'OutputLambdaAppSyncInvokePolicy';

        return new iam.Policy(this, name, {
            policyName: name,
            statements: [new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [ 'lambda:InvokeFunction' ],
                resources: [ outputLambda.functionArn ]
            })]
        });
    }

    private creatGetOutputResolver(
        api: appsync.CfnGraphQLApi,
        schema: appsync.CfnGraphQLSchema,
        outputDataSource: appsync.CfnDataSource
    ) {
        const name = 'GetOutputResolver';
        const requestMappingTemplate = `{
            "version": "2017-02-28",
            "operation": "Invoke",
            "payload": {
                "Number": $utils.toJson($context.arguments.number),
                "Count": $utils.toJson($context.arguments.count)
            }
        }`;
        const responseMappingTemplate = `$utils.toJson($context.result)`;
        const getConsignmentsResolver = new appsync.CfnResolver(this, name, {
            apiId: api.attrApiId,
            typeName: 'Query',
            fieldName: 'getOutput',
            dataSourceName: outputDataSource.name,
            requestMappingTemplate: requestMappingTemplate,
            responseMappingTemplate: responseMappingTemplate
        });

        getConsignmentsResolver.addDependsOn(schema);
        getConsignmentsResolver.addDependsOn(outputDataSource);
    }

    private createApiAccessKey(
        api: appsync.CfnGraphQLApi
    ): iam.CfnAccessKey {
        const apiAccessGroup = this.createApiAccessGroup(api);
        const apiAccessUser = this.createApiAccessUser(apiAccessGroup);
        const name = 'ApiAccessKey';

        return  new iam.CfnAccessKey(this, name, {
            userName: apiAccessUser.userName
        });
    }

    private createApiAccessGroup(
        api: appsync.CfnGraphQLApi
    ): iam.Group {
        const name = 'ApiAccessGroup';
        const group = new iam.Group(this, name, {
            groupName: name
        });
    
        group.attachInlinePolicy(this.createApiAccessPolicy(api));
    
        return group;
    }

    private createApiAccessPolicy(
        api: appsync.CfnGraphQLApi
    ): iam.Policy {
        const name = 'ApiAccessPolicy';

        return new iam.Policy(this, name, {
            policyName: name,
            statements: [new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [ 'appsync:GraphQL' ],
                resources: [ api.attrArn + '/*' ]
            })]
        });
    }

    private createApiAccessUser(
        apiAccessGroup: iam.Group
    ): iam.User {
        const name = 'ApiAccessUser';

        return new iam.User(this, name, {
            groups: [ apiAccessGroup ],
            userName: name
        });
    }

    private createApiOutputs (
        api: appsync.CfnGraphQLApi
    ) {
        const name = 'ApiUrl';

        new cdk.CfnOutput(this, name, {
            value: api.attrGraphQlUrl
        });
    }
    
    private createApiAccessKeyOutputs(
        apiAccessKey: iam.CfnAccessKey
    ) {
        new cdk.CfnOutput(this, 'ApiAccessKeyId', {
            value: apiAccessKey.ref
        });
        new cdk.CfnOutput(this, 'ApiSecretAccessKey', {
            value: apiAccessKey.attrSecretAccessKey
        });
    }
}
