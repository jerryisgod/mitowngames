var api = require('../api');

// 檢測當下畫面是否有錯誤訊息
function findErrorWindow() {
  // Session Expired
  // Please Login again
  // LOGIN

  // Beneficiary Approved
  // Payee has been verified

  // Beneficiary Approval Failed
  // We are not able to process your request due to an internal error.
  // TRY AGAIN

  // Try Again
  // The server is taking too long to respond. Please try again.(Error 101).
  // OK

  function find() {
    var title, message, ok;

    // neg_button
    // pos_button

    title = id('com.fedmobile:id/bottom_sheet_alert_title').findOne(1);
    if (title !== null) {
      message = id('com.fedmobile:id/bottom_sheet_alert_message').findOne(1);
      ok = id('com.fedmobile:id/neg_button').findOne(1);
      return {
        title: title.text(),
        message: message !== null ? message.text() : '',
        ok
      };
    }

    title = id('com.fedmobile:id/errorTitle').findOne(1);
    if (title !== null) {
      message = id('com.fedmobile:id/errorViewTextView').findOne(1);
      return {
        title: title.text(),
        message: message !== null ? message.text() : '',
        ok: null
      };
    }

    message = id('com.fedmobile:id/bottom_sheet_alert_message').findOne(1);
    if (message !== null) {
      ok = id('com.fedmobile:id/neg_button').findOne(1);
      return { title: '', message: message.text(), ok };
    }

    return null;
  }

  err = find();
  if (err !== null) {
    console.info(
      JSON.stringify({
        title: err.title,
        message: err.message,
        ok: err.ok !== null ? err.ok.text() : ''
      })
    );

    switch (err.title) {
      case 'Session Expired':
        throw err;
    }

    switch (err.message) {
      case 'Something went wrong…':
        throw err;
    }
  }
}

// 檢查是否發生錯誤
function checkError() {
  findErrorWindow();
  if (err !== null) {
    throw err;
  }
}

// 是否在登入頁
function isLoginPage() {
  return id('com.fedmobile:id/loginView').findOne(1) !== null;
}

// 是否在主頁
function isMainPage() {
  return id('com.fedmobile:id/home_toolbar').findOne(1) !== null;
}

// 返回主頁
function returnToMainPage(noCheck) {
  while (true) {
    if (noCheck === false) {
      checkError();
    }
    if (isLoginPage() === true || isMainPage() === true) {
      sleep(750);
      break;
    }
    back();
    sleep(1000);
  }
}

// 取得餘額
function getBalance(store) {
  var obj = id('com.fedmobile:id/txtCheckBalance').findOne(1);
  if (obj !== null && obj.text() === 'Check Balance') {
    obj.click();
  }

  while (true) {
    checkError();
    var obj = id('com.fedmobile:id/txtBalance').findOne(1);
    if (obj !== null) {
      return obj.text();
    }
    sleep(250);
  }
}

// 取得客戶ID
function getCustomerId(store) {
  id('com.fedmobile:id/fedBookCard').findOne(1).click();

  while (true) {
    checkError();
    if (id('com.fedmobile:id/accountBalanceLoading').findOne(1) === null) {
      sleep(750);
      break;
    }
    sleep(250);
  }

  let customerId = '';

  while (true) {
    checkError();
    var obj = id('com.fedmobile:id/view_details').findOne(1);
    if (obj !== null && obj.clickable() === true) {
      sleep(750);
      obj.click();
      continue;
    }
    obj = id('com.fedmobile:id/value').findOne(1);
    if (obj !== null) {
      sleep(750);
      customerId = obj.text();
      break;
    }
    sleep(250);
  }

  returnToMainPage(false);

  return customerId;
}

