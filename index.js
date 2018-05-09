const Telegraf = require('telegraf')
const PriceCache = require('./pricecache.js')
const assetDef = require('./asset.js')
var stockMap = new Map();
var prices = {};
const fs = require('fs');
var dbLocation = "";
var FRlocation = "";
var configLoc = "config.json";
var bot = "";
var baseMoney = 100000.0;
var featureRequests = [];
var homeChatID = "";

function readInArgs()
{
    var configObj = JSON.parse(fs.readFileSync("./" + configLoc));
    bot = new Telegraf(configObj.authToken)
    dbLocation = configObj.dbLocation;
    FRlocation = configObj.frLocation;
    homeChatID = configObj.homeChatId;
}

readInArgs();

bot.on('text', (ctx) => {
    var msg = ctx.message;
    var username = msg.from.username.toLowerCase();
    var id = msg.from.id;
    var msgText = msg.text;
    joinAutomatically(username);
    var splitStr= msgText.split(" ");
    var restOfStuff = splitStr.slice(1);
    
    switch(splitStr[0].toLowerCase()){
        case "/addfeaturerequest":
        case "/afr":
            addFeatureRequest(ctx,restOfStuff);
        break;
        case "/featurerequests":
            showFeatureRequests(ctx,restOfStuff);
        break;
        case "/help":
            printHelp(ctx);
        break;
        case "/b":
        case "/buy":
            buyStock(ctx, restOfStuff);
        break;
        case "/s":
        case "/sell":
            sellStock(ctx, restOfStuff);
        break;
        case "/p":
        case "/portfolio":
            showPortfolio(ctx, restOfStuff);
        break;
        case "/score":
        case "/scores":
            showScores(ctx);
        break;
        case "/price":
        case "/q":
        case "/quote":
            showQuote(ctx, restOfStuff);
        break;
        case "/sayspec":
            sayToChat(ctx, restOfStuff);
        break;
        default:
            if(splitStr[0].startsWith("/"))
            {
                ctx.reply("Command not found.");
            }
        break;
        
    }
    writeData();
});

function sayToChat(ctx, params)
{
    var currentMsg = "";
    params.forEach(function(word) 
    {
      currentMsg += word + " ";
    });
    ctx.telegram.sendMessage(homeChatID, currentMsg);
}

function addFeatureRequest(ctx, params)
{
    var toSave = "";
    params.forEach(function(asset) 
    {
        toSave+= asset + " ";
    }); 
    featureRequests.push(toSave);
    ctx.reply("Request saved.");
}

function showFeatureRequests(ctx, params)
{
    var toPrint = "Current Feature Requests:\n";
    featureRequests.forEach(function(asset) 
    {
        toPrint+= asset + "\n";
    }); 
    ctx.reply(toPrint);
}

function showPortfolio(ctx, params)
{
    var username = ctx.message.from.username.toLowerCase();
    if(params.length > 0)
    {
        if(stockMap[params[0].toLowerCase()] == null)
        {
            ctx.reply(params[0] + " is not a valid username, defaulting to sender.");
        }
        else
        {
            username = params[0].toLowerCase();
        }
    }
    
    var totalAssetValue = getPortfolioValueByUsername(username);
    
    var output = "PORTFOLIO FOR " + username + ": \n";
    output+= "TOTAL PORTFOLIO VALUE: $" + totalAssetValue.toFixed(2) + "\n"
    
    stockMap[username].forEach(function(currentAsset) 
    {
        if(currentAsset.assetType == assetDef.AssetType.CASH)
        {
            output += "Uninvested Money: $" + (currentAsset.amount).toFixed(2) + "\nUninvested Money Portfolio Percentage: " + ((currentAsset.amount/ totalAssetValue) * 100).toFixed(2) + "%\n";
        }
        else if(currentAsset.assetType == assetDef.AssetType.STOCK)
        {
            var currentPrice = prices.getStockPrice(currentAsset.name).toFixed(2);
            var assetValue = (currentAsset.amount * currentPrice).toFixed(2);
            output += "~~~~" + currentAsset.name + ":~~~~\nShares: " + currentAsset.amount + "\nPrice: $" + currentPrice + "\nAverage Purchase Price: $" + currentAsset.originalPrice.toFixed(2) +"\n";
            output += "Average percentage change since purchase: " + (((currentPrice/ currentAsset.originalPrice)-1) * 100).toFixed(2) + "%\n";
            output += "Total Asset Value: $" + assetValue + "\n";
            output += "Percentage Of Portfolio: " + ((assetValue/ totalAssetValue) * 100).toFixed(2) + "%\n";
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
    output+="/buy [stock name][amount] : Buy a stock\n";
    output+="/sell [stock name][amount]: Sell a stock\n";
    output+="/portfolio [username(optional, default is message sender)]: See portfolio stats for a given user\n";
    output+="/scores: See the global portfolio value leaderboards\n";
    output+="/quote [space-delimited list of stock names]: Get a fairly recent quote for a stock (or stocks)\n";
    output+="/help: See my commands (but you knew that already!)\n";
    output+="/addfeaturerequest (or /afr): Put in a feature request so that Alex will take a look at it eventually.\n";
    output+="/featurerequests: See current feature requests, so there aren't any duplicates.\n";
    ctx.reply(output);
}

function buyStock(ctx, params)
{
    if(!assetDef.StockMarketOpen())
    {
        ctx.reply("Stock market is currently not open.");
        return;
    }
    
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
        ctx.reply("Invalid parameters. Proper buy syntax: /buy [stock ticker name] [amount]");
    }
}

function buyStockCallBack(ctx, name, amount, price)
{
    if(price == -1)
    {
        ctx.reply("Invalid buy parameters. " + name + " is not a valid stock." );
        return;
    }
    
    var username = ctx.message.from.username.toLowerCase();
    
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
    if(!assetDef.StockMarketOpen())
    {
        ctx.reply("Stock market is currently not open.");
        return;
    }
    
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
        ctx.reply("Invalid parameters. Proper sell syntax: /sell [stock ticker name] [amount]");
    }
}

function sellStockCallBack(ctx, name, amount, price)
{
    if(price == -1)
    {
        ctx.reply("Invalid sell parameters. " + name + " is not a valid stock." );
        return;
    }
    
    var username = ctx.message.from.username.toLowerCase();
    
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
        var obj = {username:k, score:parseFloat(getPortfolioValueByUsername(k.toLowerCase()))};
        if((obj.score != 100000))
        {
            usernameToScoreArray.push(obj);
        }
    });
    
    usernameToScoreArray.sort(function(a, b){return parseFloat(b.score) - parseFloat(a.score)});
    
    usernameToScoreArray.forEach(function(newObj)
    {
        toReturn+= newObj.username + ": $" + newObj.score.toFixed(2) + "\n";    
    });
    
    ctx.reply(toReturn);
}

function joinAutomatically(username)
{
    if(stockMap[username.toLowerCase()] == null)
    {
        stockMap[username.toLowerCase()] = [new assetDef.Asset(assetDef.AssetType.CASH,"CASH",baseMoney, 0)];
        writeData();
    }
}

function getPortfolioValueByUsername(username)
{
    var currentVal= 0.0;
    stockMap[username.toLowerCase()].forEach(function(asset) 
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
    fs.writeFileSync(FRlocation, JSON.stringify(featureRequests));  
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
    
    featureRequests = JSON.parse(fs.readFileSync("./" + FRlocation));
    
    prices = new PriceCache();
    prices.initialize(stocksToGrab, bot);
}

readInAllStocks();