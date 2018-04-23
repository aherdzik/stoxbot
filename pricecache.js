const get = require('simple-get');
const asset = require('./asset.js')
var assetPriceMap = new Map();
var updateTimeout = 300 * 1000; //update every 5 minutes
class PriceCache{
    constructor() 
    {
        setInterval(this.updateCache, updateTimeout, "");
    }
};

PriceCache.prototype.updateCache = function()
{
    Object.keys(assetPriceMap).forEach(function(k)
    {
       get.concat(getStockRetrievalUrl(k), function (err, res, data) {
          if (err) throw err
          var val = parseFloat(data.toString());
          assetPriceMap[k] = new asset.Asset(asset.AssetType.STOCK, k ,val, val);
          console.log("NEW PRICE FOR "+ k + ": " + val);
        });
    });
};

PriceCache.prototype.initialize = function(stocksToGrab, bot) 
{
    var stocksLeft = stocksToGrab.length;
    if(stocksLeft == 0)
    {
        bot.startPolling();
        return;
    }
    stocksToGrab.forEach(function(k)
    {
        get.concat(getStockRetrievalUrl(k), function (err, res, data) {
          if (err) throw err
          var val = parseFloat(data.toString());
          assetPriceMap[k] = new asset.Asset(asset.AssetType.STOCK, k ,val, val);
          stocksLeft--;
          if(stocksLeft == 0)
          {
             bot.startPolling();
          }
        });
    });
};

PriceCache.prototype.getStockPrice = function(stockName) 
{
    return assetPriceMap[stockName].amount;
};

PriceCache.prototype.buyStockWithCallback = function(functionCallback,ctx,name,amount)
{
    if(assetPriceMap[name] == null)
    {
          get.concat(getStockRetrievalUrl(name), function (err, res, data) {
              if (err) throw err
              var val = parseFloat(data.toString());
              assetPriceMap[name] = new asset.Asset(asset.AssetType.STOCK, name ,val, val);
              console.log("BUY PRICE FOR "+ name + ": " + val);
              functionCallback(ctx,name,amount,assetPriceMap[name].amount);
          });
    }
    else
    {
        functionCallback(ctx,name,amount,assetPriceMap[name].amount);
    }
};

function getStockRetrievalUrl(stockName)
{
    return ('https://api.iextrading.com/1.0/stock/' + stockName + '/price')
}

module.exports = PriceCache;