// 取得某日期範圍的交易
function fetchTransactions(fromDate, toDate) {
  var transactions = [];
  var lastTransactions = new Set();

  while (true) {
    checkError();

    var done = false;
    var view = id('com.fedmobile:id/transactionRecyclerView').findOne(1);
    var currentDate;

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

      if (txView.childCount() === 1) {
        // Tuesday, 07 Nov 2023
        currentDate = new Date(txView.child(0).text().split(', '));
        currentDate.setUTCHours(0);
        currentDate.setUTCMinutes(0);
        currentDate.setUTCSeconds(0);
        currentDate.setUTCMilliseconds(0);
        currentDate = currentDate.getTime() + 86400000 - 5.5 * 60 * 60 * 1000;
        if (currentDate > toDate) {
          continue;
        }
        if (currentDate < fromDate) {
          done = true;
          break;
        }
      } else if (txView.childCount() === 6) {
        var time = txView.child(5).text();
        var description = txView.child(2).text();
        var amount = txView.child(3).text().split(' ₹ ')[1];
        var type = txView.child(4).text() === 'Credit' ? 'deposit' : 'withdraw';

        if (amount.indexOf('.') === -1) {
          amount += '.00';
        }

        // 01:21 PM
        var parts = time.split(' ');
        var base = parts[1] === 'PM' ? 12 : 0;
        parts = parts[0].split(':');
        if (base === parseInt(parts[0])) {
          parts[0] = '00';
        }
        var date = currentDate + (base + parseInt(parts[0])) * 60 * 60 * 1000 + parts[1] * 60 * 1000;

        var transaction = {
          type, // deposit(存入) or withdraw(支出)
          id: currentDate, // 格式: 交易日期.編號. 如: 1698777000000.9
          date, // 交易日期
          description, // 格式: UPI/UTR/附言/交易結果(successful or failed). 如: UPI/330543006096/default/successful
          balance: '0.00', // 目前固定此值
          amount, // 交易量
          channel: 'UPI', // 目前固定此值
          utr: '' // 交易唯一單號
        };

        parts = transaction.description.split('/');
        if (parts.length > 1) {
          if (parts[0].startsWith('UPI') === true) {
            transaction.channel = 'UPI';
            transaction.utr = parts[1];
          } else if (parts[0].endsWith('IMPS') === true) {
            transaction.channel = 'IMPS';
            transaction.utr = parts[2];
          } else if (parts[0].endsWith('FTB') === true) {
            transaction.channel = 'IMPS';
            transaction.utr = parts[1];
          } else if (transaction.description.startsWith('CHRG/IMPS') === true) {
            transaction.channel = 'IMPS';
          }
        }

        var hashCode = JSON.stringify(transaction);
        if (lastTransactions.has(hashCode) === false) {
          lastTransactions.add(hashCode);
          transactions.push(transaction);
          // console.log(JSON.stringify(transaction));
        }
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

// 代收
function getTransactionHistory(store, fromDate, callback) {
  var toDate = fromDate;

  // for test
  // fromDate -= 86400000 * 30;

  id('com.fedmobile:id/fedBookCard').findOne(1).click();

  while (true) {
    checkError();
    if (id('com.fedmobile:id/accountBalanceLoading').findOne(1) === null) {
      sleep(750);
      break;
    }
    sleep(250);
  }

  while (true) {
    checkError();
    var obj = id('com.fedmobile:id/viewFullStatement').findOne(1);
    if (obj !== null && obj.clickable() === true) {
      sleep(750);
      obj.click();
      break;
    }
    sleep(250);
  }

  while (true) {
    checkError();
    if (id('com.fedmobile:id/transactionRecyclerView').findOne(1) !== null) {
      sleep(750);
      break;
    }
    sleep(250);
  }

  if (text('No transactions to show').findOne(1) === null) {
    var all = fetchTransactions(fromDate, toDate);

    var lastDate = null;
    var lastDateCount = 0;
    for (var i = all.length - 1; i >= 0; i--) {
      var tx = all[i];
      if (lastDate !== tx.id) {
        lastDate = tx.id;
        lastDateCount = 0;
      }
      tx.id = `${tx.id}.${++lastDateCount}`;
      // console.info(`tx: ${JSON.stringify(tx)}`);
    }

    callback(all);
  }

  returnToMainPage(false);
}

// 綁定受益人
function ensureBeneficiary(store, to) {
  // More
  id('com.fedmobile:id/transactionRv').findOne(1).child(3).click();

  // Beneficiary Management
  while (true) {
    checkError();
    var obj = text('Beneficiary\nManagement').findOne(1);
    if (obj !== null && obj.parent().clickable() === true) {
      sleep(750);
      obj.parent().click();
      break;
    }
    sleep(250);
  }

  // Loading
  while (true) {
    checkError();
    var obj = id('com.fedmobile:id/collapsingAppBarLayout').findOne(1);
    if (obj !== null && obj.desc() === 'Beneficiary Management') {
      sleep(750);
      break;
    }
    sleep(250);
  }

  // Search
  while (true) {
    checkError();
    if (id('com.fedmobile:id/progressView').findOne(1) === null) {
      sleep(750);
      id('com.fedmobile:id/searchViewEditText').findOne(1).setText(to.accountNumber);
      break;
    }
    sleep(250);
  }

  // Search Result
  sleep(750);

  if (text('No result found').findOne(1) === null) {
    if (id('com.fedmobile:id/viewPager').findOne(1).child(0).child(0).childCount() !== 1) {
      throw 'code:-15';
    }

    if (id('com.fedmobile:id/itemPayeeAccountNumber').findOne(1).text().indexOf(to.accountNumber) === -1) {
      throw 'code:-16';
    }

    sleep(750);
    id('com.fedmobile:id/ellipses').findOne(1).click();

    // Ensure Menu Item: Delete
    while (true) {
      checkError();
      var obj = text('Delete').findOne(1);
      if (obj !== null) {
        obj = text('Approve Beneficiary').findOne(1);
        if (obj === null) {
          returnToMainPage(false);
          return;
        }
        sleep(750);
        text('Delete').findOne(1).parent().click();
        break;
      }
      sleep(250);
    }

    while (true) {
      // checkError();
      findErrorWindow();
      if (err !== null) {
        // Are you sure you want to delete PRAKASH YESUGADE from Payee list
        if (err.message !== '' && err.message.startsWith('Are you sure you want to delete') !== true) {
          throw err;
        }
      }
      var obj = id('com.fedmobile:id/pos_button').findOne(1);
      if (obj !== null && obj.clickable() === true) {
        sleep(750);
        obj.click();
        break;
      }
      sleep(250);
    }

    while (true) {
      // checkError();
      findErrorWindow();
      if (err !== null) {
        if (err.title.endsWith('has been successfully deleted from beneficiary list') === true) {
          sleep(750);
          break;
        }
        if (err.message !== '') {
          throw err;
        }
      }
      sleep(250);
    }
  } else {
    id('com.fedmobile:id/searchViewIconClear').findOne(1).click();
  }

  // ADD BENEFICIARY
  while (true) {
    checkError();
    var obj = id('com.fedmobile:id/viewPager').findOne(1);
    if (obj !== null) {
      obj = obj.child(0);
      obj = obj.child(obj.childCount() - 1);
      if (obj.clickable() === true) {
        sleep(750);
        obj.click();
        break;
      }
    }
    sleep(250);
  }

  // Other Bank
  while (true) {
    checkError();
    var obj = id('com.fedmobile:id/collapsingAppBarLayout').findOne(1);
    if (obj !== null && obj.desc() === 'Add Beneficiary Account') {
      obj = id('com.fedmobile:id/otherBankSelectorBtn').findOne(1);
      if (obj !== null && obj.clickable() === true) {
        sleep(750);
        obj.click();
        break;
      }
    }
    sleep(250);
  }

  while (true) {
    checkError();
    var obj = id('com.fedmobile:id/ifscBtn').findOne(1);
    if (obj !== null && obj.clickable() === true) {
      sleep(750);
      break;
    }
    sleep(250);
  }

  // Enter Account Number
  sleep(250);
  id('com.fedmobile:id/accountNumber').findOne(1).child(0).child(0).child(0).setText(to.accountNumber);

  // Re-enter Account Number
  sleep(250);
  id('com.fedmobile:id/reEnterAccountNumber').findOne(1).child(0).child(0).child(0).setText(to.accountNumber);

  // Nick Name
  sleep(250);
  id('com.fedmobile:id/nickName').findOne(1).child(0).child(0).child(0).setText(to.accountName);

  // Branch Name & City
  while (true) {
    // IFSC
    sleep(250);
    id('com.fedmobile:id/ifscLayout').findOne(1).child(0).child(0).child(0).setText(to.ifsc);

    var branchLayoutTime1 = Date.now() + 10000;
    while (Date.now() < branchLayoutTime1) {
      checkError();
      var value = id('com.fedmobile:id/branchLayout').findOne(1).child(0).child(0).child(0).text();
      if (value !== null && value !== 'Branch Name & City') {
        sleep(750);
        branchLayoutTime1 = 0;
        break;
      }
      sleep(250);
    }
    if (branchLayoutTime1 === 0) {
      break;
    }

    id('com.fedmobile:id/ifscLayout').findOne(1).child(0).child(0).child(0).setText('');
    sleep(750);
  }

  while (true) {
    checkError();
    if (id('com.fedmobile:id/progressBar').findOne(1) === null) {
      sleep(750);
      break;
    }
    sleep(250);
  }

  // Name
  var name = id('com.fedmobile:id/name').findOne(1).child(0).child(0).child(0);
  if (name.text() === null || name.text() === 'Name' || name.text() !== to.accountName) {
    name.setText(to.accountName);
  }
  sleep(750);

  // PROCEED
  while (true) {
    checkError();
    var obj = id('com.fedmobile:id/continueBtn').findOne(1);
    if (obj !== null && obj.clickable() === true) {
      sleep(750);
      obj.click();
      break;
    }
    sleep(250);
  }

  while (true) {
    // checkError();
    findErrorWindow();
    if (err !== null) {
      sleep(750);
      break;
    }
    sleep(250);
  }

  if (err.title === 'Beneficiary Added' || err.message === 'For making immediate payment approve the beneficiary using Net Banking / Debit Card credentials, or wait for 24 hours for automated approval') {
    // APPROVE NOW
    id('com.fedmobile:id/neg_button').findOne(1).click();

    while (true) {
      checkError();
      var obj = text('Net Banking').findOne(1);
      if (obj !== null && obj.parent().clickable() === true) {
        //先填單
        sleep(750);
        id('com.fedmobile:id/netBankingUsernameEditText').findOne(1).child(0).child(0).setText(store.customer);

        sleep(250);
        id('com.fedmobile:id/netBankingPwdEditText').findOne(1).child(0).child(0).setText(store.password2);

        // 再切頁(不然會有錯誤)
        obj.parent().click();
        break;
      }
      sleep(250);
    }

    // APPROVE
    while (true) {
      checkError();
      var obj = text('APPROVE').findOne(1);
      if (obj !== null && obj.clickable() === true) {
        sleep(750);
        obj.click();
        break;
      }
      sleep(250);
    }

    var approvalFailedCount = 0;

    while (true) {
      // checkError();
      findErrorWindow();
      if (err !== null) {
        // err.title === 'Beneficiary Approval Failed'
        if (err.message.startsWith('We are not able to process your request due to an internal error') === true || err.message.startsWith('The server is taking too long to respond') === true) {
          if (++approvalFailedCount > 1) {
            // throw `code:-15:${err.message}`;
            throw `code:-15:title=${err.title}, message=${err.message}`;
          }

          sleep(750);
          err.ok.click();

          while (true) {
            // checkError();
            findErrorWindow();
            if (err === null) {
              break;
            }
            sleep(250);
          }

          continue;
        }

        // err.title === 'Beneficiary Approved'
        if (err.message === 'Payee has been verified') {
          break;
        }

        if (err.message !== '') {
          // throw `code:-15:${err.message}`;
          throw `code:-15:title=${err.title}, message=${err.message}`;
        }
      }
      sleep(250);
    }

    while (true) {
      findErrorWindow();
      if (err === null) {
        break;
      }
      if (err.message !== 'Payee has been verified') {
        // throw `code:-15:${err.message}`;
        throw `code:-15:title=${err.title}, message=${err.message}`;
      }
      sleep(250);
    }
  } else if (err.title === 'Create Beneficiary') {
    if (err.message === 'Create Beneficiary Failed, customer account already added.') {
      id('com.fedmobile:id/neg_button').findOne(1).click();
    } else {
      // throw `code:-15:${err.message}`;
      throw `code:-15:title=${err.title}, message=${err.message}`;
    }
  } else {
    // throw `code:-15:${err.message}`;
    throw `code:-15:title=${err.title}, message=${err.message}`;
  }

  returnToMainPage(false);
}

// 代付
function transferMoney(store, to, callback) {
  // Send Money
  id('com.fedmobile:id/transactionRv').findOne(1).child(0).click();

  // Send to Account Number
  while (true) {
    checkError();
    var obj = text('Send to Account Number').findOne(1);
    if (obj !== null && obj.parent().clickable() === true) {
      sleep(750);
      obj.parent().click();
      break;
    }
    sleep(250);
  }

  // Loading
  while (true) {
    checkError();
    var obj = id('com.fedmobile:id/collapsingAppBarLayout').findOne(1);
    if (obj !== null && obj.desc() === 'Send to Account') {
      sleep(750);
      break;
    }
    sleep(250);
  }

  // Search
  while (true) {
    checkError();
    if (id('com.fedmobile:id/searchPayeeRecyclerView').findOne(1).childCount() > 0) {
      sleep(750);
      id('com.fedmobile:id/searchViewEditText').findOne(1).setText(to.accountNumber);
      break;
    }
    sleep(250);
  }

  // Search Result
  while (true) {
    checkError();
    if (id('com.fedmobile:id/searchPayeeSearchResultHeader').findOne(1) !== null) {
      sleep(750);
      break;
    }
    sleep(250);
  }

  if (text('No result found').findOne(1) !== null) {
    throw 'code:-17';
  }

  if (id('com.fedmobile:id/searchPayeeRecyclerView').findOne(1).childCount() !== 1) {
    throw 'code:-18';
  }

  if (id('com.fedmobile:id/itemPayeeAccountNumber').findOne(1).text().indexOf(to.accountNumber) === -1) {
    throw 'code:-19';
  }

  id('com.fedmobile:id/dialog_window').findOne(1).click();

  // Enter Amount
  while (true) {
    checkError();
    var obj = id('com.fedmobile:id/enterAmountAmountLabel').findOne(1);
    if (obj !== null) {
      sleep(750);
      id('com.fedmobile:id/enterAmountAmountField').findOne(1).setText(to.amount);
      sleep(250);
      id('com.fedmobile:id/addCommentEditText').findOne(1).child(0).child(0).setText('default');
      break;
    }
    sleep(250);
  }

  // SEND MONRY
  while (true) {
    checkError();
    var obj = id('com.fedmobile:id/enterAmountProceedButton').findOne(1);
    if (obj !== null && obj.clickable() === true) {
      sleep(750);
      obj.click();
      break;
    }
    sleep(250);
  }

  // PAY ₹ 300.00
  while (true) {
    // checkError();
    findErrorWindow();

    // You don't have sufficient balance

    var alert = id('com.fedmobile:id/quickPayAlertTV').findOne(1);
    if (alert !== null) {
      var t = alert.text();
      if (t !== null) {
        throw t;
      }
    }

    if (err !== null) {
      if (err.message !== '') {
        throw err;
      }

      var obj = id('com.fedmobile:id/proceedButton').findOne(1);
      if (obj !== null && obj.clickable() === true) {
        if (to.orderNumber !== 'TEST') {
          // 再次確認是否可出款
          var getPaymentStatusResult = api.send(store, 'getPaymentStatus', {
            orderNumber: to.orderNumber
          });
          if (getPaymentStatusResult.code === 200) {
            if (JSON.parse(getPaymentStatusResult.data).msg !== 'success') {
              throw 'code:-12';
            }
          }

          api.send(store, 'updatePayment', {
            status: 2, // 2: 交易進行中
            utr: '',
            message: '',
            orderNumber: to.orderNumber
          });
        }
        sleep(750);
        obj.click();
        break;
      }
    }

    sleep(250);
  }

  if (to.orderNumber === 'TEST') {
    console.log(`to.orderNumber === 'TEST'`);
    while (true) {
      checkError();
      sleep(250);
    }
  }

  // MPIN
  while (true) {
    checkError();
    var obj = id('com.fedmobile:id/pass_view_keyboard').findOne(1);
    if (obj !== null && obj.clickable() === true) {
      sleep(750);
      var pin = store.password;
      for (var val of pin) {
        sleep(250);
        id(`com.fedmobile:id/buttonNum${val}`).findOne().click();
      }
      break;
    }
    sleep(250);
  }

  // 交易結果
  while (true) {
    // checkError();
    findErrorWindow();
    if (err !== null) {
      if (err.title === 'Transaction Failed') {
        callback(null, err.message);
        break;
      }

      // err.title === 'Transaction in Progress' && err.message === 'Amount of ₹ 907.00 is being transferred to Mr KMOHANRAJ SO KANDHASAMY'
      // err.title === 'Transaction Successful' && err.message === ''

      if (err.message !== '' && err.message.indexOf('is being transferred to') === -1) {
        if (err.message.startsWith('The server is taking too long to respond') === true) {
          // throw `code:-20:${err.message}`;
          throw `code:-20:title=${err.title}, message=${err.message}`;
        }
        throw err;
      }
    }

    var obj = id('com.fedmobile:id/transaction_msg').findOne(1);
    if (obj !== null) {
      var txMessage = obj.text();
      if (txMessage === 'Transaction Successful') {
        var txId = text('Transaction ID').findOne(1).parent().child(1).text();
        callback(txId, '');
      } else {
        callback(null, txMessage);
      }
      break;
    }

    sleep(250);
  }

  returnToMainPage(false);
}

var err = null;

var paymentError = false;

// 成功掛卡後會執行的函式
function run(store) {
  // 等候已在登入頁
  while (true) {
    checkError();
    if (isLoginPage() === true) {
      break;
    }
    sleep(250);
  }

  var accountNumber = null;
  var accountBalance = -1.0;
  var accountBalanceTimes = 999;

  while (true) {
    err = null;
    paymentError = false;

    try {
      // 確認是否在登入頁
      if (isLoginPage() === true) {
        sleep(750);

        // 輸入PinCode
        id('com.fedmobile:id/pass_view_keyboard').findOne().click();
        sleep(750);
        var pin = store.password;
        for (var val of pin) {
          sleep(250);
          id(`com.fedmobile:id/buttonNum${val}`).findOne().click();
        }

        while (true) {
          checkError();

          // The server is temporarily unavailable or is experiencing heavy traffic. Please try again after sometime.(Error 104).
          // Your request could not be processed due to a server error. Please try again after sometime.(Error 102).

          // 檢查特殊錯誤訊息
          var alert = id('com.fedmobile:id/mpinAlertTV').findOne(1);
          if (alert !== null) {
            var t = alert.text();
            if (t !== null) {
              throw t;
            }
          }

          // 確認是否在主頁
          if (isMainPage() === true) {
            sleep(750);
            break;
          }

          sleep(250);
        }
      }

      // 先設定最後交易日為當前時間(印度時間)
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
        checkError();

        // 取得帳號
        if (accountNumber === null) {
          accountNumber = getCustomerId(store);
          console.info(`AccountNumber: ${accountNumber}`);
          if (store.customer !== accountNumber) {
            throw 'code:-5';
          }
        }

        // 取得餘額
        if (++accountBalanceTimes >= 3) {
          accountBalanceTimes = 0;
          var balance = getBalance(store);
          if (balance.startsWith('₹ ') === true) {
            balance = balance.substring('₹ '.length);
          }
          if (accountBalance !== balance) {
            accountBalance = balance;
            api.post(store, 'updateBalance', { balance });
            console.info(`AccountBalance: ${accountBalance}`);
          }
        }

        var paymentData = null;

        // 檢查:
        // 1. 是否有代付需求(op.data)
        // 2. 當前帳號收付款類型(op.data.accountType)或狀態(op.data.accountStatus)
        var fetchOpsResult = api.send(store, 'fetchOps');
        if (fetchOpsResult.code === 200) {
          var opList = JSON.parse(fetchOpsResult.data);
          for (var i = 0; i < opList.length; i++) {
            var op = opList[i];
            switch (op.type) {
              case 1:
                {
                  // 代付資料
                  paymentData = op.data;
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

        // for test
        // paymentData = {
        //   bankName: 'Federal bank',
        //   accountNumber: '13380200017854',
        //   accountName: 'PRAKASH YESUGADE',
        //   ifsc: 'FDRL0001338',
        //   amount: '300',
        //   orderNumber: 'TEST'
        // };
        // paymentData = {
        //   bankName: 'Indian Bank',
        //   accountNumber: '6485327996',
        //   accountName: 'K MOHANRAJ',
        //   ifsc: 'IDIB000P102',
        //   amount: '300',
        //   orderNumber: 'TEST'
        // };

        var something = false;

        // 帳號必須為 上線狀態 & 有代付需求
        if (store.accountStatus === 0 && paymentData !== null) {
          something = true;

          try {
            // 綁定受益人
            ensureBeneficiary(store, paymentData);

            // 進行出款
            while (true) {
              try {
                transferMoney(store, paymentData, function (id, message) {
                  var data;
                  if (id !== null) {
                    data = {
                      status: 0, // 0: 成功
                      utr: id,
                      message: '',
                      orderNumber: paymentData.orderNumber
                    };
                  } else {
                    data = {
                      status: 1, // 1: 失敗
                      utr: '',
                      message,
                      orderNumber: paymentData.orderNumber
                    };
                  }
                  api.post(store, 'updatePayment', data);
                  accountBalanceTimes = 999;
                });
                break;
              } catch (e) {
                if (e === 'code:-17') {
                  returnToMainPage(false);
                  continue;
                }
                throw e;
              }
            }
          } catch (e) {
            // 標註為出款流程失敗
            paymentError = true;
            throw e;
          }

          // 每次出款結束, 都要等待4秒
          var time1 = Date.now() + 4000;
          while (Date.now() < time1) {
            checkError();
            sleep(250);
          }
        }

        // 帳號為 代收+代付 or 代收
        if (store.accountType !== 2) {
          something = true;

          // 撈取交易明細
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
              api.post(store, 'notifyNewTransaction', {
                transactions: txList
              });
              accountBalanceTimes = 999;
            }
          });

          // 每次撈完明細, 都要等待指定秒數
          if (store.interval > 4000) {
            var done = false;
            var time2 = Date.now() + store.interval;
            while (true) {
              // 一次延遲4秒
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

              // 之後確認是否有代付
              var hasPaymentData = false;
              var fetchOpsResult = api.send(store, 'fetchOps');
              if (fetchOpsResult.code === 200) {
                var opList = JSON.parse(fetchOpsResult.data);
                for (var i = 0; i < opList.length; i++) {
                  // 有代付資料
                  if (opList[i].type === 1) {
                    hasPaymentData = true;
                    break;
                  }
                }
              }
              // 有, 就跳出不再等待
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

        // 若沒有執行任何代收或代付任務, 則一律延遲4秒
        if (something === false) {
          var time1 = Date.now() + 4000;
          while (Date.now() < time1) {
            checkError();
            sleep(250);
          }
        }

        // 取得當前時間(印度時間)
        var currentDate = new Date();
        currentDate.setUTCHours(0);
        currentDate.setUTCMinutes(0);
        currentDate.setUTCSeconds(0);
        currentDate.setUTCMilliseconds(0);
        currentDate = currentDate.getTime() - 5.5 * 60 * 60 * 1000;

        // 跨天檢測
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
      // 在 try...catch 區塊要返回錯誤值給 main.js 必須以 thrw eee 的方式再次丟出例外
      // eee 格式為: code:xxx:yyy
      // xxx 為錯誤代碼(可參閱 reportError.js)
      // yyy 為附加的錯誤訊息(可有可無)

      var estr;

      // e 本身是否為字串
      if (typeof e === 'string') {
        console.info(`e-step-1: ${e}`);
        // 簡單確認是否已是 code:xxx:yyy 格式
        if (e.startsWith('code:') === true) {
          console.info('e-step-1.1');
          throw e;
        }
        // 餘額不足
        if (e === "You don't have sufficient balance") {
          console.info('e-step-1.2');
          throw `code:-7:${e}`;
        }
        // 登入失敗
        if (isLoginPage() === true && e.indexOf('Please try again after sometime') > -1) {
          console.info('e-step-1.3');
          throw `code:-13:${e}`;
        }
        // 如果 err 與 e 同時存在, 以 err 為主
        if (err === null) {
          console.info('e-step-1.4');
          throw `code:-1:${e}`;
        }
        // 判斷是否為 findErrorWindow 函式所產生的格式
        if ('title' in err && 'message' in err) {
          console.info(`e-step-1.5: title=${err.title}, message=${err.message}`);
        } else {
          estr = JSON.stringify(err);
          console.info(`e-step-1.6: ${estr}`);
          throw `code:-1:${estr}`;
        }
      } else {
        // 如果 err 與 e 同時存在, 以 err 為主
        if (err === null) {
          // 其它/腳本錯誤
          estr = JSON.stringify(e);
          console.info(`e-step-2: ${estr}`);
          throw `code:${'fileName' in e && 'lineNumber' in e ? -999 : -1}:${estr}`;
        }
        // 判斷是否為 findErrorWindow 函式所產生的格式
        if ('title' in err && 'message' in err) {
          console.info(`e-step-3: title=${err.title}, message=${err.message}`);
        } else {
          estr = JSON.stringify(err);
          console.info(`e-step-4: ${estr}`);
          throw `code:-1:${estr}`;
        }
      }

      // 如果是這二個錯誤就必須再次進行嘗試掛卡
      if (err.title === 'Session Expired' || err.message === 'Something went wrong…') {
        console.info('e-step-5');

        // 如果有按鈕需要點擊確認, 則進行點擊
        if (err.ok !== null) {
          sleep(750);
          err.ok.click();
          sleep(750);
        }

        // 嘗試返回主頁後再次進行掛卡
        try {
          console.info('e-step-5.1');
          returnToMainPage(true);
          console.info('e-step-5.2');
          continue;
        } catch (e2) {
          var estr2 = JSON.stringify(e2);
          console.info(`e-step-5.3: ${estr2}`);
          throw `code:-1:${estr2}`;
        }
      }

      // 都不是上述情況, 回報掛卡失敗
      console.info('e-step-6');
      throw `code:-1:title=${err.title}, message=${err.message}`;
    }
  }
}

// 回傳是否為代付流程錯誤
function isPaymentError(code) {
  return paymentError;
}

module.exports = {
  run,
  isPaymentError
};
