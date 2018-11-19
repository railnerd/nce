var NCEDCC = require('./index').NCEDCC
var hexy = require('hexy')

var cmdStation = new NCEDCC('/dev/cu.SLAB_USBtoUART', function (err) {
  if (err) {
    console.error('Failed to initialize: ' + err)
    process.exit(1)
  }
})

// debugging hooks to examine command station traffic

function hexDump (buf) {
  var dumpString = hexy.hexy(buf, { numbering: 'none', format: 'twos', annotate: 'none' })
  return dumpString.substring(0, dumpString.length - 2)
}

cmdStation.on('RECV', function (data) {
  console.log('RECV : ' + hexDump(data))
})

cmdStation.on('response', function (data) {
  console.log('RESPONSE : ' + hexDump(data))
})

cmdStation.on('SEND', function (data) {
  console.log('SEND : ' + hexDump(data))
})

cmdStation.on('ready', function () {
  cmdStation.getVersion(function (_err, vers) {
      console.log('version response: ' + hexDump(vers))
  })

  console.log('FL (headlight) on')
  cmdStation._throttleCommand(0xc076, 7, (1 << 4))

  // Forward @ 64
  console.log('Forward @ 64')
  cmdStation.setSpeedAndDirection(0xc076, 64, true, function (_err, _data) {
    // Stop after 5 seconds
    setTimeout(function (_err) {
      console.log('Stop')
      cmdStation.setSpeedAndDirection(0xc076, 0, true)
      console.log('FL (headlight) off')
      cmdStation._throttleCommand(0xc076, 7, 0)
    }, 5000)
  })

  // Set DCC Signal 1 Flashing Green
  console.log('Flashing Green')
  cmdStation.setSignal(1, 5, function (_err) {
    setTimeout(function (_err) {
      console.log('Dark')
      cmdStation.setSignal(1, 31) //  // Set DCC Signal 1 to Dark after 10 seconds
    }, 5000)
  })
})
