function trySetText(obj, text) {
  if (obj !== null) {
    obj.setText(text);
    sleep(750);
    return true;
  }
  return false;
}

module.exports = {
  trySetText
};
