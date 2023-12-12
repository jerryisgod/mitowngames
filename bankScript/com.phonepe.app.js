var api = require('../api');

var err = null;

function findErrorWindow() {
  return null;
}

function checkError() {
  err = findErrorWindow();
  if (err !== null) {
    throw err;
  }
}

function isMainPage() {
  return id('com.phonepe.app:id/vg_main_activity_container').findOne(1) !== null;
}

function returnToMainPage(noCheck) {
  while (true) {
    if (noCheck === false) {
      checkError();
    }
    if (isMainPage() === true) {
      sleep(750);
      break;
    }
    back();
    sleep(1000);
  }
}

function normalizePhoneNumber(phoneNumber) {
  // 9627534201
  // 09627534201
  // 919627534201
  if (phoneNumber.startsWith('0') === true) {
    phoneNumber = phoneNumber.substring(1);
  } else if (phoneNumber.startsWith('91') === false) {
    phoneNumber = phoneNumber.substring(2);
  }
  return phoneNumber;
}

function getBalance(store) {}

function getPhoneNumber(store) {
  var obj = id('com.phonepe.app:id/tv_location_tags').findOne(1).parent().parent().parent().child(0);
  if (obj.id() !== 'com.phonepe.app:id/ivLogoContainer') {
    throw 'code:-1:phone number == null';
  }
  obj.click();

  var phoneNumber;

  while (true) {
    checkError();
    var obj = id('com.phonepe.app:id/tv_sub_text').findOne(1);
    if (obj !== null) {
      sleep(750);
      phoneNumber = obj.text();
      break;
    }
    sleep(250);
  }

  // desc('Navigate up').findOne(1).click();
  back();
  sleep(750);

  return phoneNumber;
}

function getTxDetail(store, txView) {
  // var detail = { txId: '1699813800000', fromOrTo: 'RAHAMATHULLA G', utr: '331777697048', message: 'default', status: 'successful' };

  txView.click();

  while (true) {
    checkError();
    if (text('Transaction ID').findOne(1) !== null) {
      sleep(750);
      break;
    }
    sleep(250);
  }

  var detail = {
    message: 'default'
  };

  detail.status = id('com.phonepe.app:id/toolbar').findOne(1).child(1).text().toUpperCase().endsWith('SUCCESSFUL') ? 'successful' : 'failed';

  // var type = id('com.phonepe.app:id/receiver_title').findOne(1).text();
  // if (type === 'Received from') {
  //   detail.fromOrTo = id('com.phonepe.app:id/tv_transaction_receiver_name').findOne(1).text();
  // } else {
  //   detail.fromOrTo = id('com.phonepe.app:id/tv_transaction_receiver_id_text').findOne(1).text();
  // }

  var message = text('Message').findOne(1);
  if (message !== null) {
    detail.message = message.parent().child(1).text();
  }

  detail.txId = text('Transaction ID').findOne(1).parent().child(1).text();

  detail.utr = id('com.phonepe.app:id/tv_payment_instrument_utr').findOne(1).text().split('UTR: ')[1];

  // desc('Navigate up').findOne(1).click();
  back();

  while (true) {
    checkError();
    if (id('com.phonepe.app:id/rv_transaction_list').findOne(1) !== null) {
      sleep(750);
      break;
    }
    sleep(250);
  }

  return detail;
}

