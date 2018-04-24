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
          assetPriceMap[k.toUpperCase()] = new asset.Asset(asset.AssetType.STOCK, k.toUpperCase() ,val, val);
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

PriceCache.prototype.getStockWithCallback = function(functionCallback,ctx,name,amount)
{
    name = String(name).toUpperCase();
    
    while(name.charAt(0) === '$')
    {
        name = name.substr(1);
    }
    
    if(assetPriceMap[name] == null)
    {
          get.concat(getStockRetrievalUrl(name), function (err, res, data) {
              if (err) throw err
              var val = parseFloat(data.toString());
              //something went wrong
              if(isNaN(val))
              {
                  functionCallback(ctx,name,amount,-1);
                  return;
              }
              assetPriceMap[name] = new asset.Asset(asset.AssetType.STOCK, name ,val, val);
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