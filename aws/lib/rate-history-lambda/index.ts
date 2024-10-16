import { DynamoDBClient, ReturnConsumedCapacity } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export const handler: APIGatewayProxyHandler = async (event) => {
    const tableName = process.env.APP_HISTORY_TABLE_NAME!;
    const pair = event.queryStringParameters?.pair || 'USD_TRY';
    const currentDate = new Date();
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(currentDate.getMonth() - 2);

    const params = {
        TableName: tableName,
        KeyConditionExpression: "#pair = :pair and #date between :start_date and :end_date",
        ExpressionAttributeNames: {
            "#pair": "pair",
            "#date": "date"
        },
        ExpressionAttributeValues: {
            ":pair": pair,
            ":start_date": twoMonthsAgo.toISOString(),
            ":end_date": currentDate.toISOString()
        },
        ReturnConsumedCapacity: ReturnConsumedCapacity.TOTAL
    };

    try {
        const data = await ddbDocClient.send(new QueryCommand(params));
        console.log(`Successfully retrieved data: ${JSON.stringify(data.Items)}`);
        const consumedRCU = data.ConsumedCapacity?.CapacityUnits;
        return {
            statusCode: 200,
            headers: {
                'x-consumed-capacity': consumedRCU ? consumedRCU.toString() : '0'
            },
            body: JSON.stringify(data.Items)
        };
    } catch (error) {
        console.error(`Failed to retrieve data:`, error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to retrieve data' })
        };
    }
};