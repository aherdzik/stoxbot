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

module.exports.Asset = Asset;
module.exports.AssetType = AssetType;