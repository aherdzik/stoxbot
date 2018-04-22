var AssetType = Object.freeze({
    "CASH" : 1,
    "STOCK" : 2,
    "OPTION" : 3,
    "CRYPTO" : 4
});

class Asset 
{
  constructor(assetType, name, amount, originalPrice) {
    this.assetType = assetType;
    this.name = name;
    this.amount = amount;
    this.originalPrice = originalPrice;
  }
}

module.exports.Asset = Asset;
module.exports.AssetType = AssetType;