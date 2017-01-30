var EventEmitter = require('events').EventEmitter,
	util = require('util'),
	SerialPort = require('serialport');

var	NCEDCC = function(devicePath, callback) {
	var self = this;
	EventEmitter.call(self);

	self._useDirectMode = false;
	self._commandQueue = [];
	self._currentCommand = null;
	
	self.sp = new SerialPort(devicePath, {baudrate: 9600});
	self.sp.on('error', function(err) {
		callback(err);
	});
	
	self.sp.on('open', function() {

		self.sp.on('data', function (data) {
			self.emit('RECV',data);			// debugging

			if (self._currentCommand) {
				// Handle response coming back in multiple chunks
				self._currentCommand.responseBuffer = Buffer.concat([self._currentCommand.responseBuffer,data]);

				if (self._currentCommand.responseBuffer.length === self._currentCommand.expectedResponseLength) {
					self.emit('response',self._currentCommand.responseBuffer);
					
					if (typeof self._currentCommand.callback === 'function')	{
						self._currentCommand.callback(null,self._currentCommand.responseBuffer);
					}

					// switch to the next command in the queue
					self._commandQueue.shift();
					if (self._commandQueue[0] !== undefined) {
						self._execCommand(self._commandQueue[0]);
					}
				}
			}
		});
		
		// We're alive!
		callback(null);
		self.emit('ready');
	});

	self.on('command', function(newCommand) {
		self._commandQueue.push(newCommand);
		if (newCommand === self._commandQueue[0]) {
			self._execCommand(self._commandQueue[0]);
		}
	});
	
}
util.inherits(NCEDCC, EventEmitter);

// _execCommand should not be called by clients
NCEDCC.prototype._execCommand = function (newCommand) {
	this._currentCommand = newCommand;
	this.emit('SEND',newCommand.command);
	this.sp.write(newCommand.command);
}

NCEDCC.prototype._issueCommand = function (cmd,responseSize,callback) {
	var newCommand = {
		command:cmd,
		responseBuffer: Buffer.alloc(0),
		expectedResponseLength:responseSize,
		callback:callback
	};
	this.emit('command',newCommand);
}

NCEDCC.prototype._throttleCommand = function(address,op,data,callback) {
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

	this._issueCommand(Buffer.from([0xa2,((address >> 8) & 0xff),(address & 0x0ff),op,data]),1,callback);
};

NCEDCC.prototype._accessoryCommand = function(address,op,data,callback) {
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

	this._issueCommand(Buffer.from([0xad,((address >> 8) & 0xff),(address & 0x0ff),op,data]),1,callback);
};


// Command station methods

NCEDCC.prototype.getVersion = function(callback) {
	this._issueCommand(Buffer.from([0xaa]),3,callback)
};

NCEDCC.prototype.getOptions = function(callback) {
	// return capabilities of the command station
	callback({'hasProgrammingTrack':true, 'supportsDirectMode':true});
}

NCEDCC.prototype.enterProgramTrackMode = function(useDirectMode, callback) {
	this._useDirectMode = useDirectMode;
	this._issueCommand(Buffer.from([0x9e]),1,callback);
};

NCEDCC.prototype.exitProgramTrackMode = function(callback) {
	this._issueCommand(Buffer.from([0x9f]),1,callback);
};

NCEDCC.prototype.writeCV = function(cv,value,callback) {
	// paged 0xa0; direct 0xa8
	this._issueCommand(Buffer.from([(this._useDirectMode ? 0xa8 : 0xa0),((cv >> 8) & 0xff),(cv & 0x0ff),value]),1,callback);
};

NCEDCC.prototype.readCV = function(cv,callback) {
	// paged 0xa1; direct 0xa9
	this._issueCommand(Buffer.from([(this._useDirectMode ? 0xa9 : 0xa1),((cv >> 8) & 0xff),(cv & 0x0ff)]),2,callback);
};

NCEDCC.prototype.setTurnout = function(address, state, callback) {
	this._accessoryCommand(address, state ? 0x3 : 0x4, callback);
}

NCEDCC.prototype.setSpeedAndDirection = function(locoAddress, speed, direction, callback) {
	this._throttleCommand(locoAddress, direction ? 0x03 : 0x04, speed, callback);
}

module.exports = {
    NCEDCC: NCEDCC
};
