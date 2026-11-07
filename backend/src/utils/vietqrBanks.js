"use strict";

// Common VietQR / NAPAS bank BIN codes mapped to human-readable short names.
const VIETQR_BANKS = Object.freeze({
  "970422": "MB Bank",
  "970436": "Vietcombank",
  "970415": "VietinBank",
  "970418": "BIDV",
  "970407": "Techcombank",
  "970416": "ACB",
  "970432": "VPBank",
  "970423": "TPBank",
  "970405": "Agribank",
  "970448": "OCB",
  "970437": "HDBank",
  "970441": "VIB",
  "970443": "SHB",
  "970403": "Sacombank",
  "970426": "MSB",
  "970454": "VietCapitalBank",
  "970414": "OceanBank",
  "970431": "Eximbank",
  "970440": "SeABank",
  "970449": "LPBank",
  "970428": "Nam A Bank",
  "970409": "Bac A Bank",
  "970452": "KienlongBank",
  "970438": "BaoViet Bank",
  "970427": "VietABank",
  "970433": "VietBank",
  "970419": "NCB",
  "970424": "Shinhan Bank",
  "970458": "UOB",
  "970410": "Standard Chartered",
  "970439": "Public Bank",
});

function bankNameFromBin(bin) {
  if (!bin) return null;
  const normalized = String(bin).trim();
  return VIETQR_BANKS[normalized] || normalized;
}

module.exports = { VIETQR_BANKS, bankNameFromBin };
