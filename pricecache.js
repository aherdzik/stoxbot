const get = require('simple-get');
const asset = require('./asset.js')
var assetPriceMap = new Map();
var updateTimeout = 300* 1000 ; //update every 5 minutes
class PriceCache{
    constructor() 
    {
        setInterval(this.updateCache, updateTimeout, "");
    }
};

PriceCache.prototype.updateCache = function()
{
    if(asset.StockMarketOpen())
    {
        Object.keys(assetPriceMap).forEach(function(k)
        {
           get.concat(getStockRetrievalUrl(k), function (err, res, data) {
              if (err)
              {
                  console.log(err);
              }
              else
              {
                  var val = parseFloat(data.toString());
                  assetPriceMap[k] = new asset.Asset(asset.AssetType.STOCK, k ,val, val);
              }
            });
        });
    }
};

PriceCache.prototype.refreshAllWithCallback = function(functionCallback, stocksToGrab)
{
    var stocksLeft = stocksToGrab.length;
    if(stocksLeft == 0)
    {
        functionCallback();
        return;
    }
    
    stocksToGrab.forEach(function(k)
    {
        get.concat(getStockRetrievalUrl(k), function (err, res, data) {
          if (err)
          {
              console.log("ERROR ON REFRESHALL FOR STOCK: " + k.toUpperCase());
              if(assetPriceMap[k.toUpperCase()] == null || parseFloat(assetPriceMap[k.toUpperCase()].originalPrice) == parseFloat(0))
              {
                console.log("NULL FOUND FOR STOCK " + k)
                assetPriceMap[k.toUpperCase()] = new asset.Asset(asset.AssetType.STOCK, k.toUpperCase() ,parseFloat(0), parseFloat(0));
              }
          }
          else
          {
                var val = parseFloat(data.toString());
                assetPriceMap[k.toUpperCase()] = new asset.Asset(asset.AssetType.STOCK, k.toUpperCase() ,val, val);
          }
          
          stocksLeft--;
          
          if(stocksLeft == 0)
          {
             functionCallback();
          }
        });
    });
}

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
              if (err) 
              {
                  ctx.reply("ERROR OCCURRED:" + err) 
                  return;
              }
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