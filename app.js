var NCE = require('./nce').NCE,
	hexy = require('hexy');

var cmdStation = new NCE("/dev/cu.SLAB_USBtoUART", function (err) {
	if (err !== undefined) {
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

	cmdStation.getVersion(function(vers) {
		console.log("version response: "+ hexDump(vers));
	});

	// FL (headlight) on
	cmdStation.throttleCommand(0xc076,7,(1<<4));

	// Forward @ 64
	cmdStation.throttleCommand(0xc076,4,64, function () {

		// Stop after 5 seconds	
		setTimeout(function () {
			// Stop
			cmdStation.throttleCommand(0xc076,4,0);
			// FL (headlight) off
			cmdStation.throttleCommand(0xc076,7,0);
		}, 5000);
		
	});
});
