var args = require('minimist')(process.argv.slice(2), {
  default: {
    detectImmediately: true,
    detectInterval: 10000,
    register_api: '172.0.0.1:3210',
  }
})
var log = require('debug-log')('register-agent')
var detector = require('cloud-detector')

function detectAndUpdate() {
  detector((err, cloud, meta) => {
    //if (err) return log(err)
    log(cloud, meta)
  })
}

if (args.detectImmediately) detectAndUpdate()
setInterval(detectAndUpdate, args.detectInterval)
