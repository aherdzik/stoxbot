const Telegraf = require('telegraf')
const PriceCache = require('./pricecache.js')
const assetDef = require('./asset.js')
var stockMap = new Map();
var prices = {};
const fs = require('fs');
var telegramAuth = "";
var dbLocation = "";
var bot = "";
var baseMoney = 100000.0;

function readInArgs()
{
    for (let j= 2; j< process.argv.length; j+=2)
    {
        switch(process.argv[j])
        {
            case "-db":
            dbLocation = process.argv[j+1];
            break;
            case "-at":
            bot = new Telegraf(process.argv[j+1]);
            break;
            default:
            break;
        }
    }
}

readInArgs();

bot.on('text', (ctx) => {
    var msg = ctx.message;
    var username = msg.from.username;
    var id = msg.from.id;
    var msgText = msg.text;
    console.log(username + "(" + id + "): " + msgText);
    
    joinAutomatically(username);
    var splitStr= msgText.split(" ");
    if(splitStr[0] == "/stox")
    {
        if(splitStr.length == 1)
            return;
        var restOfStuff = splitStr.slice(2);
        
        switch(splitStr[1].toLowerCase()){
            case "help":
                printHelp(ctx);
            break;
            case "buy":
                buyStock(ctx, restOfStuff);
            break;
            case "sell":
                sellStock(ctx, restOfStuff);
            break;
            case "score":
            case "scores":
                showScores(ctx);
            break;
            case "join":
            case "joingame":
                joinGame(ctx);
            break;
            default:
                ctx.reply("Command not found.");
            break;
            
        }
        writeData();
    }
})

function printHelp(ctx){
    ctx.reply("HELP NOT YET IMPLEMENTED, YELL AT ALEX");
}

function buyStock(ctx, params)
{
    if(params.length !=2)
    {
        console.log("BUY FAILED: INVALID NUMBER OF PARAMETERS")
        return;
    }
    
    prices.buyStockWithCallback(buyStockCallBack,ctx,params[0],params[1]);
}

function buyStockCallBack(ctx, name, amount, price)
{
    console.log(name + " " + amount + " " +price);
    
}

function sellStock(ctx, params){
    ctx.reply("SELLING STOCKS NOT ALLOWED ALEX PLS ADD CONTENT");
}

function showScores(ctx){
    var toReturn = "CURRENT STANDINGS: \n";
    
    Object.keys(stockMap).forEach(function(k)
    {
        toReturn+= k + ": " + getPortfolioValueByUsername(k) + "\n";    
    });
    ctx.reply(toReturn);
}

function joinAutomatically(username)
{
    if(stockMap[username] == null)
    {
        stockMap[username] = [new assetDef.Asset(assetDef.AssetType.CASH,"CASH",baseMoney, 0)];
        console.log(username + " ADDED AUTOMATICALLY")
        writeData();
    }
}

function getPortfolioValueByUsername(username)
{
    var currentVal= 0.0;
    stockMap[username].forEach(function(asset) 
    {
        if(asset.assetType == assetDef.AssetType.CASH)
        {
            currentVal += asset.amount;
        }
        else if(asset.assetType == assetDef.AssetType.STOCK)
        {
            currentVal += (parseFloat(asset.amount) * parseFloat(prices.getStockPrice(asset.name)));
        }
    });
    return currentVal;
}

function writeData()
{
    fs.writeFileSync(dbLocation, JSON.stringify(stockMap));  
}

function readInAllStocks()
{
    stockMap = JSON.parse(fs.readFileSync("./" + dbLocation));
    
    var stocksToGrab = [];
    Object.keys(stockMap).forEach(function(k)
    {
        stockMap[k].forEach(function(asset) 
        {
            if(asset.assetType == assetDef.AssetType.STOCK)
            {
                if(!stocksToGrab.includes(asset.name))
                {
                    stocksToGrab.push(asset.name);
                }
            }
        }); 
    });
    
    prices = new PriceCache();
    prices.initialize(stocksToGrab, bot);
}

readInAllStocks();