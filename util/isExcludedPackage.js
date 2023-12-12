function isExcludedPackage(packageName) {
  // com.google.android.inputmethod 是鍵盤畫面
  return packageName.startsWith('com.google.android.inputmethod.');
}

module.exports = {
  isExcludedPackage
};
