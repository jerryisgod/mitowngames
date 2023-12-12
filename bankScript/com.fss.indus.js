// var { printRootNode } = require('../util/printNode');
var api = require('../api');

function findErrorWindow() {
  // [Title]
  // Ooppsss...
  // [Message]
  // Your session is timed out. Please login again.

  // [Title]
  // Error
  // [Message]
  // Session got invalidated. Please login again!
  // Sorry! We could not process your request currently. Please try again.
  // Transactions are not available for the selected criteria

  // Info
  // You do not have sufficient balance to do this transaction. Please fund your account and try again.
  // OK

  var find = () => {
    var ok = className('android.widget.Button').depth(7).findOne(1);
    if (ok !== null && ok.text() === 'OK') {
      try {
        var parent = ok.parent().parent().parent();
        var title = parent.child(0).child(0);
        var message = parent.child(1).child(0);
        return { title: title.text(), message: message.text(), ok };
      } catch (e) {}
    }
    return null;
  };

  err = find();
  if (err !== null) {
    console.info(
      JSON.stringify({
        title: err.title,
        message: err.message,
        ok: err.ok !== null ? err.ok.text() : ''
      })
    );

    sleep(750);

    switch (err.message) {
      case 'Your session is timed out. Please login again.':
      case 'Session got invalidated. Please login again!':
      case 'Sorry! We could not process your request currently. Please try again.':
        throw err;
    }
  }
}

function checkError() {
  findErrorWindow();
  if (err !== null) {
    throw err;
  }
}

function isLoginPage() {
  return text('Login').findOne(1) !== null;
}

function isMainPage() {
  return text('Statement').findOne(1) !== null;
}

function returnToMainPage(noCheck) {
  while (true) {
    if (noCheck === false) {
      checkError();
    }
    if (isLoginPage() === true || isMainPage() === true) {
      sleep(750);
      break;
    }
    var obj = text('d').findOne(1);
    if (obj !== null) {
      obj.click();
      sleep(1000);
    }
  }
}

function getObjectHashCode(obj) {
  var str = obj.toString();
  var i = str.indexOf('; ');
  if (i === -1) {
    return 0;
  }
  var j = str.substring(0, i).indexOf('@');
  return str.substring(j + 1, i);
}

function fetchTransactions(fromDate, toDate) {
  var transactions = [];
  var lastTransactions = new Set();

  while (true) {
    checkError();

    var done = false;
    var view = className('androidx.recyclerview.widget.RecyclerView').findOne(1);

    var children = view.children();
    for (var i = 0; i < children.length; i++) {
      var txView;
      try {
        txView = children[i];
      } catch (e) {
        txView = null;
      }
      if (txView === null) {
        transactions = [];
        done = true;
        break;
      }

      var date = new Date(`${txView.child(0).text()}T00:00:00.000+05:30`).getTime();

      if (date > toDate) {
        continue;
      }
      if (date < fromDate) {
        done = true;
        break;
      }

      var transaction = {
        type: '',
        id: '',
        date,
        description: txView.child(1).text(),
        balance: '0.00',
        amount: txView.child(2).child(0).text().substring('₹ '.length),
        channel: '',
        utr: ''
      };

      var parts = transaction.description.split('/');
      if (parts.length > 1) {
        if (parts[0] === 'UPI') {
          transaction.channel = 'UPI';
          transaction.utr = parts[1];
        } else if (parts[0] === 'IMPS') {
          transaction.channel = 'IMPS';
          transaction.utr = parts[2];
        } else if (parts[1].startsWith('INDBN') === true) {
          transaction.channel = 'IMPS';
          transaction.utr = parts[1];
        }
      }

      var hashCode = `${getObjectHashCode(txView)}.${JSON.stringify(transaction)}}`;
      if (lastTransactions.has(hashCode) === false) {
        lastTransactions.add(hashCode);
        transactions.push(transaction);
        // console.log(JSON.stringify(transaction));
      }
    }

    if (done === true) {
      // console.info('done');
      break;
    }

    if (view.scrollForward() === false) {
      // console.info('no more...');
      break;
    }

    // console.info('more...');
    sleep(1500);
  }

  return transactions;
}

