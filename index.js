var args = require('minimist')(process.argv.slice(2), {
  default: {
    detectImmediately: true,
    detectInterval: 10000,
    register_api_host: '172.0.0.1',
    register_api_port: '3210',
    docker_host: '127.0.0.1',
    docker_port: '4243',
    type: 'worker'
  }
})
var log = require('debug-log')('register-agent')
var detector = require('cloud-detector')
var hostname = require('os').hostname()

function detectAndUpdate() {
  log('Detecting...')
  detector(function(err, cloud) {
    if (err) return log(err)
    if (cloud === 'unknown') return log('Unable to detect cloud')
    let labels = Object.assign
    request({
      url: `http://${args.register_api_host}:${args.register_api_port}/`,
      method: 'POST',
      json: Object.assign(
        {
          hostname: hostname,
          type: type
        }, 
        {
          labels: {
            cloud: cloud.cloud,
            zone: cloud.zone,
            ...cloud.labels
          }
        }
      )
    }, (err, req, payload) => {
      if (err) return log(err)
      console.log(payload)      
    }) 
  })
}

process.on('uncaughtException', log)

if (args.detectImmediately) detectAndUpdate()
setInterval(detectAndUpdate, args.detectInterval)
