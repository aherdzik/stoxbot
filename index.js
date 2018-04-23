const Telegraf = require('telegraf')
const PriceCache = require('./pricecache.js')
const assetDef = require('./asset.js')
var stockMap = new Map();
var activationString = "/stox";
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
    if(splitStr[0] == activationString)
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
            case "portfolio":
                showPortfolio(ctx, restOfStuff);
            break;
            case "score":
            case "scores":
                showScores(ctx);
            case "price":
            case "quote":
                showQuote(ctx, restOfStuff);
            break;
            default:
                ctx.reply("Command not found.");
            break;
            
        }
        writeData();
    }
});

function showPortfolio(ctx, params)
{
    var username = ctx.message.from.username;
    if(params.length > 0)
    {
        if(stockMap[params[0]] == null)
        {
            ctx.reply(params[0] + " is not a valid username, defaulting to sender.");
        }
        else
        {
            username = params[0];
        }
    }
    
    var totalAssetValue = getPortfolioValueByUsername(username);
    
    var output = "PORTFOLIO FOR " + username + ": \n";
    
    stockMap[username].forEach(function(currentAsset) 
    {
        if(currentAsset.assetType == assetDef.AssetType.CASH)
        {
            output += "CASH:\nMoney: $" + currentAsset.amount + "\nCash Portfolio Percentage: " + (currentAsset.amount/ totalAssetValue) * 100 + "%\n";
        }
        else if(currentAsset.assetType == assetDef.AssetType.STOCK)
        {
            var currentPrice = prices.getStockPrice(currentAsset.name);
            var assetValue = currentAsset.amount * currentPrice;
            output += currentAsset.name + ":\nShares: " + currentAsset.amount + "\nPrice: " + currentPrice + "\nTotal Asset Value: " + assetValue + "\n";
            output += "Percentage Of Portfolio: " + (assetValue/ totalAssetValue) * 100 + "%\n";
            output += "Average percentage change since purchase: " + ((currentPrice/ currentAsset.originalPrice)-1) * 100 + "%\n";
        }
    });
    
    ctx.reply(output);
}

function showQuote(ctx, params)
{
    params.forEach(function(stockName) 
    {
      prices.getStockWithCallback(showQuoteCallBack,ctx,stockName,0);
    });
}

function showQuoteCallBack(ctx, name, amount, price)
{
    if(price == -1)
    {
        ctx.reply(name + " is not a valid stock to get a quote for." );
        return;
    }
    
    ctx.reply("Current market price for " + name + ": " +  price);
    writeData();
}

function printHelp(ctx){
    var output= "Hi, I'm Stoxbot! I'm a simple stock tracker bot that people can use to buy and sell stocks with play money with their friends on Telegram!\n";
    output+="Here are my commands:\n";
    output+=activationString + " buy [stock name][amount] : Buy a stock\n";
    output+=activationString + " sell [stock name][amount]: Sell a stock\n";
    output+=activationString + " portfolio [username(optional, default is message sender)]: See portfolio stats for a given user\n";
    output+=activationString + " scores: See the global portfolio value leaderboards\n";
    output+=activationString + " quote [space-delimited list of stock names]: Get a fairly recent quote for a stock (or stocks)\n";
    output+=activationString + " help: See my commands (but you knew that already!)\n";
    ctx.reply(output);
}

function buyStock(ctx, params)
{
    if(params.length ==2)
    {
        if(isNaN(parseFloat(params[0]))) //user put amount first maybe?
        { 
            if(isNaN(parseFloat(params[1])))
            {
                ctx.reply("Invalid buy parameters. No stock amount specified.");
            }
            else
            {
                prices.getStockWithCallback(buyStockCallBack,ctx,params[0],params[1]);
            }
        }
        else
        {
            prices.getStockWithCallback(buyStockCallBack,ctx,params[1],params[0]);
        }
    }
    else
    {
        ctx.reply("Invalid parameters. Proper buy syntax: "+ activationString + " buy [stock ticker name] [amount]");
    }
}

