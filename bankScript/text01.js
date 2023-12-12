var historyTransactions = new Set();
var rvUth = id("net.one97.paytm:id/rv_uth").findOne(1);

function padZero01(num) {
    return num < 10 ? '0' + num : num;
}

function getMonthNumber01(monthStr) {
    const months = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
        'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    return months[monthStr];
}



for(var i=0;i<3;i++){
    var startDate = new Date();
    startDate.setFullYear(2023, 0, 1); 
    var endDate = new Date();
    endDate.setFullYear(2023, 11, 31);
        layout(startDate, endDate);
        rvUth.scrollForward();
        sleep(1000);
    }
    



function findDatesInRange(startDate, endDate) {
    var years = id('net.one97.paytm:id/date').findOne().text();
    var lastFourChars = years.substring(years.length - 4);

    var date = id('net.one97.paytm:id/passbook_payment_time_tv').find();
    var regex = /\b\d{1,2} [a-zA-Z]{3}, \d{1,2}:\d{2} [AP]M\b/;

    for (var i = 0; i < date.length; i++) {
        var textC = date[i].text();
        var match = regex.exec(textC);
        //匹配正則
        if (match && match.length > 0) {
            var dateTime = match[0];
            // console.log(dateTime+' '+lastFourChars);//test
        }

        //切割
        var splitDateTime = dateTime.split(', ');
        var datePart = splitDateTime[0].split(' '); //02 Nov
        var time = splitDateTime[1];   //03:11 PM

        var year = lastFourChars;
        var month = getMonthNumber(datePart[1]);
        var day = datePart[0];

        var timeSplit = time.split(':');
        var hours = parseInt(timeSplit[0]);
        var minutes = parseInt(timeSplit[1]);
        if (datePart[3] === 'PM' && hours < 12) {
            hours += 12;
        }
        var newDate = new Date(`${year}-${month}-${day}T${padZero(hours)}:${padZero(minutes)}:00+08:00`);
        
        // 檢查日期是否在指定的範圍內，並印出符合範圍內的日期
        if (newDate >= startDate && newDate <= endDate) {
            console.log(dateTime + ' ' + lastFourChars);
        }
    }
}






function getDate() { //獲取點入明細的時間


    var dateStr = id('net.one97.paytm:id/dateTimeLabelWithValue').findOne().text();
    // var dateStr = '12:41 PM, 02 Nov 2023';
    if (dateStr.includes('Received at')) {
        dateStr = dateStr.replace('Received at ', ''); 
    }

    var splitDateTime = dateStr.split(', ');
    var datePart = splitDateTime[1].split(' ');
    var time = splitDateTime[0];

    var year = datePart[2];
    var month = getMonthNumber(datePart[1]);
    var day = datePart[0];


    var timeSplit = time.split(':');
    var hours = parseInt(timeSplit[0]);
    var minutes = parseInt(timeSplit[1]);
    if (datePart[3] === 'PM' && hours < 12) {
        hours += 12;
    }


    var date = new Date(`${year}-${month}-${day}T${padZero(hours)}:${padZero(minutes)}:00.000+05:30`);

    var getDate = date.getTime()
    return { dateStr: dateStr, getDate: getDate };

    function padZero(num) {
        return num < 10 ? '0' + num : num;
    }

    function getMonthNumber(monthStr) {
        const months = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
            'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        return months[monthStr];
    }
}



function layout(startDate, endDate) {
    // var years = id('net.one97.paytm:id/date').findOne().text();
    // var lastFourChars = years.substring(years.length - 4);
    var lastFourChars = '2023';
    var date = id('net.one97.paytm:id/passbook_payment_time_tv').find();
    var regex = /\b\d{1,2} [a-zA-Z]{3}, \d{1,2}:\d{2} [AP]M\b/;
    var perdr = id('passbook_entry_row_detail_rl').find();
    var all = [];

    for (var i = 0; i < perdr.length; i++) {
        sleep(1000);
        var textC = perdr[i].child(3).text();
        var match = regex.exec(textC);
        if (match && match.length > 0) {
            var dateTime = match[0];
            // console.log(dateTime+' '+lastFourChars);//test
        }
           //切割
           var splitDateTime = dateTime.split(', ');
           var datePart = splitDateTime[0].split(' '); //02 Nov
           var time = splitDateTime[1];   //03:11 PM
   
           var year = lastFourChars;
           var month = getMonthNumber01(datePart[1]);
           var day = datePart[0];
   
           var timeSplit = time.split(':');
           var hours = parseInt(timeSplit[0]);
           var minutes = parseInt(timeSplit[1]);
           if (datePart[3] === 'PM' && hours < 12) {
               hours += 12;
           }
           var newDate = new Date(`${year}-${month}-${day}T${padZero01(hours)}:${padZero01(minutes)}:00+08:00`);

           
        var amount = perdr[i].child(2).text();
        var info = perdr[i].child(4).text();
        var status = ''; //交易狀態
        if (info === 'Failed') {
            status = 'Failed';
        } else {
            status = 'successful';
        }
       
        if (newDate >= startDate && newDate <= endDate) {
            perdr[i].click();
            sleep(500);
            var childTextC = id('net.one97.paytm:id/tvRefNo').findOne().text();
            var parts = childTextC.split(": ");
            var utr = parts[1].trim();
    
    
            if (!historyTransactions.has(utr)) { //不存在set裡面
                historyTransactions.add(utr);
            }else{
                id('ivBack').findOne().click();
                continue;
            }
    
         
    
            var allDate = getDate();
            var transactionTime = allDate.dateStr;
            var dateID = allDate.getDate;
            var childTextC = id('net.one97.paytm:id/tvRefNo').findOne(1).text();
            var parts = childTextC.split(": ");
            var utr = parts[1].trim();
            // historyTransactions.add(utr);
            
            var description='UPI/'+utr+'/default/'+status;    // 格式: UPI/UTR/交易對象(如果是存入需指定付款人, 反之則是存款人)/附言/交易結果(successful or failed). 如: UPI/330543006096/******5452/default/successful
          
            all.push(`${dateID+'.'+(i+1)}|${utr}|${amount}|${info}|${'0.00'}|${'defined'}|${transactionTime}|${'defined'}|${description}`);
            sleep(1000);
            id('ivBack').findOne(1).click();
            sleep(1500);
        }
                }
        
      

    //輸出all
    for (var j = 0; j < all.length; j++) {
        console.log(`${all[j]}`);
    }
  

}