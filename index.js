var args = require('minimist')(process.argv.slice(2), {
  default: {
    detectImmediately: false,
    detectInterval: 10000,
    register_api_host: '127.0.0.1',
    register_api_port: '3210',
    docker_host: '127.0.0.1',
    docker_port: '4243',
    retries: '2',
    type: 'worker'
  }
})
var os = require('os')
var log = require('debug-log')('register-agent')
var detector = require('cloud-detector')
var request = require('request')
var get = require('get-value')
var hostname = require('os').hostname()
var retries = 0

function detectAndUpdate() {
  log('Finding ZT interface')
  log(os.getNetworkInterfaces())
  var zt_interfaces = Object.keys(os.getNetworkInterfaces()).filter(i => i.indexOf('zt') === 0)
  var interface = args.interface || zt_interfaces.length > 0 ? zt_interfaces[0] : null
  if (!interface) {
    log('No ZT interface found')
    process.exit(1)
  }
  log('Detecting...')
  detector(function(err, cloud) {
    if (err) {
      retries++
      if (retries < args.retries) return log(err)
      cloud = { cloud: 'unknown', zone: 'unknown', labels: {} }
    }
    log('cloud', cloud)
    let payload = Object.assign(
      {
        hostname: hostname,
        type: get(cloud, 'labels.swarmtype') || args.type
      }, 
      {
        labels: Object.assign({
          cloud: cloud.cloud,
          zone: cloud.zone,
        }, cloud.labels)
      }
    )
    log('payload', payload)
    request({
      url: `http://${args.register_api_host}:${args.register_api_port}/`,
      method: 'POST',
      json: payload
    }, (err, res, rpayload) => {
      if (err) return log(err)
      if (res.statusCode != 200) return log(req.statusCode, req.message)
      log('REQ: Get token payload', rpayload)   
      request({
        url: `http://${args.docker_host}:${args.docker_port}/swarm/join`,
        method: 'POST',
        json: {
          ListenAddr: `${interface}:2377`,
          AdvertiseAddr: `${interface}:2377`,
          RemoteAddrs: [`${args.register_api_host}:2377`],
          JoinToken: rpayload.token
        }
      }, (err, res, rrpayload) => {
        if (err) return log(err)
        if (res.statusCode != 200) log(res.statusCode, rrpayload)
        log('Swarm joined, exiting...')
        process.exit(0)
      })
    }) 
  })
}

process.on('uncaughtException', log)

if (args.detectImmediately) detectAndUpdate()
setInterval(detectAndUpdate, args.detectInterval)
