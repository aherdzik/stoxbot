var AssetType = Object.freeze({
    "CASH" : 1,
    "STOCK" : 2,
    "OPTION" : 3,
    "CRYPTO" : 4,
    "UPCOMING_DIVIDEND" : 5
});

class Asset 
{
  constructor(assetType, name, amount, originalPrice) {
    this.assetType = assetType;
    this.name = name;
    this.amount = amount;
    this.originalPrice = originalPrice;
  }
};

class UpcomingDividend
{
   constructor(name, amount, exDivDate, divReceiveDate) {
    this.exDivDate = exDivDate;
    this.name = name;
    this.amount = amount;
    this.divReceiveDate = divReceiveDate;
    this.assetType = AssetType.UPCOMING_DIVIDEND;
  }
};

isStockMarketOpen = function()
{
    var date = new Date();
    var day = date.getDay();
    if(day == 0 || day == 6){
        return false;
    }
    var hour = date.getHours();
    if(hour<6 || hour > 12){
        return false;
    }
    
    if(hour ==6)
    {
        if(date.getMinutes() <30){
            return false;
        }
    }
    
    return true;
};

module.exports.Asset = Asset;
module.exports.UpcomingDividend = UpcomingDividend;
module.exports.AssetType = AssetType;
module.exports.StockMarketOpen = isStockMarketOpen;