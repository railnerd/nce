var EventEmitter = require('events').EventEmitter,
	util = require('util');
	SerialPort = require('serialport').SerialPort,
	hexy = require('hexy');


var	NCE = function(devicePath, callback) {
	var self = this;
	EventEmitter.call(self);

	self.response = new Buffer(0);
	self.expectedResponseLength = 0;
	
	self.sp = new SerialPort(devicePath, {baudrate: 9600});
	self.sp.on('error', function(err) {
		callback(err);
	});
	
	self.sp.on('open', function() {

		self.sp.on('data', function (data) {
			self.emit('RECV',data);			// debugging

			// be sure to handle response coming back in multiple chunks
			self.response = Buffer.concat([self.response,data]);

			if (self.response.length === self.expectedResponseLength) {
				self.emit('response',self.response);
			}
		});
		
		self.emit('ready');
		callback();	// we're alive!
	});
}
util.inherits(NCE, EventEmitter);


NCE.prototype.issueCommand = function(cmd,responseSize,callback) {
	var self = this;

	self.emit('SEND',cmd);	// debugging
	
	self.response = new Buffer(0);
	self.expectedResponseLength = responseSize;
	
	self.once('response', function () {
		if (typeof(callback) === 'function') {
			callback(self.response);
		}
	});

	self.sp.write(cmd);
}

NCE.prototype.getVersion = function(callback) {
	this.issueCommand(new Buffer([0xAA]),3,callback)
};

NCE.prototype.nop = function(callback) {
	this.issueCommand(new Buffer([0x80]),1,callback);
};



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

cmdStation.on('SEND', function (data) {
    console.log("SEND : " + hexDump(data));
});


cmdStation.on('ready', function () {
	console.log("hello, world.");

	cmdStation.getVersion(function(vers) {
		console.log("version response: "+ hexDump(vers));

		cmdStation.nop();
	});
});

