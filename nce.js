var EventEmitter = require('events').EventEmitter,
	util = require('util');
	SerialPort = require('serialport').SerialPort;


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

	// to do: add queuing to avoid overrunning commands

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

NCE.prototype.nop = function(callback) {
	this.issueCommand(new Buffer([0x80]),1,callback);
};

NCE.prototype.getVersion = function(callback) {
	this.issueCommand(new Buffer([0xaa]),3,callback)
};

NCE.prototype.enterProgramTrackMode = function(callback) {
	this.issueCommand(new Buffer([0x9e]),1,callback);
};

NCE.prototype.exitProgramTrackMode = function(callback) {
	this.issueCommand(new Buffer([0x9f]),1,callback);
};

NCE.prototype.writeCV = function(cv,value,callback) {
	// paged 0xa0; direct 0xa8
	this.issueCommand(new Buffer([0xa0,((cv >> 8) & 0xff),(cv & 0x0ff),value]),1,callback);
};

NCE.prototype.readCV = function(cv,callback) {
	// paged 0xa1; direct 0xa9
	this.issueCommand(new Buffer([0xa1,((cv >> 8) & 0xff),(cv & 0x0ff)]),2,callback);
};

NCE.prototype.throttleCommand = function(address,op,data,callback) {
	this.issueCommand(new Buffer([0xa2,((address >> 8) & 0xff),(address & 0x0ff),op,data]),1,callback);
};

NCE.prototype.accessoryCommand = function(address,op,data,callback) {
	this.issueCommand(new Buffer([0xad,((address >> 8) & 0xff),(address & 0x0ff),op,data]),1,callback);
};


module.exports = {
    NCE: NCE
};