function buyStockCallBack(ctx, name, amount, price)
{
    if(price == -1)
    {
        ctx.reply("Invalid buy parameters. " + name + " is not a valid stock." );
        return;
    }
    
    var username = ctx.message.from.username;
    
    var cashIndex = -1;
    for(var i = 0; i < stockMap[username].length; i++)
    {
        if(stockMap[username][i].assetType == assetDef.AssetType.CASH)
        {
            cashIndex = i;
            break;
        }
    }
    
    if(price * amount > stockMap[username][cashIndex].amount)
    {
        ctx.reply(username + " doesn't have enough money to buy " + amount + " shares of " + name + ". Required money: " + price * amount + ". Available money: " + stockMap[username][cashIndex].amount + ".");
        return;
    }
    
    stockMap[username][cashIndex].amount -= price * amount;
    var assetIndex = -1;
    for(var i = 0; i< stockMap[username].length; i++)
    {
        if(stockMap[username][i].assetType == assetDef.AssetType.STOCK)
        {
            if(stockMap[username][i].name == name)
            {
                assetIndex = i;
                break;
            }
        }
    }
    
    if(assetIndex == -1)
    {
        stockMap[username].push(new assetDef.Asset(assetDef.AssetType.STOCK, name, amount, price));
    }
    else
    {
        var totalAssetVal = (stockMap[username][assetIndex].amount * stockMap[username][assetIndex].originalPrice) + (amount * price);
        var totalStockAmount = +stockMap[username][assetIndex].amount + +amount;
        
        stockMap[username][assetIndex].amount = totalStockAmount;
        stockMap[username][assetIndex].originalPrice = totalAssetVal/totalStockAmount;
    }
    
    ctx.reply(username + " has successfully purchased " + amount + " shares of " + name + " for " + price + " per share.");
    
    writeData();
}

function sellStock(ctx, params){
    if(params.length == 2)
    {
        if(isNaN(parseFloat(params[0]))) //user put amount first maybe?
        { 
            if(isNaN(parseFloat(params[1])))
            {
                ctx.reply("Invalid sell parameters. No stock amount specified.");
            }
            else
            {
                prices.getStockWithCallback(sellStockCallBack,ctx,params[0],params[1]);
            }
        }
        else
        {
            prices.getStockWithCallback(sellStockCallBack,ctx,params[1],params[0]);
        }
    }
    else
    {
        ctx.reply("Invalid parameters. Proper sell syntax: "+ activationString + " sell [stock ticker name] [amount]");
    }
}

function sellStockCallBack(ctx, name, amount, price)
{
    if(price == -1)
    {
        ctx.reply("Invalid sell parameters. " + name + " is not a valid stock." );
        return;
    }
    
    var username = ctx.message.from.username;
    
    var cashIndex = -1;
    for(var i = 0; i < stockMap[username].length; i++)
    {
        if(stockMap[username][i].assetType == assetDef.AssetType.CASH)
        {
            cashIndex = i;
            break;
        }
    }
    
    var assetIndex = -1;
    for(var i = 0; i< stockMap[username].length; i++)
    {
        if(stockMap[username][i].assetType == assetDef.AssetType.STOCK)
        {
            if(stockMap[username][i].name == name)
            {
                assetIndex = i;
                break;
            }
        }
    }
    
    if(assetIndex == -1)
    {
        ctx.reply(username + " doesn't have any " + name + " shares to sell.");
        return;
    }
    
    if(stockMap[username][assetIndex].amount < amount)
    {
        ctx.reply(username + " doesn't have enough " + name + " shares to sell. Shares in sell command: "+ amount + ". Shares in portfolio: " + stockMap[username][assetIndex].amount + ".");
        return;
    }
    
    // at this point, we know it's a valid command
    stockMap[username][cashIndex].amount += price * amount;
    stockMap[username][assetIndex].amount -= amount;
    if(stockMap[username][assetIndex].amount == 0)
    {
        stockMap[username].splice(assetIndex, 1);
    }
    
    ctx.reply(username + " has successfully sold " + amount + " shares of " + name + " for " + price + " per share.");
    
    writeData();
}

function showScores(ctx){
    var toReturn = "CURRENT STANDINGS: \n";
    
    var usernameToScoreArray = new Array();
    
    Object.keys(stockMap).forEach(function(k)
    {
        var obj = {username:k, score:parseFloat(getPortfolioValueByUsername(k))};
        usernameToScoreArray.push(obj);
    });
    
    usernameToScoreArray.sort(function(a, b){return parseFloat(b.score) - parseFloat(a.score)});
    
    usernameToScoreArray.forEach(function(newObj)
    {
        toReturn+= newObj.username + ": " + newObj.score + "\n";    
    });
    
    ctx.reply(toReturn);
}

function joinAutomatically(username)
{
    if(stockMap[username] == null)
    {
        stockMap[username] = [new assetDef.Asset(assetDef.AssetType.CASH,"CASH",baseMoney, 0)];
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