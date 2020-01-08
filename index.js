const Telegraf = require('telegraf')
const PriceCache = require('./pricecache.js')
const assetDef = require('./asset.js')
var stockMap = new Map();
var prices = {};
const fs = require('fs');
var dbLocation = "";
var FRlocation = "";
var apiKey= "";
var configLoc = "config.json";
var adminID = ""
var bot = "";
var baseMoney = 100000.0;
var featureRequests = [];
var homeChatID = "";
var maxStockAmount = 99999;
var dayCheckTimer = 300 * 1000 ; //update every 30 seconds
var marketCurrentlyOpen = true;
var previousPortfolioLevels = {};
var spareCtx;
var configObj;

function readInArgs()
{
    configObj = JSON.parse(fs.readFileSync("./" + configLoc));
    bot = new Telegraf(configObj.authToken)
    dbLocation = configObj.inTesting? configObj.dbTestLocation : configObj.dbLocation;
    FRlocation = configObj.frLocation;
    homeChatID = configObj.inTesting? configObj.testHomeChatID : configObj.homeChatID;
    apiKey = configObj.apiKey;
    adminID = configObj.adminID;
}

readInArgs();

bot.on('text', (ctx) => {
    spareCtx = ctx;
    var msg = ctx.message;
    if(!msg.from.username)
    {
        console.log("NO USERNAME");
        return;
    }
    
    if(msg.chat.type != "private" && homeChatID != msg.chat.id) // only process commands from the chat we are currently listening to
    {
        return;
    }
    
    var username = msg.from.username.toLowerCase();
    var msgText = msg.text;
    joinAutomatically(username);
    var splitStr= msgText.split(" ");
    var restOfStuff = splitStr.slice(1);
    switch(splitStr[0].toLowerCase()){
        case "/addfeaturerequest":
        case "/afr":
            addFeatureRequest(ctx,restOfStuff);
        break;
        case "/eod":
            fakeEndOfDay(ctx);
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
        case "/givecash":
            giveCash(ctx, restOfStuff);
        break;
        case "/price":
        case "/q":
        case "/quote":
            showQuote(ctx, restOfStuff);
        break;
        case "/sayspec":
            sayToChat(ctx, restOfStuff);
        break;
        case "/sod":
            fakeStartOfDay(ctx);
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

function sentFromAdmin(ctx){
    return ctx.from.id == adminID;
}

function giveCash(ctx, params)
{
    if(!sentFromAdmin(ctx)){
        console.log("NOT ADMIN");
        return;
    }
    
    var username = params[0];
    var cashAmount = parseFloat(params[1]);
    
    var cashIndex = getCashIndexByUsername(username);
    
    stockMap[username][cashIndex].amount = +parseFloat(stockMap[username][cashIndex].amount.toFixed(2)) + +parseFloat(cashAmount);
    console.log(cashAmount + " given to " + username + " successfully.")
}

function sayToChat(ctx, params)
{
    if(!sentFromAdmin(ctx))
    {
        console.log("NOT ADMIN");
        return;
    }
    
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
    try
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
    
    for(var i = 0; i < stockMap[username].length; i++)
    {
        var currentAsset = stockMap[username][i];
        if(currentAsset.assetType == assetDef.AssetType.CASH)
        {
            output += "Uninvested Money: $" + (currentAsset.amount).toFixed(2) + "\nUninvested Money Portfolio Percentage: " + ((currentAsset.amount/ totalAssetValue) * 100).toFixed(2) + "%\n";
        }
        else if(currentAsset.assetType == assetDef.AssetType.STOCK)
        {
            if(parseInt(currentAsset.amount) == 0)
            {
                stockMap[username].splice(i--,1);
            }
            else
            {
                var currentPrice = prices.getStockPrice(currentAsset.name).toFixed(2);
                if(currentAsset.amount == null || currentAsset.originalPrice == null)
                {
                    console.log("bad data")
                    return;
                }
                var assetValue = (currentAsset.amount * currentPrice).toFixed(2);
                output += "~~~~" + currentAsset.name + ":~~~~\nShares: " + currentAsset.amount + "\nPrice: $" + currentPrice + "\nAverage Purchase Price: $" + currentAsset.originalPrice.toFixed(2) +"\n";
                output += "Average percentage change since purchase: " + (((currentPrice/ currentAsset.originalPrice)-1) * 100).toFixed(2) + "%\n";
                output += "Total Asset Value: $" + assetValue + "\n";
                output += "Percentage Of Portfolio: " + ((assetValue/ totalAssetValue) * 100).toFixed(2) + "%\n";
            }
        }
    }
    
    ctx.reply(output);
    }
    catch(e)
    {
        ctx.reply("ERROR IN showPortfolio: " + e.stack)
    }
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

    if(price == -2)
    {
        ctx.reply(name + " data cannot be fetched for some reason." );
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
    if(!assetDef.StockMarketOpen() && !sentFromAdmin(ctx))
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
    
    if(parseInt(amount) > parseInt(maxStockAmount) || parseInt(amount) < 1 )
    {
        ctx.reply("stock amount must be between 1 and " + maxStockAmount)
        return;
    }
    
    var username = ctx.message.from.username.toLowerCase();
    
    var cashIndex = getCashIndexByUsername(username);
    
    if(parseFloat(price * amount) > parseFloat(stockMap[username][cashIndex].amount))
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
        var totalAssetVal = +(stockMap[username][assetIndex].amount * stockMap[username][assetIndex].originalPrice) + +(amount * price);
        var totalStockAmount = +stockMap[username][assetIndex].amount + +amount;
        
        stockMap[username][assetIndex].amount = totalStockAmount;
        stockMap[username][assetIndex].originalPrice = parseFloat(totalAssetVal/totalStockAmount);
    }
    
    ctx.reply(username + " has successfully purchased " + amount + " shares of " + name + " for " + price + " per share." + remainingCashString(username));
    writeData();
}

function sellStock(ctx, params)
{
    if(!assetDef.StockMarketOpen() && !sentFromAdmin(ctx))
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
    
    if(parseInt(amount) > parseInt(maxStockAmount) || parseInt(amount) < 1)
    {
        ctx.reply("stock amount must be between 1 and " + maxStockAmount)
        return;
    }
    
    var username = ctx.message.from.username.toLowerCase();
    
    var cashIndex = getCashIndexByUsername(username);
    
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
    
    if(parseInt(stockMap[username][assetIndex].amount) < parseInt(amount))
    {
        ctx.reply(username + " doesn't have enough " + name + " shares to sell. Shares in sell command: "+ amount + ". Shares in portfolio: " + stockMap[username][assetIndex].amount + ".");
        return;
    }
    
    // at this point, we know it's a valid command
    stockMap[username][cashIndex].amount += price * amount;
    stockMap[username][assetIndex].amount -= amount;
    if(parseInt(stockMap[username][assetIndex].amount) == parseInt(0))
    {
        stockMap[username].splice(assetIndex, 1);
    }
    
    ctx.reply(username + " has successfully sold " + amount + " shares of " + name + " for " + price + " per share." + remainingCashString(username));
    
    writeData();
}

function showScores(ctx){
    try
    {
    var toReturn = "CURRENT STANDINGS: \n";
    
    var usernameToScoreArray = new Array();
    
    Object.keys(stockMap).forEach(function(k)
    {
        var obj = {username:k, score:parseFloat(getPortfolioValueByUsername(k.toLowerCase()))};
        if((parseFloat(obj.score) != parseFloat(100000)))
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
    catch(e)
    {
        ctx.reply("ERROR IN showScores: " + e.stack)
    }
}

function joinAutomatically(username)
{
    if(stockMap[username.toLowerCase()] == null)
    {
        stockMap[username.toLowerCase()] = [new assetDef.Asset(assetDef.AssetType.CASH,"CASH",baseMoney, 0)];
        writeData();
    }
}

function remainingCashString(username)
{
    return " " + username + " has $" + getUserCashAmount(username) + " of fungible cash remaining.";
}

function getUserCashAmount(username)
{
    var valToSend = 0;
    stockMap[username.toLowerCase()].forEach(function(asset) 
    {
        if(asset.assetType == assetDef.AssetType.CASH)
        {
            valToSend = asset.amount;
        }
    });
    return valToSend.toFixed(2);
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

function getCashIndexByUsername(username)
{
    var cashIndex = -1;
    for(var i = 0; i < stockMap[username].length; i++)
    {
        if(stockMap[username][i].assetType == assetDef.AssetType.CASH)
        {
            cashIndex = i;
            break;
        }
    }
    return cashIndex;
}

function checkForDayEndOrStart()
{
    var stocksToGrab = getListOfAllStocks();
    console.log("Market currently open: " + assetDef.StockMarketOpen());
    try
    {
        prices.refreshAllWithCallback((marketCurrentlyOpen != assetDef.StockMarketOpen()) ? dayToggleCallback: null ,stocksToGrab);
    }
    catch(e)
    {
        console.log("ERROR in refreshallwithcallback: " + e.stack);
    }
}

function dayToggleCallback()
{
    try
    {
        var toReturn = "";
        if(!marketCurrentlyOpen)
        {
            var divMap = prices.getAndClearCachedDividendObjects();
            var d = new Date();
            d.setHours(d.getHours() - 8); // i'm running this in california so subtract from UTC
            var currentDate = d.toISOString().substring(0, 10);
            Object.keys(stockMap).forEach(function(username)
            {
                var divAddObjects = new Array();
                var divRemoveIndices = new Array();
                for(var i = 0; i< stockMap[username].length; i++)
                {
                    if(stockMap[username][i].assetType == assetDef.AssetType.STOCK)
                    {
                        var assetName = stockMap[username][i].name.toUpperCase();
                        if(divMap.has(assetName))
                        {
                            var divData = divMap.get(assetName);
                            divAddObjects.push(new assetDef.UpcomingDividend(assetName,divData.amount * stockMap[username][i].amount,divData.exDivDate, divData.divReceiveDate));
                        }
                    }
                    else if(stockMap[username][i].assetType == assetDef.AssetType.UPCOMING_DIVIDEND && stockMap[username][i].divReceiveDate == currentDate)
                    {
                        divRemoveIndices.push(i);
                    }
                }
                
                for(var i = divRemoveIndices.length -1; i >=0; i--)
                {
                    var divCashIn = stockMap[username][divRemoveIndices[i]];
                    var cashIndex = getCashIndexByUsername(username);
                    stockMap[username][cashIndex].amount += divCashIn.amount;
                    spareCtx.telegram.sendMessage(homeChatID, username + " got $" + divCashIn.amount + " from dividends of " + divCashIn.name + " stock!");
                    stockMap[username].splice(divRemoveIndices[i], 1);
                }
                
                for(var i = 0; i < divAddObjects.length; i++)
                {
                    stockMap[username].push(divAddObjects[i]);
                    spareCtx.telegram.sendMessage(homeChatID, username + " held " + divAddObjects[i].name + " stock during an ex-dividend date! The stonk gods smile upon them and they will receive dividend money soon!");
                }
            });
            
             prices.refreshAllDividendsWithCallback(null,getListOfAllStocks());
        }
        
        if(marketCurrentlyOpen)
        {
            toReturn += "START OF DAY REPORT: \n"
        }
        else
        {
            toReturn += "END OF DAY REPORT: \n"
        }
        
        toReturn += "PERCENT CHANGES SINCE LAST REPORT: \n"
        
        
        var usernameToPercentChangeArray = new Array();
        var newPreviousScores = {};
        
        Object.keys(stockMap).forEach(function(k)
        {
            var currentScore = parseFloat(getPortfolioValueByUsername(k.toLowerCase()));
            newPreviousScores[k] = currentScore;
            var obj = {username:k, score:parseFloat((((currentScore/ previousPortfolioLevels[k])-1) * 100).toFixed(2))};
            if((parseFloat(currentScore) != parseFloat(100000)))
            {
                usernameToPercentChangeArray.push(obj);
            }
        });
        
        usernameToPercentChangeArray.sort(function(a, b){return parseFloat(b.score) - parseFloat(a.score)});
        
        usernameToPercentChangeArray.forEach(function(newObj)
        {
            toReturn+= newObj.username + ": " + newObj.score.toFixed(2) + "%\n";    
        });
        
        previousPortfolioLevels = newPreviousScores;
        spareCtx.telegram.sendMessage(homeChatID, toReturn);
        
        if(!marketCurrentlyOpen)
        {
            showScores(spareCtx);
        }
        
        marketCurrentlyOpen = assetDef.StockMarketOpen();
    }
    catch(e)
    {
        console.log("ERROR in dayToggleCallback: " + e.stack);
        spareCtx.telegram.sendMessage("ERROR in dayToggleCallback: " + e.stack);
    }
}

function loadBackupData()
{
    Object.keys(stockMap).forEach(function(k)
    {
        previousPortfolioLevels[k] = getPortfolioValueByUsername(k);
    });
}

function startupBot()
{
    bot.startPolling();
    loadBackupData();
    marketCurrentlyOpen = assetDef.StockMarketOpen();
    setInterval(checkForDayEndOrStart, dayCheckTimer, "");
    console.log("STARTUP SUCCESSFUL");
}

function getListOfAllStocks()
{
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
    return stocksToGrab;
}

function readInAllStocks()
{
    stockMap = JSON.parse(fs.readFileSync("./" + dbLocation));
    
    var stocksToGrab = getListOfAllStocks();
    
    featureRequests = JSON.parse(fs.readFileSync("./" + FRlocation));
    
    prices = new PriceCache(apiKey, configObj.divKey, configObj.testDivKey, configObj.inTesting);
    try
    {
        prices.refreshAllWithCallback(readInAllDividends,stocksToGrab);
    }
    catch(e)
    {
        console.log("ERROR in readinallstocks: " + e.stack);
    }
}

function readInAllDividends()
{
    console.log("Stock data retrieval complete. Retrieving dividend data...");
    var stocksToGrab = getListOfAllStocks();
    try
    {
        prices.refreshAllDividendsWithCallback(startupBot,stocksToGrab);
    }
    catch(e)
    {
        console.log("ERROR in processDividends: " + e.stack);
    }
}

function fakeEndOfDay(ctx)
{
    if(!sentFromAdmin(ctx)){
        console.log("NOT WORKING");
        return;
    }
    marketCurrentlyOpen = false; // i'm only ever working on this when the stock market isn't open 
    dayToggleCallback();
}

function fakeStartOfDay(ctx)
{
    if(!sentFromAdmin(ctx)){
        console.log("NOT WORKING");
        return;
    }
    marketCurrentlyOpen = true; // i'm only ever working on this when the stock market isn't open 
    dayToggleCallback();
}

readInAllStocks();