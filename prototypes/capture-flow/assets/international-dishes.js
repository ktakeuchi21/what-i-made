(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhatIMadeInternationalDishes = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const dishes = Object.freeze([
    ["Mac and cheese", "USA", ["macaroni and cheese"]], ["Gumbo", "USA", []], ["Poutine", "CAN", []], ["Clam chowder", "USA", []],
    ["Pupusas", "SLV", ["pupusa"]], ["Jerk chicken", "JAM", []], ["Ropa vieja", "CUB", []], ["Mofongo", "PRI", []], ["Tamales", "MEX", ["tamal"]],
    ["Feijoada", "BRA", []], ["Lomo saltado", "PER", []], ["Pão de queijo", "BRA", ["pao de queijo"]], ["Pastel de choclo", "CHL", []], ["Chivito", "URY", []],
    ["Fish and chips", "GBR", []], ["Beef bourguignon", "FRA", ["boeuf bourguignon"]], ["Stamppot", "NLD", []], ["Irish stew", "IRL", []], ["Currywurst", "DEU", []],
    ["Paella", "ESP", []], ["Risotto", "ITA", []], ["Moussaka", "GRC", []], ["Bacalhau", "PRT", []], ["Carbonara", "ITA", ["spaghetti carbonara"]],
    ["Pierogi", "POL", ["pierogy", "pirogi"]], ["Borscht", "UKR", ["borsch"]], ["Goulash", "HUN", ["gulyas"]], ["Pelmeni", "RUS", []], ["Banitsa", "BGR", []],
    ["Tagine", "MAR", ["tajine"]], ["Koshari", "EGY", ["koshary", "kushari"]], ["Mansaf", "JOR", []], ["İskender kebab", "TUR", ["iskender kebab"]], ["Kabsa", "SAU", []],
    ["Injera", "ETH", []], ["Bunny chow", "ZAF", []], ["Thieboudienne", "SEN", ["ceebu jen", "thiéboudiène"]], ["Ugali", "KEN", []], ["Moambe chicken", "COD", ["poulet moambe"]],
    ["Plov", "UZB", ["palov", "osh"]], ["Beshbarmak", "KAZ", []], ["Manty", "KGZ", ["manti"]], ["Qurutob", "TJK", ["kurutob"]], ["Guriltai shul", "MNG", ["guriltai shöl"]],
    ["Dal makhani", "IND", ["daal makhani"]], ["Kottu roti", "LKA", ["kothu roti"]], ["Momo", "NPL", ["momos"]], ["Nihari", "PAK", []], ["Bhuna khichuri", "BGD", ["bhuna khichdi"]],
    ["Mul naengmyeon", "KOR", ["mul-naengmyeon", "naengmyeon", "mul naengmyun", "mool nang myun", "mul nang myun", "mul neng myun", "mul name young"]],
    ["Bibimbap", "KOR", ["bi bim bap"]], ["Oyakodon", "JPN", ["oyako don"]], ["Mapo tofu", "CHN", ["mapo doufu", "ma po tofu"]], ["Lu rou fan", "TWN", ["滷肉飯"]],
    ["Pad Thai", "THA", ["phat thai"]], ["Phở", "VNM", ["pho"]], ["Nasi lemak", "MYS", []], ["Chicken adobo", "PHL", ["adobo"]], ["Fish amok", "KHM", ["amok trei"]], ["Mohinga", "MMR", []],
    ["Meat pie", "AUS", ["Australian meat pie"]], ["Hāngi", "NZL", ["hangi"]], ["Kokoda", "FJI", []], ["Lap lap", "VUT", ["laplap"]], ["Mumu", "PNG", ["Papua New Guinean mumu"]],
  ].map(([canonicalName, countryCode, aliases], index) => Object.freeze({ id: `dish-${index + 1}`, canonicalName, countryCode, aliases: Object.freeze(aliases) })));

  return { version: 1, dishes };
});
