/**
 * Script to fetch exchange rates from different banks.
 * 
 * This script fetches exchange rates from Ziraat Bank and Isbank, processes the data,
 * and prints the results in a JSON format.
 * 
 * ## Example
 * 
 * To execute this script locally using `ts-node`:
 * 
 * ```sh
 * ts-node /Users/artem_farafonov/Projects/exchange-rates/aws/lib/exchange-rate-lambda/index.ts
 * ```
 * 
 * Ensure you have `ts-node` installed.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as cheerio from 'cheerio';

const banks = [
    {
        name: 'ziraat',
        fetch: () => fetch("https://www.ziraatbank.com.tr/en/_layouts/15/Ziraat/HesaplamaAraclari/Ajax.aspx/DovizCevirici", {
            "headers": {
                "accept": "text/plain, */*; q=0.01",
                "accept-language": "en-US,en;q=0.9,ru-RU;q=0.8,ru;q=0.7",
                "cache-control": "no-cache",
                "content-type": "core/json",
                "pragma": "no-cache",
                "sec-ch-ua": "\"Google Chrome\";v=\"129\", \"Not=A?Brand\";v=\"8\", \"Chromium\";v=\"129\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"macOS\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "x-requestdigest": "0x657E5DC32763E7674130DCFB45A67B070B84491447FD7822A620D9BBEEB362D0F48CF9433461A962B916178AB22370E58321E224665633A54021BC3F950645F4,11 Oct 2024 11:50:05 -0000",
                "x-requested-with": "JQuery PageEvents"
            },
            "referrer": "https://www.ziraatbank.com.tr/en/calculation-tools/foreign-exchange-converter",
            "referrerPolicy": "unsafe-url",
            "body": "{\"alisDovizKodu\":\"USD\",\"satisDovizKodu\":\"TRY\",\"alisTutari\":1}",
            "method": "POST",
            "mode": "cors",
            "credentials": "include"
        }).then(r => r.json()).then(j => {
            console.log(j);
            return j;
        }).then(r => r.d.Data)
    }
    ,
    {
        name: 'isbank',
        fetch: () => fetch("https://www.isbank.com.tr/en/foreign-exchange-rates")
            .then(r => r.text())
            .then(html => {
                const $ = cheerio.load(html);
                const rows = $('tbody').find('tr');
                const usd = Array.from(rows).map(row => $(row).text()).filter(row => row.includes('USD'));
                const regex = /\d+(?:\.\d+)?/g;
                const matches = usd[0].replace(/,/g, '.').match(regex);
                const buyRate = Number(matches ? matches[0] : null);
                const sellRate = Number(matches ? matches[1] : null);
                console.log({ buyRate, sellRate });
                return buyRate;
            })
    }
];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    const rates = banks.map(bank => {
        return bank.fetch().then(data => {
            return ({ name: bank.name, rate: data })
        });
    });

    const results = await Promise.all(rates);
    // Your logic here

    return {
        statusCode: 200,
        body: JSON.stringify({
            results,
        }),
    };
};

//handler({} as any).then(console.log);
