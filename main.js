'ui';

var bankList = require('./bankList');
var barcodeScanner = require('./barcodeScanner');
var { reportError } = require('./reportError');
var api = require('./api');
var { isExcludedPackage } = require('./util/isExcludedPackage');

var settings = storages.create('settings');
var store = null;

// runtime.requestPermissions(['android.permission.CAMERA', 'android.permission.GET_TASKS']);
runtime.requestPermissions(['android.permission.CAMERA']);

var launcher = null;
var ticker = null;

var STOPPED = 0;
var STOPPING = 1;
var RUNNING = 2;

var status = threads.atomic(STOPPED);

function launchScript() {
  threads.start(function () {
    stopScript();

    var _launcher = threads.start(function () {
      auto.waitFor();

      if (launchPackage(store.packageName) === false) {
        // 無法啟動App
        reportError(store, -3);
        return;
      }

      waitForPackage(store.packageName);

      var script = null;

      try {
        script = require(`./bankScript/${store.packageName}.js`);
      } catch (e) {
        console.info(e.message);
        // 無法啟動腳本
        reportError(store, -4);
        return;
      }

      api.post(store, 'notifyStarted');
      // var notifyStartedResult = api.send(store, 'notifyStarted');
      // if (notifyStartedResult.code !== 200) {
      //   reportError(store, -1);
      //   return;
      // }
      // if (JSON.parse(notifyStartedResult.data).msg === 'offline') {
      //   reportError(store, -10);
      //   return;
      // }

      var _ticker = threads.start(function () {
        var payload = {
          bankType: store.bankType,
          bankSubType: store.bankSubType,
          account: store.account
        };

        sleep(5000);

        var tTimeout = 30000;
        var tStartTime = 0;
        var tLastTime;
        var tAccTime;

        while (true) {
          api.call('tick', payload);

          var time1 = Date.now() + 60000;
          while (true) {
            var currTime = Date.now();
            if (currTime >= time1) {
              break;
            }

            if (tStartTime === 0) {
              tStartTime = tLastTime = currTime;
              tAccTime = 0;
            }

            var currPkg = currentPackage();
            if (!isExcludedPackage(currPkg) && currPkg !== store.packageName) {
              tAccTime += currTime - tLastTime;
            }
            tLastTime = currTime;

            if (currTime - tStartTime >= tTimeout) {
              console.info(`tAccTime: ${tAccTime}`);
              if (tAccTime / tTimeout >= 0.8) {
                return;
              }
              tStartTime = 0;
            }

            sleep(250);
          }
        }
      });
      _ticker.waitFor();
      ticker = _ticker;

      try {
        script.run(store);
      } catch (e) {
        if (status.get() === RUNNING) {
          var code = -999;
          var message;
          if (typeof e === 'string') {
            if (e.startsWith('code:') === true) {
              var parts = e.split(':');
              code = parseInt(parts[1]);
              if (parts.length >= 3) {
                message = parts.reduce(function (acc, cur, idx) {
                  if (idx >= 2) {
                    acc += acc === '' ? cur : `:${cur}`;
                  }
                  return acc;
                }, '');
              }
            } else {
              code = -1;
              message = e;
            }
          } else if ('message' in e) {
            message = e.message;
          } else if ('fileName' in e && 'lineNumber' in e) {
            message = JSON.stringify(e);
          }
          reportError(store, code, message, script.isPaymentError(code));
        } else {
          // reportError(store, -998, '', script.isPaymentError(code));
        }
      }
    });
    _launcher.waitFor();
    launcher = _launcher;

    status.set(RUNNING);
  });
}

function stopScript() {
  if (ui.isUiThread() === true) {
    if (status.compareAndSet(RUNNING, STOPPING) === true) {
      console.info('0. force stopping script');
    }
  } else {
    if (status.compareAndSet(RUNNING, STOPPING) === true) {
      console.info('1. force stopping script-1');

      while (status.get() === STOPPING) {
        sleep(250);
      }

      console.info('1. force stopping script-2');
    } else if (status.get() === STOPPING) {
      console.info('2. force stopping script-1');

      while (status.get() === STOPPING) {
        sleep(250);
      }

      console.info('2. force stopping script-2');
    }
  }
}

