const Telegraf = require('telegraf')
var stockMap = new Map();
var assetPriceMap = {};
const fs = require('fs');
const get = require('simple-get');
var telegramAuth = "";
var dbLocation = "";
var bot = "";

var AssetType = Object.freeze({
    "CASH" : 1,
    "STOCK" : 2,
    "OPTION" : 3,
    "CRYPTO" : 4
});

class Asset 
{
  constructor(assetType, name, amount) {
    this.assetType = assetType;
    this.name = name;
    this.amount = amount;
  }
}

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
            bot = Telegraf.bot(process.argv[j+1]);
            break;
            default:
            break;
        }
    }
    
    try{
    stockMap = require("./" + dbLocation); 
    }catch(err){
        console.log(err.message + ". Assuming db isn't found/didn't work, creating a new one.");
        writeData();
    }
}

readInArgs();

bot.on('text', (ctx) => {
    var msg = ctx.message;
    var username = msg.from.username;
    var id = msg.from.id;
    var msgText = msg.text;
    console.log(username + "(" + id + "): " + msgText);
    var splitStr= msgText.split(" ");
    if(splitStr[0] == "/stox")
    {
        writeData();
        
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
    }
    
})

function printHelp(ctx){
    ctx.reply("HELP NOT YET IMPLEMENTED, YELL AT ALEX");
}

function buyStock(ctx, params){
    ctx.reply("BUYING STOCKS NOT ALLOWED ALEX PLS ADD CONTENT");
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

function joinGame(ctx){
    var username = ctx.message.from.username;
    if(stockMap[username] != null){
        ctx.reply(username + " already has an account with us.");
    }
    else
    {
        stockMap[username] = [new Asset(AssetType.CASH,"CASH",100000.00)];
        ctx.reply(username + " now has an account with Stox worth " + getPortfolioValueByUsername(username) + ".");
        writeData();
    }
}

function getPortfolioValueByUsername(username)
{
    var currentVal= 0.0;
    stockMap[username].forEach(function(asset) 
    {
        if(asset.assetType == AssetType.CASH)
        {
            currentVal += asset.amount;
        }
        else if(asset.assetType == AssetType.STOCK)
        {
            currentVal += (parseFloat(asset.amount) * parseFloat(assetPriceMap[asset.name].amount));
        }
    });
    return currentVal;
}

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
    
    try
    {
        stockMap = require("./" + dbLocation); 
    }catch(err)
    {
        console.log(err.message + ". Assuming db isn't found/didn't work, creating a new one.");
        writeData();
    }
}

function writeData()
{
    fs.writeFileSync(dbLocation, JSON.stringify(stockMap));  
}

function readInAllStocks()
{
    if(dbLocation == "")
    {
        console.log("ERROR: DBLOCATION NOT INITIALIZED");
        return;
    }
    
    var stocksToGrab = [];
    Object.keys(stockMap).forEach(function(k)
    {
        stockMap[k].forEach(function(asset) 
        {
            if(asset.assetType == AssetType.STOCK)
            {
                if(!stocksToGrab.includes(asset.name))
                {
                    stocksToGrab.push(asset.name);
                }
            }
        }); 
    });
    
    stocksToGrab.forEach(function(k)
    {
        console.log("GRABBING PRICES FOR: " + k);
        get.concat('https://api.iextrading.com/1.0/stock/' + k + '/price', function (err, res, data) {
          if (err) throw err
          var val = parseFloat(data.toString());
          assetPriceMap[k] = new Asset(AssetType.STOCK,k,val);
        })
    });
}

readInAllStocks();

if(bot != "")
{
    bot.startPolling()
}