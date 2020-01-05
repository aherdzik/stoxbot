const get = require('simple-get');
const asset = require('./asset.js')
var assetPriceMap = new Map();
var dividendDataMap = new Map();
var updateTimeout = 300* 1000 ; // update every 5 minutes
var assetAPIKey=  "";
var stocksPerQuery = 200;
var urlDivKey = "";
var urlTestDivKey = "";
var inTesting = "";
var futures;
class PriceCache{
    constructor(apiKey, divKey, testDivKey, useTestDivData) 
    {
        urlDivKey = divKey;
        urlTestDivKey = testDivKey;
        assetAPIKey = apiKey;
        inTesting = useTestDivData;
        setInterval(this.updateCache, updateTimeout, "");
        //dividendDataMap.set("YUM", new asset.UpcomingDividend("YUM",parseFloat("0.98"),"2020-01-05", "2020-05-07"));
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

function printErrorData(data)
{
    if(data) 
    {
        console.log("DATA FOUND FOR ERROR: " + data.toString())
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
                  var mainObj = ""
                  try
                  {
                    mainObj = JSON.parse(data.toString());
                  }
                  catch(e)
                  {
                    console.log("Error on parsing return data. " + e.stack)
                    printErrorData(data)
                    futures--;
                    return;
                  }
                  
                  var stockQuotes = mainObj['Stock Quotes'];
                  if(stockQuotes == undefined)
                  {
                      console.log("probable overload, stock quotes not found")
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
        
        var timeout = function(secondMax){
            if(secondMax == 0)
            {
                console.log("TIMED OUT at number of futures: " + futures);
                if(functionCallback)
                {
                    functionCallback();
                }
            }
            setTimeout(function (secondMax) {
                
                if(futures == 0)
                {
                    if(functionCallback)
                    {
                        functionCallback();
                    }
                }
                else
                {
                    timeout(secondMax-1);
                }
            }, 100);
        }
        timeout(600);
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

PriceCache.prototype.refreshAllDividendsWithCallback = function(functionCallback, stocksToGrab)
{
    try
    {
        if(stocksToGrab.length == 0)
        {
            if(functionCallback)
            {
                functionCallback();
            }
            return;
        }   
        
        var actualStocksToGrab = new Array();
        for(var i = 0; i< stocksToGrab.length; i++) // don't grab duplicates
        {
            if(!dividendDataMap.has(stocksToGrab[i].toUpperCase()))
            {
                actualStocksToGrab.push(stocksToGrab[i]);
            }
        }
        
        futures = actualStocksToGrab.length;
        
        for (var i = 0; i < actualStocksToGrab.length; i++)
        {
            get.concat(getDividendRetrievalUrl(actualStocksToGrab[i]), function (err, res, data) {
              if (err)
              {
                  console.log("err on getDividendRetrievalUrl: " + err+ "res: " + res)
              }
              else
              {
                  var mainObj = ""
                  try
                  {
                    mainObj = JSON.parse(data.toString());
                  }
                  catch(e)
                  {
                    console.log("Error on parsing return dividend data. " + e.stack)
                    printErrorData(data)
                    futures--;
                    return;
                  }

                  if(mainObj.symbol)
                  {
                      var symbol = mainObj.symbol.toUpperCase();
                      dividendDataMap.set(symbol, new asset.UpcomingDividend(symbol,parseFloat(mainObj.amount),mainObj.exDate, mainObj.paymentDate));
                  }
              }
              
              futures--;
            });
        }
        
        var timeout = function(secondMax){
            if(secondMax == 0)
            {
                console.log("TIMED OUT at number of futures: " + futures);
                if(functionCallback)
                {
                    functionCallback();
                }
            }
            setTimeout(function (secondMax) {
                
                if(futures == 0)
                {
                    if(functionCallback)
                    {
                        functionCallback();
                    }
                }
                else
                {
                    timeout(secondMax-1);
                }
            }, 100);
        }
        timeout(600);
    }
    catch(e)
    {
        console.log("ERROR IN refreshAllDividendsWithCallback catch: " + e.stack);
        if(functionCallback)
        {
            functionCallback();
        }
    }
}

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
        console.log("Error on getStockPrice: " + stockName)
        return 0;
    }
};

PriceCache.prototype.getAndClearCachedDividendObjects = function() 
{
    var deleteMap = new Map();
    var d = new Date();
    d.setHours(d.getHours() - 8); // i'm running this in california so subtract from UTC
    var currentDate = d.toISOString().substring(0, 10);
    for (let [key, value] of dividendDataMap) 
    {
        if(value.exDivDate == currentDate)
        {
            deleteMap.set(value.name, value);
        }
    }

    for (let [key, value] of deleteMap) 
    {
        dividendDataMap.delete(key);
        console.log(key + " DELETED FROM DIVIDEND DATA MAP");
    }
    
    return deleteMap;
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
                 var mainObj = ""
                 try
                 {
                     mainObj = JSON.parse(data.toString());
                 }
                 catch(e)
                 {
                    console.log("Error on parsing return data in getStockWithCallback. " + e.stack)
                    printErrorData(data)
                    functionCallback(ctx,name,amount,-2);
                    return;
                 }
                 var stockQuotes = mainObj['Stock Quotes'];
                 if(stockQuotes == undefined)
                 {
                      console.log("stock quotes undefined for some reason (maybe overload")
                      printErrorData(data)
                      functionCallback(ctx,name,amount,-2);
                      return;
                 }

                 if(stockQuotes.length == 0)
                 {
                    functionCallback(ctx,name,amount,-1);
                    return;
                 }

                  for(var k = 0 ; k <stockQuotes.length; k++)
                  {
                      var currentStock = stockQuotes[k];
                      if(currentStock == undefined)
                      {
                        console.log("stock data weird for some reason (maybe overload")
                        printErrorData(data)
                        functionCallback(ctx,name,amount,-2);
                        return;
                      }
                      var stockName= currentStock['1. symbol'];
                      var stockPrice = parseFloat(currentStock['2. price'])

                      if(stockName == undefined || stockPrice == NaN)
                      {
                        console.log("stock data elements weird for some reason (maybe overload")
                        printErrorData(data)
                        functionCallback(ctx,name,amount,-2);
                        return;
                      }

                      assetPriceMap.set(name,new asset.Asset(asset.AssetType.STOCK, name ,stockPrice, stockPrice));
                      if(functionCallback)
                      {
                        functionCallback(ctx,name,amount,assetPriceMap.get(name).amount);
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

function getDividendRetrievalUrl(stockName)
{
    if(inTesting)
    {
        return ('https://sandbox.iexapis.com/v1/stock/' + stockName + '/dividends/next?token=' + urlTestDivKey);
    }
    else
    {
        return ('https://cloud.iexapis.com/v1/stock/' + stockName + '/dividends/next?token=' + urlDivKey);
    }
}


module.exports = PriceCache;