function getTransactionHistory(store, fromDate, callback) {
  var toDate = fromDate;

  // for test
  // fromDate -= 86400000 * 43;

  while (true) {
    checkError();
    var obj = text('Statement').findOne(1).parent().child(0);
    if (obj !== null && obj.clickable() === true) {
      sleep(750);
      obj.click();
      break;
    }
    sleep(250);
  }

  var hasTransaction = false;

  while (true) {
    findErrorWindow();
    if (err !== null) {
      if (err.message === 'Transactions are not available for the selected criteria') {
        err.ok.click();
        sleep(750);
        break;
      }
      throw err;
    }
    if (text('Transaction History').findOne(1) !== null && text('All').findOne(1) !== null) {
      sleep(750);
      hasTransaction = true;
      break;
    }
    sleep(250);
  }

  if (hasTransaction === false) {
    // for test
    // sleep(750);
    // text('Last 3 Month').findOne(1).parent().child(2).click();
    // while (true) {
    //   findErrorWindow();
    //   if (err !== null) {
    //     if (err.message === 'Transactions are not available for the selected criteria') {
    //       sleep(750);
    //       err.ok.click();
    //       break;
    //     }
    //     throw err;
    //   }
    //   if (text('Transaction History').findOne(1) !== null && text('All').findOne(1) !== null) {
    //     sleep(750);
    //     hasTransaction = true;
    //     break;
    //   }
    //   sleep(250);
    // }
  }

  if (hasTransaction === true) {
    while (true) {
      checkError();
      var obj = className('androidx.recyclerview.widget.RecyclerView').findOne(1);
      if (obj !== null && obj.childCount() > 0) {
        sleep(750);
        break;
      }
      sleep(250);
    }

    var all = fetchTransactions(fromDate, toDate);

    // 故意以相反次序執行
    // 如果出款失敗, 會有2筆相同UTR的交易, 會先記錄出款之後跟著入款
    var allMap = {};
    for (var i = all.length - 1; i >= 0; i--) {
      var tx = all[i];
      tx.type = 'withdraw';
      allMap[`${tx.date}.${tx.description}.${tx.amount}`] = tx;
    }

    text('Credit').findOne(1).click();
    sleep(750);
    var credit = fetchTransactions(fromDate, toDate);

    for (var i = 0; i < credit.length; i++) {
      var tx = credit[i];
      allMap[`${tx.date}.${tx.description}.${tx.amount}`].type = 'deposit';
    }

    var lastDate = null;
    var lastDateCount = 0;
    for (var i = all.length - 1; i >= 0; i--) {
      var tx = all[i];
      if (lastDate !== tx.date) {
        lastDate = tx.date;
        lastDateCount = 0;
      }
      tx.id = `${tx.date}.${++lastDateCount}`;
      // console.info(`tx: ${JSON.stringify(tx)}`);
    }

    callback(all);
  }

  returnToMainPage(false);
}

