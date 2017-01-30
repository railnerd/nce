var NCEDCC = require('./index').NCEDCC,
	hexy = require('hexy');

var cmdStation = new NCEDCC("/dev/cu.SLAB_USBtoUART", function (err) {
	if (err) {
		console.error("Failed to initialize: " + err);
		process.exit(1);
	}
});

// debugging hooks to examine command station traffic

function hexDump(buf) {
	var dumpString = hexy.hexy(buf,{numbering:"none", format:"twos", annotate: "none"});
	return dumpString.substring(0,dumpString.length-2);
}

cmdStation.on('RECV', function (data) {
    console.log("RECV : " + hexDump(data));
});

cmdStation.on('response', function (data) {
    console.log("RESPONSE : " + hexDump(data));
});

cmdStation.on('SEND', function (data) {
    console.log("SEND : " + hexDump(data));
});


cmdStation.on('ready', function () {

	cmdStation.getVersion(function(err,vers) {
		console.log("version response: "+ hexDump(vers));
	});

	// FL (headlight) on
	cmdStation._throttleCommand(0xc076,7,(1<<4));

	// Forward @ 64
	cmdStation.setSpeedAndDirection(0xc076,64,true, function (err) {

		// Stop after 5 seconds	
		setTimeout(function (err) {
			cmdStation.setSpeedAndDirection(0xc076,0,true);				// Stop
			cmdStation._throttleCommand(0xc076,7,0);					// FL (headlight) off
		}, 5000);

	});

	// Set DCC Signal 1 Flashing Green
	cmdStation.setSignal(1,5, function (err) {
		setTimeout(function (err) {
			cmdStation.setSignal(1,31);	// 	// Set DCC Signal 1 to Dark after 10 seconds
		}, 10000);
	});

});