function fetchTransactions(todayDate, fromDate, toDate) {
  var transactions = [];
  var lastTransactions = new Set();

  while (true) {
    checkError();

    var done = false;
    var i = 0;
    var icnt = id('com.phonepe.app:id/rv_transaction_list').findOne(1).childCount();

    while (i < icnt) {
      var txView;
      try {
        txView = id('com.phonepe.app:id/rv_transaction_list').findOne(1).child(i++);
      } catch (e) {
        txView = null;
      }
      if (txView === null) {
        transactions = [];
        done = true;
        break;
      }

      var txc0 = txView.child(0);

      // 13 11月 2023
      var parts = txc0.child(1).child(0).text().split(' ');
      var date;

      // console.log(parts);

      if (parts[2] === 'ago') {
        date = todayDate;
        if (parts[1].startsWith('day') === true) {
          date -= parseInt(parts[0]) * 86400000;
        }
      } else {
        parts[1] = parts[1].split('月')[0];
        parts[1] = parts[1].length > 1 ? parts[1] : `0${parts[1]}`;
        date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00.000+05:30`).getTime();
      }

      if (date > toDate) {
        continue;
      }
      if (date < fromDate) {
        done = true;
        break;
      }

      var txc0c0c1 = txc0.child(0).child(1);

      var transaction = {
        type: txc0c0c1.child(0).text() === 'Received from' ? 'deposit' : 'withdraw',
        amount: `${txc0c0c1.child(1).text().split('₹')[1]}.00`,
        id: date,
        balance: '0.00',
        channel: 'UPI',
        date
      };

      var detail = getTxDetail(store, txView);
      if (lastTransactions.has(detail.txId) === false) {
        lastTransactions.add(detail.txId);

        transaction.utr = detail.utr;

        // transaction.description = `${transaction.channel}/${transaction.utr}/${detail.fromOrTo}/${detail.message}/${detail.status}`;
        transaction.description = `${transaction.channel}/${transaction.utr}/${detail.message}/${detail.status}`;

        transactions.push(transaction);
        // console.log(JSON.stringify(transaction));
      }

      sleep(750);
    }

    if (done === true) {
      // console.info('done');
      break;
    }

    if (id('com.phonepe.app:id/rv_transaction_list').findOne(1).scrollForward() === false) {
      // console.info('no more...');
      break;
    }

    // console.info('more...');
    sleep(1500);
  }

  return transactions;
}

function getTransactionHistory(store, fromDate, callback) {
  var todayDate = fromDate;

  var toDate = fromDate;

  // for test
  fromDate -= 86400000 * 32;

  while (true) {
    checkError();
    var obj = id('com.phonepe.app:id/tab_transactions').findOne(1);
    if (obj !== null && obj.clickable() === true) {
      sleep(750);
      obj.click();
      break;
    }
    sleep(250);
  }

  var hasTransaction = false;

  while (true) {
    checkError();
    if (text('Make your first transaction').findOne(1) !== null) {
      sleep(750);
      break;
    }
    var obj = id('com.phonepe.app:id/rv_transaction_list').findOne(1);
    if (obj !== null && obj.childCount() > 0) {
      sleep(750);
      hasTransaction = true;
      break;
    }
    sleep(250);
  }

  if (hasTransaction === true) {
    var all = fetchTransactions(todayDate, fromDate, toDate);

    var lastDate = null;
    var lastDateCount = 0;
    for (var i = all.length - 1; i >= 0; i--) {
      var tx = all[i];
      if (lastDate !== tx.id) {
        lastDate = tx.id;
        lastDateCount = 0;
      }
      tx.id = `${tx.id}.${++lastDateCount}`;
      // console.info(`${JSON.stringify(tx)}`);
    }

    callback(all);
  }

  id('com.phonepe.app:id/tab_home').findOne(1).click();

  while (true) {
    checkError();
    if (isMainPage() === true) {
      sleep(750);
      break;
    }
    sleep(250);
  }
}

function run(store) {
  while (true) {
    checkError();
    if (isMainPage() === true) {
      sleep(750);
      break;
    }
    sleep(250);
  }

  var phoneNumber = null;
  var accountBalance = -1.0;

  while (true) {
    err = null;

    try {
      var lastTransactionDate = new Date();
      lastTransactionDate.setUTCHours(0);
      lastTransactionDate.setUTCMinutes(0);
      lastTransactionDate.setUTCSeconds(0);
      lastTransactionDate.setUTCMilliseconds(0);
      lastTransactionDate = lastTransactionDate.getTime() - 5.5 * 60 * 60 * 1000;

      // for test
      // lastTransactionDate = new Date('2023-12-05T00:00:00.000+05:30').getTime();

      var toUpdateYesterdayTransaction = false;

      var historyTransactions = new Set();

      while (true) {
        checkError();

        if (phoneNumber === null) {
          phoneNumber = getPhoneNumber(store);
          console.info(`PhoneNumber: ${phoneNumber}`);
          if (normalizePhoneNumber(store.phoneNumber) !== normalizePhoneNumber(phoneNumber)) {
            throw 'code:-5';
          }
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
                  // 代付資料
                  // paymentData = op.data;
                }
                break;

              case 2:
                {
                  // 0: 代收+代付, 1: 代收, 2: 代付
                  store.accountType = op.data.accountType;

                  // 0: 上線狀態, 1:下線狀態
                  store.accountStatus = op.data.accountStatus;
                }
                break;
            }
          }
        }

        var something = false;

        if (store.accountStatus === 0 && paymentData !== null) {
          something = true;
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
      throw `code:-1:${JSON.stringify(e)}`;
    }
  }
}

function isPaymentError(code) {
  return false;
}

module.exports = {
  run,
  isPaymentError
};