function transferMoney(store, to, callback) {
  while (true) {
    checkError();
    var clicked = false;
    var obj = text('Fund Transfer').findOne(1).parent();
    for (var i = 0, icnt = obj.childCount(); i < icnt; i++) {
      var cobj = obj.child(i);
      if (cobj.clickable() === true) {
        cobj.click();
        clicked = true;
        break;
      }
    }
    if (clicked === true) {
      break;
    }
    sleep(250);
  }

  while (true) {
    checkError();
    if (text('Transfer Money').findOne(1) !== null) {
      sleep(750);
      break;
    }
    sleep(250);
  }

  text('One Time').findOne(1).click();

  var ifsc = null;

  while (true) {
    checkError();
    var obj = text('IFSC (if applicable)').findOne(1);
    if (obj !== null) {
      ifsc = obj;
      break;
    }
    sleep(250);
  }

  while (true) {
    while (true) {
      checkError();
      var obj = ifsc.parent().parent().child(2).child(1).child(0).child(0);
      if (obj.clickable() === true) {
        obj.click();
        sleep(750);
        break;
      }
      sleep(250);
    }

    var done = false;
    var time1 = Date.now() + 2000;
    while (true) {
      checkError();
      if (id('android:id/text1').findOne(1) !== null) {
        done = true;
        break;
      }
      if (Date.now() >= time1) {
        break;
      }
      sleep(250);
    }
    if (done === true) {
      break;
    }
  }

  var bank = null;
  while (true) {
    checkError();
    var done = false;
    var view = className('android.widget.ListView').findOne(1);
    for (var i = 0, icnt = view.childCount(); i < icnt; i++) {
      var c = view.child(i);
      if (c.text() === 'Others') {
        bank = c;
        break;
      }
    }
    if (bank !== null) {
      break;
    }
    if (view.scrollForward() === false) {
      break;
    }
    sleep(1200);
  }
  if (bank === null) {
    throw 'code:-8';
  }
  sleep(750);
  bank.click();

  sleep(250);
  text('Account Number').findOne(1).setText(to.accountNumber);

  sleep(250);
  text('Beneficiary Name').findOne(1).setText(to.accountName);

  sleep(250);
  text('Amount').findOne(1).setText(to.amount);

  sleep(250);
  text('Remarks').findOne(1).setText('default');

  sleep(250);
  ifsc.setText(to.ifsc);

  sleep(750);
  text('Pay now').findOne(1).click();
  sleep(750);

  if (to.bankName === 'IndusInd Bank') {
    while (true) {
      checkError();
      var ok = text('Ok').findOne(1);
      if (ok !== null) {
        sleep(750);
        ok.click();
        break;
      }
      sleep(250);
    }
  }

  while (true) {
    checkError();
    if (text('Transfer via NEFT').findOne(1) !== null) {
      api.post(store, 'updatePayment', {
        status: 1,
        utr: '',
        message: '收款方不支持IMPS(僅支持NEFT)',
        orderNumber: to.orderNumber
      });
      throw 'code:-11';
    }
    var ok = text('Use IMPS').findOne(1);
    if (ok !== null) {
      sleep(750);
      ok.click();
      continue;
    }
    ok = text('I Confirm, Pay Now').findOne(1);
    if (ok !== null) {
      sleep(750);
      ok.click();
      break;
    }
    sleep(250);
  }

  while (true) {
    checkError();
    if (text('Authentication').findOne(1) !== null) {
      var otpNumbers;
      while (true) {
        checkError();
        otpNumbers = className('android.view.ViewGroup').depth(10).findOne(1);
        // console.log(otpNumbers.childCount());
        if (otpNumbers.childCount() === 6) {
          break;
        }
        sleep(250);
      }

      var otpRemainingTime = otpNumbers.parent().child(1);
      if (otpRemainingTime === '00:00') {
        // resend ???
        throw 'code:-9';
      }

      var done = true;
      for (var i = 0, icnt = otpNumbers.childCount(); i < icnt; i++) {
        var n = otpNumbers.child(i).child(0).text();
        if (n === null || n === '') {
          done = false;
          break;
        }
      }
      if (done === true) {
        sleep(750);

        if (to.orderNumber !== 'TEST') {
          var getPaymentStatusResult = api.send(store, 'getPaymentStatus', { orderNumber: to.orderNumber });
          if (getPaymentStatusResult.code === 200) {
            if (JSON.parse(getPaymentStatusResult.data).msg !== 'success') {
              throw 'code:-12';
            }
          }

          api.send(store, 'updatePayment', {
            status: 2,
            utr: '',
            message: '',
            orderNumber: to.orderNumber
          });

          text('Submit').findOne(1).click();
          sleep(750);
        }
        break;
      }
    }
    sleep(250);
  }

  while (true) {
    checkError();

    try {
      findErrorWindow();
    } catch (e) {
      if (err !== null) {
        if (err.message === 'Your session is timed out. Please login again.') {
          api.post(store, 'updatePayment', {
            status: 3,
            utr: '',
            message: '',
            orderNumber: to.orderNumber
          });
        }
        throw 'code:-14';
      }
      throw e;
    }

    if (text('Transfer Success').findOne(1) !== null) {
      sleep(750);
      var txMessage = text('Transfer Success').findOne(1).parent().parent().child(3).child(0).text();
      // console.info(txMessage);
      var txParts = txMessage.split('no: ');
      var txId = txParts[1].substring(0, txParts[1].length - 1);
      text('Add this to Beneficiary').findOne(1).parent().parent().child(0).child(0).click();
      text('Ok').findOne(1).click();
      callback(txId, '');
      break;
    }

    if (text('Failure').findOne(1) !== null) {
      sleep(750);
      var txMessage = className('android.widget.TextView').depth(4).findOne(1).text();
      // console.info(txMessage);
      text('Ok').findOne(1).click();
      callback(null, txMessage);
      break;
    }

    sleep(250);
  }

  returnToMainPage(false);
}

