const get = require('simple-get');
const asset = require('./asset.js')
var assetPriceMap = new Map();
var updateTimeout = 300* 1000 ; //update every 5 minutes
var assetAPIKey=  ""
var stocksPerQuery = 15;
var futures;
class PriceCache{
    constructor(apiKey) 
    {
        assetAPIKey = apiKey;
        setInterval(this.updateCache, updateTimeout, "");
    }
};

function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
}

PriceCache.prototype.refreshAllWithCallback = function(functionCallback, stocksToGrab)
{
    try
    {
        var stocksLeft = Math.ceil(stocksToGrab.length/stocksPerQuery);
        if(stocksLeft == 0)
        {
            if(functionCallback)
            {
                functionCallback();
            }
            return;
        }   
        
        futures = stocksLeft;
        
        for (var i = 1; i <= stocksLeft; i++)
        {
            var startNum = (i-1) * stocksPerQuery;
            var endNum = (i == stocksLeft) ? stocksToGrab.length : (i) * stocksPerQuery;
            var curQueryStr = "";
            for (var j = startNum; j< endNum; j++)
            {
                var curStockStr = stocksToGrab[j];
                curQueryStr+= curStockStr;
                if(j != endNum-1 )
                {
                    curQueryStr += ",";
                }
            }
            
            get.concat(getStockRetrievalUrl(curQueryStr), function (err, res, data) {
              if (err)
              {
                  console.log("err on getStockRetrievalUrl: " + err+ "res: " + res)
              }
              else
              {
                  var mainObj = JSON.parse(data.toString());
                  var stockQuotes = mainObj['Stock Quotes'];
                  if(stockQuotes == undefined)
                  {
                      console.log("probable overload")
                      futures--;
                      return;
                  }
                  
                  for(var k = 0 ; k <stockQuotes.length; k++)
                  {
                      var stockName= stockQuotes[k]['1. symbol'];
                      var stockPrice = parseFloat(stockQuotes[k]['2. price'])
                      assetPriceMap.set(stockName.toUpperCase(), new asset.Asset(asset.AssetType.STOCK, stockName.toUpperCase() ,stockPrice, stockPrice));
                  }
              }
              
              futures--;
            });
        }
        
        var timeout = function(){
            setTimeout(function () {
                console.log("futures: " + futures);
                if(futures == 0)
                {
                    if(functionCallback)
                    {
                        functionCallback();
                    }
                }
                else
                {
                    timeout();
                }
            }, 100);
        }
        timeout();
    }
    catch(e)
    {
        console.log("ERROR IN refreshAllWithCallback catch: " + e.stack);
        if(functionCallback)
        {
            functionCallback();
        }
    }
    
};

PriceCache.prototype.updateCache = function()
{
    if(asset.StockMarketOpen())
    {
        PriceCache.prototype.refreshAllWithCallback(null,Array.from(assetPriceMap.keys()));
    }
};

PriceCache.prototype.getStockPrice = function(stockName) 
{
    if(assetPriceMap.has(stockName))
    {
        return assetPriceMap.get(stockName).amount;
    }
    else
    {
        console.log("oops on getStockPrice: " + stockName)
        return 0;
    }
};

PriceCache.prototype.getStockWithCallback = function(functionCallback,ctx,name,amount)
{
    try{
        name = String(name).toUpperCase();
        
        while(name.charAt(0) === '$')
        {
            name = name.substr(1);
        }
        
        if(assetPriceMap.get(name) == null)
        {
            get.concat(getStockRetrievalUrl(name), function (err, res, data) {
              if (err)
              {
                  ctx.reply("ERROR OCCURRED:" + err) 
                  return;
              }
              else
              {
                  var mainObj = JSON.parse(data.toString());
                  var stockQuotes = mainObj['Stock Quotes'];
                  for(var k = 0 ; k <stockQuotes.length; k++)
                  {
                      var stockName= stockQuotes[k]['1. symbol'];
                      var stockPrice = parseFloat(stockQuotes[k]['2. price'])
                      assetPriceMap.set(name,new asset.Asset(asset.AssetType.STOCK, name ,stockPrice, stockPrice));
                      if(functionCallback)
                      {
                        functionCallback(ctx,name,amount,assetPriceMap.get(name).stockPrice);
                      }
                  }
              }
            });
        }
        else
        {
            if(functionCallback)
            {
                functionCallback(ctx,name,amount,assetPriceMap.get(name).amount);
            }
        }
    }
    catch(e)
    {
        console.log("ERROR IN getStockWithCallback catch: " + e.stack);
        ctx.reply("ERROR IN getStockWithCallback catch: " + e.stack) 
    }
};

function getStockRetrievalUrl(stockName)
{
    return ('https://www.alphavantage.co/query?function=BATCH_STOCK_QUOTES&symbols=' + stockName + '&apikey=' + assetAPIKey);
}
module.exports = PriceCache;