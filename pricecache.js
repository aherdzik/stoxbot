const get = require('simple-get');
const asset = require('./asset.js')
var assetPriceMap = new Map();
class PriceCache{
    constructor() 
    {
    }
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
        })
    });
};

PriceCache.prototype.getStockPrice = function(stockName) 
{
    return assetPriceMap[stockName].amount;
};

function getStockRetrievalUrl(stockName)
{
    return ('https://api.iextrading.com/1.0/stock/' + stockName + '/price')
}

module.exports = PriceCache;