var err = null;

var paymentError = false;

function run(store) {
  while (true) {
    checkError();
    if (isLoginPage() === true) {
      break;
    }
    sleep(250);
  }

  var accountNumber = null;
  var accountBalance = -1.0;

  while (true) {
    err = null;
    paymentError = false;

    try {
      if (isLoginPage() === true) {
        while (true) {
          checkError();
          if (isLoginPage() === true) {
            sleep(750);
            text('Login').click();
            break;
          }
          sleep(250);
        }

        while (true) {
          checkError();
          if (text('Forgot MPIN?').findOne(1) !== null) {
            sleep(750);
            var pin = store.password;
            for (var val of pin) {
              sleep(250);
              text(val).findOne().click();
            }
            break;
          }
          sleep(250);
        }

        while (true) {
          checkError();
          if (isMainPage() === true) {
            sleep(750);
            break;
          }
          sleep(250);
        }
      }

      var lastTransactionDate = new Date();
      lastTransactionDate.setUTCHours(0);
      lastTransactionDate.setUTCMinutes(0);
      lastTransactionDate.setUTCSeconds(0);
      lastTransactionDate.setUTCMilliseconds(0);
      lastTransactionDate = lastTransactionDate.getTime() - 5.5 * 60 * 60 * 1000;

      // for test
      // lastTransactionDate = new Date('2023-10-30T00:00:00.000+05:30').getTime();

      var toUpdateYesterdayTransaction = false;

      var historyTransactions = new Set();

      while (true) {
        if (accountNumber === null) {
          accountNumber = text('Statement').findOne(1).parent().parent().parent().parent().child(1).child(1).child(1).text();
          console.info(`AccountNumber: ${accountNumber}`);
          if (store.account !== accountNumber) {
            throw 'code:-5';
          }
        }

        var balance = text('Statement').findOne(1).parent().parent().parent().parent().child(1).child(2).text();
        if (balance.startsWith('₹ ') === true) {
          balance = balance.substring('₹ '.length);
        }
        if (accountBalance !== balance) {
          accountBalance = balance;
          api.post(store, 'updateBalance', { balance });
          console.info(`AccountBalance: ${accountBalance}`);
        }

        var paymentData = null;

        var fetchOpsResult = api.send(store, 'fetchOps');
        if (fetchOpsResult.code === 200) {
          var opList = JSON.parse(fetchOpsResult.data);
          for (var i = 0; i < opList.length; i++) {
            var op = opList[i];
            switch (op.type) {
              case 1:
                {
                  paymentData = op.data;
                }
                break;

              case 2:
                {
                  store.accountType = op.data.accountType;
                  store.accountStatus = op.data.accountStatus;
                }
                break;
            }
          }
        }

        // for test
        // paymentData = {
        //   bankName: 'IndusInd Bank',
        //   accountNumber: '159058309562',
        //   accountName: 'rishipal',
        //   ifsc: 'INDB0000049',
        //   amount: '300',
        //   orderNumber: 'TEST'
        // };
        // paymentData = {
        //   bankName: 'Others',
        //   accountNumber: '231000078225',
        //   accountName: 'Ajay Kumar Meena',
        //   ifsc: 'SURY0000011',
        //   amount: '300',
        //   orderNumber: 'TEST'
        // };
        // paymentData = {
        //   bankName: 'Bank of Baroda',
        //   accountNumber: '75520100019169',
        //   accountName: 'M SRINIVASULU',
        //   ifsc: 'BARB0VJTIPA',
        //   amount: '300',
        //   orderNumber: 'TEST'
        // };

        var something = false;

        if (store.accountStatus === 0 && paymentData !== null) {
          something = true;

          try {
            transferMoney(store, paymentData, function (id, message) {
              var data;
              if (id !== null) {
                data = {
                  status: 0,
                  utr: id,
                  message: '',
                  orderNumber: paymentData.orderNumber
                };
              } else {
                data = {
                  status: 1,
                  utr: '',
                  message,
                  orderNumber: paymentData.orderNumber
                };
              }
              api.post(store, 'updatePayment', data);
            });
          } catch (e) {
            paymentError = true;
            throw e;
          }

          var time1 = Date.now() + 4000;
          while (Date.now() < time1) {
            checkError();
            sleep(250);
          }
        }

        if (store.accountType !== 2) {
          something = true;

          getTransactionHistory(store, lastTransactionDate, function (transactions) {
            if (transactions.length === 0) {
              return;
            }
            var txList = [];
            for (var i = 0; i < transactions.length; i++) {
              var tx = transactions[i];
              if (historyTransactions.has(tx.id) === false) {
                historyTransactions.add(tx.id);
                txList.push(tx);
                console.info(JSON.stringify(tx));
              }
            }
            if (txList.length > 0) {
              api.post(store, 'notifyNewTransaction', { transactions: txList });
            }
          });

          if (store.interval > 4000) {
            var done = false;
            var time2 = Date.now() + store.interval;
            while (true) {
              var time3 = Date.now() + 4000;
              while (true) {
                checkError();
                var curTime = Date.now();
                if (curTime >= time2) {
                  done = true;
                  break;
                }
                if (curTime >= time3) {
                  break;
                }
                sleep(250);
              }
              if (done === true) {
                break;
              }

              var hasPaymentData = false;
              var fetchOpsResult = api.send(store, 'fetchOps');
              if (fetchOpsResult.code === 200) {
                var opList = JSON.parse(fetchOpsResult.data);
                for (var i = 0; i < opList.length; i++) {
                  if (opList[i].type === 1) {
                    hasPaymentData = true;
                    break;
                  }
                }
              }
              if (hasPaymentData === true) {
                break;
              }
            }
          } else {
            var time2 = Date.now() + store.interval;
            while (Date.now() < time2) {
              checkError();
              sleep(250);
            }
          }
        }

        if (something === false) {
          var time1 = Date.now() + 4000;
          while (Date.now() < time1) {
            checkError();
            sleep(250);
          }
        }

        var currentDate = new Date();
        currentDate.setUTCHours(0);
        currentDate.setUTCMinutes(0);
        currentDate.setUTCSeconds(0);
        currentDate.setUTCMilliseconds(0);
        currentDate = currentDate.getTime() - 5.5 * 60 * 60 * 1000;

        if (toUpdateYesterdayTransaction === true) {
          toUpdateYesterdayTransaction = false;
          lastTransactionDate = currentDate;
          historyTransactions.clear();
        } else {
          if (currentDate > lastTransactionDate) {
            toUpdateYesterdayTransaction = true;
            lastTransactionDate = currentDate - 86400000;
          }
        }
      }
    } catch (e) {
      // e 本身是否為字串
      if (typeof e === 'string') {
        // 簡單確認是否已是 code:xxx:yyy 格式
        if (e.startsWith('code:') === true) {
          throw e;
        }
        // 如果 err 與 e 同時存在, 以 err 為主
        if (err === null) {
          throw `code:-1:${e}`;
        }
        // 判斷是否為 findErrorWindow 函式所產生的格式
        if ('title' in err && 'message' in err) {
        } else {
          throw `code:-1:${JSON.stringify(err)}`;
        }
      } else {
        // 如果 err 與 e 同時存在, 以 err 為主
        if (err === null) {
          // 其它/腳本錯誤
          throw `code:${'fileName' in e && 'lineNumber' in e ? -999 : -1}:${JSON.stringify(e)}`;
        }
        // 判斷是否為 findErrorWindow 函式所產生的格式
        if ('title' in err && 'message' in err) {
        } else {
          throw `code:-1:${JSON.stringify(err)}`;
        }
      }

      if (err.message.indexOf('You do not have sufficient balance') > -1) {
        throw 'code:-7';
      }

      // 如果是這二個錯誤就必須再次進行嘗試掛卡
      if (err.message.indexOf('Your session is timed out. Please login again') > -1 || err.message.indexOf('Session got invalidated. Please login again') > -1 || err.message.indexOf('Sorry! We could not process your request currently. Please try again') > -1) {
        // 如果有按鈕需要點擊確認, 則進行點擊
        if (err.ok !== null) {
          err.ok.click();
          sleep(750);
        }

        // 嘗試返回主頁後再次進行掛卡
        try {
          returnToMainPage(true);
          continue;
        } catch (e2) {
          throw `code:-1:${JSON.stringify(e2)}`;
        }
      }

      // 都不是上述情況, 回報掛卡失敗
      throw `code:-1:title=${err.title}, message=${err.message}`;
    }
  }
}

function isPaymentError(code) {
  return paymentError;
}

module.exports = {
  run,
  isPaymentError
};
