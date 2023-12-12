// var baseUrl = 'https://api.morganpay777.com';
// var baseUrl = 'https://demo-api.morgan001.com';
// var baseUrl = 'https://api.ajpay.net';
// var baseUrl = 'https://api.happypay777.net';
// var baseUrl = 'https://api.skypay777.com';

var baseUrl = 'http://arkapi.apgame001.win';

/*
// 更新支付結果
updatePayment:
{
  status: number, // 0: 成功, 1: 失敗, 2: 交易進行中, 3: 交易逾時
  utr: string,
  message: string,
  orderNumber: string
}
*/

/*
// 更新有新的交易明細
notifyNewTransaction:
{
  transactions: {
    type: string,
    id: string,
    date: string,
    description: string,
    balance: string,
    amount: string,
    channel: string,
    utr: string
  }[]
}
*/

/*
// 取得某支付單號的狀態
getPaymentStatus:
{
  orderNumber: string
}
*/

/*
// 更新帳號餘額
updateBalance:
{
  balance: string
}
*/

/*
// 取得最新的帳號狀態/代付需求
fetchOps:
{

}
[
  {
    type: number, // 1: 代付需求, 2: 帳號狀態
    data: 
    // 當 type == 1
    {
      bankName: string,
      accountNumber: string,
      accountName: string',
      ifsc: string,
      amount: string,
      orderNumber: string
    }
    // 當 type == 2
    {
      accountType: number, // 0: 代收+代付, 1: 代收, 2: 代付
      accountStatus: number // 0: 上線狀態, 1:下線狀態
    }
  }
]
*/

function call(apiName, payload) {
  var code = -1;
  var data = null;
  try {
    var response = http.postJson(`${baseUrl}/api/v1/bank/android/${apiName}`, payload);
    code = response.statusCode;
    if (code === 200) {
      data = response.body.string();
      console.info(`${apiName}: status=${code}, data=${data}`);
    } else {
      console.info(`${apiName}: status=${code}`);
    }
  } catch (e) {
    code = -1;
    data = e;
  }
  return { code, data };
}

function post(store, apiName, payload, callback) {
  var temp = {
    bankType: store.bankType,
    bankSubType: store.bankSubType,
    account: store.account
  };

  if (payload !== null && typeof payload === 'object') {
    var names = Object.getOwnPropertyNames(payload);
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      temp[name] = payload[name];
    }
  }
  payload = temp;

  return threads.start(function () {
    var result = call(apiName, payload);
    if (typeof callback === 'function') {
      callback(result.code, result.data);
    }
  });
}

function send(store, apiName, payload) {
  var result = {};
  var done = threads.atomic(0);

  post(store, apiName, payload, function (code, data) {
    result.code = code;
    result.data = data;
    done.set(1);
  });

  while (done.get() === 0) {
    sleep(250);
  }

  return result;
}

module.exports = {
  call,
  post,
  send
};
