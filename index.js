var args = require('minimist')(process.argv.slice(2), {
  default: {
    detectImmediately: false,
    detectInterval: 10000,
    register_api_host: '127.0.0.1',
    register_api_port: '3210',
    docker_host: '127.0.0.1',
    docker_port: '4243',
    retries: 5,
    type: 'worker',
    secretpath: '/run/secrets'
  }
})
var os = require('os')
var detector = require('cloud-detector')
var request = require('request')
var get = require('get-value')
var hostname = require('os').hostname()
var retries = 0
const fs = require('fs')
const path = require('path')

const secretpath = args.secretpath

const log = (e) => {
  if (typeof e === "object") {
    console.log("register-agent", e)
  }
  else {
    console.log("register-agent: " + e)
  }
} 

let state = {
  cert: {
    tlsCert: "",
    tlsKey: "",
    tlsCA: ""
  }
}

function sleep(ms) {
    var start = new Date().getTime(), expire = start + ms;
    while (new Date().getTime() < expire) { }
    return;
}

if (fs.existsSync(secretpath)) {
  let secrets = (fs.readdirSync(secretpath))
  let trials = 0
  while (secrets.length < 3 && trials < 6) {
    log("Secret folder is present, but empty, retrying in 10 secounds.")
    trials += 1
    sleep(10000)
    secrets = fs.readdirSync(secretpath)
  }
  try {
    state.cert.tlsCert = path.join(secretpath, secrets.find(e => e.match("client-cert.pem")))
    state.cert.tlsKey = path.join(secretpath, secrets.find(e => e.match("client-key.pem")))
    state.cert.tlsCA = path.join(secretpath, secrets.find(e => e.match("ca.pem")))
  } catch(err) {
    console.log(err)
  }
  log("Running in TLS mode")
}
else {
  log("Running without TLS")
}

function detectAndUpdate() {

  log('Finding ZT interface')
  var zt_interfaces = Object.keys(os.networkInterfaces()).filter(i => i.indexOf('zt') === 0)
  var interface = args.interface || zt_interfaces.length > 0 ? zt_interfaces[0] : null

  if (!interface) {
    retries++
    if (retries < args.retries) return log('No ZT interface found')
    process.exit(1)
  }
  var address = ''
  for (const name of Object.keys(os.networkInterfaces())) {
    for (const net of os.networkInterfaces()[name]) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (net.family === 'IPv4' && !net.internal) {
            if (name === interface) {
              address = net.address
            }
        }
    }
  }
  log(`ZTIP: ${address}`)

  log('Detecting...')
  detector(function(err, cloud) {
    if (err) {
      retries++
      if (retries < args.retries) return log(err)
      cloud = { cloud: 'unknown', zone: 'unknown', labels: {} }
    }
    log(cloud)
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
    //log(payload)
    request({
      url: `http://${args.register_api_host}:${args.register_api_port}/`,
      method: 'POST',
      json: payload
    }, (err, res, rpayload) => {
      if (err) {
        log("Failed to contact the register-api")
        log(err.message)
        return log(err)
      }
      if (res.statusCode != 200) return log(res.message)
      log('REQ: Get token payload')   
      log(rpayload)
      let req = state.cert.tlsCert ? {
        url: `https://${args.docker_host}:${args.docker_port}/swarm/join`,
        method: 'POST',
        json: {
          ListenAddr: `${address}:2377`,
          AdvertiseAddr: `${address}:2377`,
          RemoteAddrs: [`${args.register_api_host}:2377`],
          JoinToken: rpayload.token,
        },
        cert: state.cert.tlsCert ? fs.readFileSync(state.cert.tlsCert) : '',
        key: state.cert.tlsKey ? fs.readFileSync(state.cert.tlsKey) : '',
        ca: state.cert.tlsCA ? fs.readFileSync(state.cert.tlsCA) : ''
      }: {
        url: `http://${args.docker_host}:${args.docker_port}/swarm/join`,
        method: 'POST',
        json: {
          ListenAddr: `${address}:2377`,
          AdvertiseAddr: `${address}:2377`,
          RemoteAddrs: [`${args.register_api_host}:2377`],
          JoinToken: rpayload.token
        }
      }
      request(req, (err, res, rrpayload) => {
        if (err) {
          log("Failed to communicate with the DOCKER API")
          log(err.message)
          return log(err)
        }
        let r = new RegExp("This node is already part of a swarm")
        if (res.statusCode != 200 && !r.test(rrpayload.message)) {
          log(rrpayload) 
          log(res.message)
          log("Not success, retrying...")
        }
        else {
          log('Swarm joined, exiting...')
          process.exit(0)
        }
      })
    }) 
  })
}

process.on('uncaughtException', log)

if (args.detectImmediately) detectAndUpdate()
setInterval(detectAndUpdate, args.detectInterval)
