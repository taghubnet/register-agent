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
var request = require('request')
var hostname = require('os').hostname()

function detectAndUpdate() {
  log('Detecting...')
  detector(function(err, cloud) {
    if (err) return log(err)
    if (cloud === 'unknown') return log('Unable to detect cloud')
    let payload = Object.assign(
      {
        hostname: hostname,
        type: args.type
      }, 
      {
        labels: {
          cloud: cloud.cloud,
          zone: cloud.zone,
          ...cloud.labels
        }
      }
    )
    console.log(payload)
    request({
      url: `http://${args.register_api_host}:${args.register_api_port}/`,
      method: 'POST',
      json: payload
    }, (err, req, rpayload) => {
      if (err) return log(err)
      console.log(rpayload)      
    }) 
  })
}

process.on('uncaughtException', log)

if (args.detectImmediately) detectAndUpdate()
setInterval(detectAndUpdate, args.detectInterval)
