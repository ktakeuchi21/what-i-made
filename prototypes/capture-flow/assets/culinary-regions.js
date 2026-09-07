(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhatIMadeCulinaryRegions = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function region(id, name, point, scale, countryKeys) {
    return Object.freeze({ id, name, point: Object.freeze(point), scale, countryKeys: Object.freeze(countryKeys) });
  }

  // A deliberately small, single-membership browsing taxonomy. Country keys match
  // the bundled Natural Earth asset, so archive records do not need to migrate.
  const regions = Object.freeze([
    region("north-america", "North America", [22, 25], 1.75, ["CAN", "GRL", "USA"]),
    region("central-america-caribbean", "Central America & Caribbean", [29, 39], 2.7,
      ["BHS", "BLZ", "CRI", "CUB", "DOM", "GTM", "HND", "HTI", "JAM", "MEX", "NIC", "PAN", "PRI", "SLV", "TTO"]),
    region("south-america", "South America", [36, 66], 1.8,
      ["ARG", "BOL", "BRA", "CHL", "COL", "ECU", "FLK", "GUY", "PER", "PRY", "SUR", "URY", "VEN"]),
    region("northern-western-europe", "Northern & Western Europe", [50, 24], 3,
      ["AUT", "BEL", "CHE", "DEU", "DNK", "EST", "FIN", "FRA", "GBR", "IRL", "ISL", "LTU", "LUX", "LVA", "NLD", "NOR", "SWE"]),
    region("southern-europe-mediterranean", "Southern Europe & Mediterranean", [53, 32], 3.2,
      ["ALB", "BIH", "CYP", "CYN", "ESP", "GRC", "HRV", "ITA", "KOS", "MKD", "MNE", "PRT", "SRB", "SVN"]),
    region("eastern-europe", "Eastern Europe", [58, 25], 2.65,
      ["BGR", "BLR", "CZE", "HUN", "MDA", "POL", "ROU", "RUS", "SVK", "UKR"]),
    region("north-africa-middle-east", "North Africa & Middle East", [58, 40], 2.15,
      ["ARE", "ARM", "AZE", "DZA", "EGY", "GEO", "IRN", "IRQ", "ISR", "JOR", "KWT", "LBN", "LBY", "MAR", "OMN", "PSX", "QAT", "SAH", "SAU", "SDN", "SYR", "TUN", "TUR", "YEM"]),
    region("sub-saharan-africa", "Sub-Saharan Africa", [55, 64], 1.8,
      ["AGO", "BDI", "BEN", "BFA", "BWA", "CAF", "CIV", "CMR", "COD", "COG", "DJI", "ERI", "ETH", "GAB", "GHA", "GIN", "GMB", "GNB", "GNQ", "KEN", "LBR", "LSO", "MDG", "MLI", "MOZ", "MRT", "MWI", "NAM", "NER", "NGA", "RWA", "SDS", "SEN", "SLE", "SOL", "SOM", "SWZ", "TCD", "TGO", "TZA", "UGA", "ZAF", "ZMB", "ZWE"]),
    region("central-asia", "Central Asia", [67, 29], 2.6, ["KAZ", "KGZ", "TJK", "TKM", "UZB"]),
    region("south-asia", "South Asia", [70, 45], 2.45, ["AFG", "BGD", "BTN", "IND", "LKA", "NPL", "PAK"]),
    region("east-asia", "East Asia", [80, 34], 2.1, ["CHN", "JPN", "KOR", "MNG", "PRK", "TWN"]),
    region("southeast-asia", "Southeast Asia", [80, 56], 2.1,
      ["BRN", "IDN", "KHM", "LAO", "MMR", "MYS", "PHL", "THA", "TLS", "VNM"]),
    region("oceania", "Oceania", [89, 69], 1.65,
      ["ATA", "ATF", "AUS", "FJI", "NCL", "NZL", "PNG", "SLB", "VUT"]),
  ]);

  const byId = new Map(regions.map((item) => [item.id, item]));
  const byCountryKey = new Map();
  regions.forEach((item) => item.countryKeys.forEach((countryKey) => byCountryKey.set(countryKey, item)));

  function findRegion(id) {
    return byId.get(String(id || "")) || null;
  }

  function findRegionByCountryKey(countryKey) {
    return byCountryKey.get(String(countryKey || "")) || null;
  }

  return { regions, findRegion, findRegionByCountryKey };
});
