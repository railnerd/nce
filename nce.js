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

module.exports = {
    NCE: NCE
};
