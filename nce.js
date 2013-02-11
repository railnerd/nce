var EventEmitter = require('events').EventEmitter,
	util = require('util'),
	SerialPort = require('serialport').SerialPort;


var	NCE = function(devicePath, callback) {
	var self = this;
	EventEmitter.call(self);

	self.useDirectMode = false;
	self.commandQueue = [];
	self.currentCommand = null;
	
	self.sp = new SerialPort(devicePath, {baudrate: 9600});
	self.sp.on('error', function(err) {
		callback(err);
	});
	
	self.sp.on('open', function() {

		self.sp.on('data', function (data) {
			self.emit('RECV',data);			// debugging

			if (self.currentCommand) {
				// Handle response coming back in multiple chunks
				self.currentCommand.responseBuffer = Buffer.concat([self.currentCommand.responseBuffer,data]);

				if (self.currentCommand.responseBuffer.length === self.currentCommand.expectedResponseLength) {
					self.emit('response',self.currentCommand.responseBuffer);
					
					if (typeof self.currentCommand.callback === 'function')	{
						self.currentCommand.callback(self.currentCommand.responseBuffer);
					}

					// switch to the next command in the queue
					self.commandQueue.shift();
					if (self.commandQueue[0] !== undefined) {
						self.execCommand(self.commandQueue[0]);
					}
				}
			}
		});
		
		self.emit('ready');
		callback();	// we're alive!
	});

	self.on('command', function(newCommand) {
		self.commandQueue.push(newCommand);
		if (newCommand === self.commandQueue[0]) {
			self.execCommand(self.commandQueue[0]);
		}
	});
	
}
util.inherits(NCE, EventEmitter);


NCE.prototype.execCommand = function (newCommand) {
	var self = this;
	
	self.currentCommand = newCommand;
	self.emit('SEND',newCommand.command);
	self.sp.write(newCommand.command);
}

NCE.prototype.issueCommand = function (cmd,responseSize,callback) {
	var self = this;
	var newCommand = {
		command:cmd,
		responseBuffer: new Buffer(0),
		expectedResponseLength:responseSize,
		callback:callback
	};

	self.emit('command',newCommand);
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

NCE.prototype.enableDirectCV = function(useDirectMode) {
	this.useDirectMode = useDirectMode;
}

NCE.prototype.writeCV = function(cv,value,callback) {
	// paged 0xa0; direct 0xa8
	this.issueCommand(new Buffer([(this.useDirectMode ? 0xa8 : 0xa0),((cv >> 8) & 0xff),(cv & 0x0ff),value]),1,callback);
};

NCE.prototype.readCV = function(cv,callback) {
	// paged 0xa1; direct 0xa9
	this.issueCommand(new Buffer([(this.useDirectMode ? 0xa9 : 0xa1),((cv >> 8) & 0xff),(cv & 0x0ff)]),2,callback);
};

NCE.prototype.throttleCommand = function(address,op,data,callback) {
/*
	0xA2 sends speed or function packets to a locomotive.
	Command Format: 0xA2 <addr_h> <addr_l> <op_1> <data_1>
	
	Addr_h and Addr_l are the loco address in DCC format.
	If a long address is in use, bits 6 and 7 of the high byte are set.
	Example: Long address 3 = 0xc0 0x03 Short address 3 = 0x00 0x03
	op_1 data_1
	
	01 0-7f	Reverse 28 speed command *BUGGY, DO NOT USE!
	02 0-7f	Forward 28 speed command *BUGGY, DO NOT USE!
	03 0-7f	Reverse 128 speed command
	04 0-7f	Forward 128 speed command
	05 0	Estop reverse command
	06 0	Estop forward command
	07 0-1f	Function group 1 (same format as DCC packet for FG1
	08 0-0f	Function group 2 (same format as DCC packet for FG2
	09 0-0f	Function group 3 (same format as DCC packet for FG3
	0a 0-7f	Set reverse consist address for lead loco
	0b 0-7f	Set forward consist address for lead loco
	0c 0-7f	Set reverse consist address for rear loco
	0d 0-7f	Set forward consist address for rear loco
	0e 0-7f	Set reverse consist address for additional loco
	0f 0-7f	Set forward consist address for additional loco
	10 0	Del loco from consist
	11 0	Kill consist
	12 0-9	Set momentum
	15 0-ff	Functions 13-20 control (bit 0=F13, bit 7=F20)
	16 0-ff	Functions 21-28 control (bit 0=F21, bit 7=F28)
	17 0-3f	Assign this loco to cab number in data_1
	
	Returns: ! = success
	1 = bad loco address
 */

	this.issueCommand(new Buffer([0xa2,((address >> 8) & 0xff),(address & 0x0ff),op,data]),1,callback);
};

NCE.prototype.accessoryCommand = function(address,op,data,callback) {
/*
	Command Format: 0xAD <addr_h> <addr_l> <op_1> <data_1>

	The address range is 1-2047
	Addr_h and Addr_l are the accessory/signal address (NOT in DCC format).

	Example:
		Accessory Address 513 = 0x02 0x01
		Accessory Address 6 = 0x00 0x06

	NOTE:	Accy/signal address 0 is not a valid address;
			address 2044 is the broadcast address
	
	Op_1 Data_1
	01 0-255	NCE macro number 0-255
	02 0-255	Duplicate of Op_1 command
	03 0		Accessory Normal direction (ON)
	04 0		Accessory Reverse direction (OFF)
	05 0-1f		Signal Aspect 0-31
	05-7f reserved
	
	Returns: ! = success
	reserved 1 = bad accy address
 */

	this.issueCommand(new Buffer([0xad,((address >> 8) & 0xff),(address & 0x0ff),op,data]),1,callback);
};


module.exports = {
    NCE: NCE
};
