runtime.loadDex('./zxing-3.5.2.dex');

importClass(com.google.zxing.PlanarYUVLuminanceSource);
importClass(com.google.zxing.common.HybridBinarizer);
importClass(com.google.zxing.BinaryBitmap);
importClass(com.google.zxing.MultiFormatReader);
importClass(com.google.zxing.NotFoundException);
importClass(com.google.zxing.DecodeHintType);
importClass(com.google.zxing.BarcodeFormat);

function start(callback) {
  var camera = null;
  var surfaceHolder = ui.surfaceView.getHolder();

  var autoFocusCallback = new android.hardware.Camera.AutoFocusCallback({
    onAutoFocus(success, camera) {
      setAutoFocus();
    }
  });

  var setAutoFocus = function () {
    if (camera !== null) {
      camera.autoFocus(autoFocusCallback);
    }
  };

  surfaceHolder.addCallback(
    new JavaAdapter(android.view.SurfaceHolder.Callback, {
      surfaceCreated: function (holder) {
        console.info('surfaceCreated');
        camera = android.hardware.Camera.open(0);
        if (!camera) {
          toastLog('無法開啟攝影機');
          return;
        }
        try {
          var parameters = camera.getParameters();

          var focusModes = parameters.getSupportedFocusModes();
          if (focusModes.contains(android.hardware.Camera.Parameters.FOCUS_MODE_AUTO)) {
            parameters.setFocusMode(android.hardware.Camera.Parameters.FOCUS_MODE_AUTO);
          }

          camera.setParameters(parameters);

          camera.setDisplayOrientation(90);

          camera.setPreviewDisplay(surfaceHolder);

          camera.setPreviewCallback(
            new JavaAdapter(android.hardware.Camera.PreviewCallback, {
              onPreviewFrame(data, camera) {
                // console.info('onPreviewFrame');

                try {
                  var parameters = camera.getParameters();
                  var previewSize = parameters.getPreviewSize();

                  var source = new com.google.zxing.PlanarYUVLuminanceSource(data, previewSize.width, previewSize.height, 0, 0, previewSize.width, previewSize.height, false);
                  if (!source) {
                    console.info('!source');
                    return;
                  }

                  var image = new com.google.zxing.BinaryBitmap(new com.google.zxing.common.HybridBinarizer(source));
                  if (!image) {
                    console.info('!image');
                    return;
                  }

                  var hints = new java.util.HashMap();
                  hints.put(com.google.zxing.DecodeHintType.CHARACTER_SET, 'utf-8');

                  var reader = new com.google.zxing.MultiFormatReader();
                  var rawResult = reader.decode(image, hints);
                  if (!rawResult) {
                    console.info('!rawResult');
                    return;
                  }

                  var text = rawResult.getText();
                  console.info(`onPreviewFrame: success: ${text}`);

                  ui.post(function () {
                    callback(text);
                  });
                } catch (e) {
                  // console.info(`onPreviewFrame: error: ${e.message}`);
                }
              }
            })
          );
        } catch (e) {
          toastLog('攝影機初始化失敗');
        }
      },

      surfaceChanged: function (holder, format, width, height) {
        console.info('surfaceChanged');
        if (camera) {
          camera.startPreview();
          setAutoFocus();
        }
      },

      surfaceDestroyed: function (holder) {
        console.info('surfaceDestroyed');
        focusing = false;
        if (camera) {
          surfaceHolder.addCallback(null);
          camera.stopPreview();
          camera.setPreviewCallback(null);
          camera.release();
          camera = null;
        }
      }
    })
  );
}

module.exports = {
  start
};
