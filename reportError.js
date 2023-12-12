var api = require('./api');
var { isExcludedPackage } = require('./util/isExcludedPackage');

var errorMessageTable = {
  0: '手動停止掛卡(登出)',
  '-1': '其它錯誤',
  '-998': '自動停卡',
  '-999': '腳本錯誤',
  '-2': '銀行類型錯誤',
  '-3': '無法啟動App',
  '-4': '無法啟動腳本',
  '-5': '帳號無法匹配',
  '-6': '腳本執行異常(不在前景)',
  '-7': '無法出款(餘額不足)',
  '-8': '無法匹配出款銀行',
  '-9': '接收otp逾時',
  '-10': '帳號已下線', // 不再使用
  '-11': '收款方不支持IMPS(僅支持NEFT)',
  '-12': '代付單已被鎖定',
  '-13': '目前無法登入, 請切換VPN或稍後再試',
  '-14': '無法出款(交易異常)',
  '-15': '無法綁定受益人(Error -15)', // for Federal Bank
  '-16': '無法綁定受益人(Error -16)', // for Federal Bank
  '-17': '無法出款(Error -17)', // for Federal Bank
  '-18': '無法出款(Error -18)', // for Federal Bank
  '-19': '無法出款(Error -19)', // for Federal Bank
  '-20': '銀行網絡延遲問題, 代付請先手動檢查是否已出款'
};

function reportError(store, code, message, isPaymentError) {
  console.info(`reportError: ${code}, ${message}`);

  api.post(store, 'notifyClosed', {
    code,
    message: message !== undefined ? message : '',
    isPaymentError
  });

  if (code !== 0) {
    var errMsg = code !== -1 && code !== -999 && code in errorMessageTable ? errorMessageTable[code] : '已停止掛卡';
    threads.start(function () {
      while (true) {
        var currPkg = currentPackage();
        if (!isExcludedPackage(currPkg) && currPkg !== store.packageName) {
          break;
        }
        toast(errMsg);
        sleep(3000);
      }
    });
  }
}

module.exports = {
  reportError
};
