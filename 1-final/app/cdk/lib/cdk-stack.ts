import cdk = require('@aws-cdk/core');
import lambda = require('@aws-cdk/aws-lambda');

export class CdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    new lambda.Function(this, 'MyLambdaFunction', {
      functionName: 'MyLambdaFunction',
      runtime: lambda.Runtime.DOTNET_CORE_2_1,
      code: lambda.Code.asset('../src/app/bin/Release/netcoreapp2.1/publish'),
      handler: 'app::app.Function::FunctionHandler',
      timeout: cdk.Duration.seconds(15)
    });
  }
}