function showMainUI() {
  ui.layout(
    <vertical>
      <horizontal
        id="noBankInfo"
        bg="#f0f0f0"
        w="*"
        h="200dp"
        marginTop="200dp"
        visibility="gone"
      >
        <text
          w="*"
          layout_gravity="center"
          gravity="center"
          maxLines="1"
          text="無掛卡資訊"
          textSize="20sp"
          textColor="#000000"
          bg="#f0f0f0"
        />
      </horizontal>
      <horizontal
        id="bankInfo"
        bg="#f0f0f0"
        w="*"
        h="200dp"
        marginTop="200dp"
        visibility="visible"
      >
        <relative w="0dp" h="*" layout_weight="1">
          <img
            id="bankLogo"
            marginLeft="6dp"
            marginRight="6dp"
            src="file://./bankLogo/com.fss.indus.png"
          />
        </relative>
        <relative w="0dp" h="*" layout_weight="3">
          <vertical w="*" h="*" marginLeft="16dp" marginRight="16dp">
            <horizontal>
              <text
                gravity="left"
                marginLeft="13dp"
                marginTop="12dp"
                maxLines="1"
                text="銀行"
                textSize="20sp"
                textColor="#000000"
                bg="#f0f0f0"
              />
              <text
                id="bankName"
                gravity="left"
                marginLeft="20dp"
                marginTop="12dp"
                maxLines="1"
                text=""
                textSize="20sp"
                textColor="#000000"
                bg="#f0f0f0"
              />
            </horizontal>
            <horizontal>
              <text
                gravity="left"
                marginLeft="13dp"
                marginTop="12dp"
                maxLines="1"
                text="帳號"
                textSize="20sp"
                textColor="#000000"
                bg="#f0f0f0"
              />
              <text
                id="bankAccountNumber"
                gravity="left"
                marginLeft="20dp"
                marginTop="12dp"
                maxLines="1"
                text=""
                textSize="20sp"
                textColor="#000000"
                bg="#f0f0f0"
              />
            </horizontal>
            <frame h="*">
              <button
                id="bankContinue"
                gravity="center"
                marginTop="16dp"
                marginBottom="16dp"
                w="*"
                h="*"
                text="繼續掛卡"
                textSize="20sp"
                textColor="#000000"
              />
            </frame>
          </vertical>
        </relative>
      </horizontal>
      <frame w="*" h="*">
        <button
          id="bankNew"
          layout_gravity="center"
          margin="12dp 0dp 12dp 0dp"
          w="*"
          h="100dp"
          text="新增掛卡"
          textSize="20sp"
          textColor="#000000"
        />
        <text
          id="appVersion"
          layout_gravity="bottom"
          gravity="left"
          w="*"
          h="30dp"
          marginLeft="12dp"
          text="v1.0.0"
        />
      </frame>
    </vertical>
  );

  // VISIBLE: 0
  // INVISIBLE: 4
  // GONE: 8

  var currentBank = settings.get('currentBank', null);
  if (currentBank === null) {
    ui.noBankInfo.setVisibility(0);
    ui.bankInfo.setVisibility(8);
    ui.bankNew.setText('新增掛卡');
  } else {
    console.info(`currentBank: ${JSON.stringify(currentBank)}`);
    ui.noBankInfo.setVisibility(8);
    ui.bankInfo.setVisibility(0);
    ui.bankName.setText(currentBank.bankType);
    ui.bankAccountNumber.setText(currentBank.account);
    ui.bankNew.setText('登出');
    ui.bankLogo.setSource(`file://./bankLogo/${currentBank.packageName}.png`);
    store = currentBank;
  }

  ui.appVersion.setText(`v${app.versionName}`);

  ui.bankNew.click(function () {
    console.info(ui.bankNew.text());

    var currentBank = settings.get('currentBank', null);
    if (currentBank === null) {
      // 新增掛卡
      threads.start(function () {
        while (true) {
          sleep(250);
          if (context.checkSelfPermission('android.permission.CAMERA') === 0) {
            break;
          }
        }

        ui.post(function () {
          ui.layout(
            <vertical>
              <android.view.SurfaceView id="surfaceView" />
            </vertical>
          );

          barcodeScanner.start(function (val) {
            if (store !== null) {
              return;
            }

            console.info(val);

            var params = JSON.parse(val);

            if (!(params.bankType in bankList)) {
              // 銀行類型錯誤
              reportError(
                {
                  bankType: params.bankType,
                  bankSubType: params.bankSubType,
                  account: params.account
                },
                -2
              );
              return;
            }

            var bankApp = bankList[params.bankType];

            store = {
              packageName: bankApp.packageName,
              bankType: params.bankType,
              bankSubType: params.bankSubType,
              accountType: params.accountType, // 0: 代收+代付, 1: 代收, 2: 代付
              accountStatus: params.accountStatus, // 0: 上線狀態, 1:下線狀態
              customer: params.customer,
              account: params.account,
              password: params.password,
              password2: params.password2,
              phoneNumber: params.phone,
              interval: Math.floor(params.getSeconds * 1000)
            };
            settings.put('currentBank', store);

            showMainUI();

            launchScript();
          });
        });
      });
    } else {
      // 登出
      stopScript();

      // reportError(store, 0);

      store = null;
      settings.put('currentBank', null);

      showMainUI();
    }
  });

  ui.bankContinue.click(function () {
    // 繼續掛卡
    console.info(ui.bankContinue.text());

    launchScript();
  });
}

showMainUI();

threads.start(function () {
  while (true) {
    try {
      if (status.get() === STOPPING) {
        if (ticker !== null) {
          if (ticker.isAlive() === true) {
            console.info('0. ticker.isAlive() === true');
            ticker.interrupt();
          }
          ticker = null;
        }

        if (launcher !== null) {
          if (launcher.isAlive() === true) {
            console.info('0. launcher.isAlive() === true');
            launcher.interrupt();
          }
          launcher = null;
        }

        status.set(STOPPED);
      } else if (status.get() === RUNNING) {
        if (ticker !== null && ticker.isAlive() === false) {
          status.set(STOPPING);

          console.info('1. ticker.isAlive() === false');
          ticker = null;

          if (launcher !== null) {
            if (launcher.isAlive() === true) {
              console.info('1. launcher.isAlive() === true');
              launcher.interrupt();
            }
            launcher = null;
          }

          status.set(STOPPED);
        } else if (launcher !== null && launcher.isAlive() === false) {
          status.set(STOPPING);

          console.info('2. launcher.isAlive() === false');
          launcher = null;

          if (ticker !== null) {
            if (ticker.isAlive() === true) {
              console.info('2. ticker.isAlive() === true');
              ticker.interrupt();
            }
            ticker = null;
          }

          status.set(STOPPED);
        }
      }
      sleep(1000);
    } catch (e) {
      console.error(JSON.stringify(e));
    }
  }
});
