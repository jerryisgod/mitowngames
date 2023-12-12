function tryClick(obj) {
  if (obj !== null && obj.clickable() === true) {
    obj.click();
    sleep(750);
    return true;
  }
  return false;
}

module.exports = {
  tryClick
};
