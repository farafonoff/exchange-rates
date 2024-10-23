import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class AwsStack extends cdk.Stack {
  /**
   * Constructs a new instance of the AWS stack.
   *
   * This stack includes a Lambda function (`ExchangeRateHandler`) which is configured with the following properties:
   * - Runtime: Node.js 18.x
   * - Architecture: ARM 64
   * - Entry point: `exchange-rate-lambda/index.ts`
   * - Handler: `handler`
   * - External modules: `aws-sdk`
   *
   * The Lambda function is granted permission to be invoked directly by other AWS services.
   *
   * To get the URL of the Lambda function, you can use the AWS Management Console or AWS CLI:
   * 
   * **Using AWS Management Console:**
   * 1. Navigate to the AWS Lambda service.
   * 2. Find and select the `ExchangeRateHandler` function.
   * 3. In the function's configuration tab, locate the "Function URL" section to get the URL.
   *
   * **Using AWS CLI:**
   * ```sh
   * aws lambda get-function-url-config --function-name ExchangeRateHandler
   * ```
   *
   * @param scope - The scope in which this construct is defined.
   * @param id - The scoped construct ID.
   * @param props - Stack properties.
   */
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const exchangeRateTable = new cdk.aws_dynamodb.Table(this, 'ExchangeRateTable', {
      partitionKey: { name: 'pair', type: cdk.aws_dynamodb.AttributeType.STRING },
      sortKey: { name: 'date', type: cdk.aws_dynamodb.AttributeType.STRING },
      billingMode: cdk.aws_dynamodb.BillingMode.PROVISIONED,
      readCapacity: 1,
      writeCapacity: 1,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const exchangeRateLambda = new NodejsFunction(this, 'ExchangeRateHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, 'exchange-rate-lambda', 'index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(10),
      environment: {
        APP_HISTORY_TABLE_NAME: exchangeRateTable.tableName,
      },
      bundling: {
        minify: false,
        externalModules: [
          'aws-sdk',
          'aws-lambda',
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/lib-dynamodb'
        ]
      }
    });

    const rule = new cdk.aws_events.Rule(this, 'ScheduleRule', {
      schedule: cdk.aws_events.Schedule.cron({
        minute: '0,30',
        hour: '5-15',
        weekDay: 'MON-FRI',
      }),
    });

    rule.addTarget(new cdk.aws_events_targets.LambdaFunction(exchangeRateLambda));

    // Grant the Lambda function read/write permissions to the DynamoDB table
    exchangeRateTable.grantReadWriteData(exchangeRateLambda);

    // Grant the Lambda function permissions to be invoked directly
    exchangeRateLambda.addPermission('LambdaInvokePermission', {
      principal: new cdk.aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: exchangeRateLambda.functionArn
    });

    const lambdaUrl = exchangeRateLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['https://farafonoff.github.io', 'http://localhost:3000'],
        allowedMethods: [lambda.HttpMethod.GET],
      },
    });

    const rateHistoryLambda = new NodejsFunction(this, 'RateHistoryHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, 'rate-history-lambda', 'index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(10),
      environment: {
        APP_HISTORY_TABLE_NAME: exchangeRateTable.tableName,
      },
      bundling: {
        minify: false,
        externalModules: [
          'aws-sdk',
          'aws-lambda',
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/lib-dynamodb'
        ]
      }
    });

    // Grant the Lambda function read/write permissions to the DynamoDB table
    exchangeRateTable.grantReadWriteData(rateHistoryLambda);

    // Grant the Lambda function permissions to be invoked directly
    rateHistoryLambda.addPermission('LambdaInvokePermission', {
      principal: new cdk.aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: rateHistoryLambda.functionArn
    });

    const rateHistoryLambdaUrl = rateHistoryLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['https://farafonoff.github.io', 'http://localhost:3000'],
        allowedMethods: [lambda.HttpMethod.GET],
      },
    });

    new cdk.CfnOutput(this, 'RateHistoryFunctionUrl', { value: rateHistoryLambdaUrl.url });

    new cdk.CfnOutput(this, 'FunctionUrl ', { value: lambdaUrl.url });

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'AwsQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
