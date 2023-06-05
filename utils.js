import os from 'os'
import fs from 'fs'
import path from 'path'
import https from 'https'
import fetch from 'node-fetch'
import detector from 'cloud-detector'

export function https_agent_maybe(tls, cert) {
  return tls ? 
  {
    agent: new https.Agent({
      ca: cert?.tlsCA, 
      key: cert?.tlsKey,
      cert: cert?.tlsCert
    })
  } : {}
}

export function log(e) {
  if (typeof e === "object") {
    console.log("register-agent", e)
  }
  else {
    console.log("register-agent: " + e)
  }
} 

export function sleep(ms) {
  var start = new Date().getTime(), expire = start + ms;
  while (new Date().getTime() < expire) { }
  return;
}

export function find_zerotier_address(args) {
  const network_interfaces = os.networkInterfaces()
  const zt_interfaces = Object.keys(network_interfaces).filter(i => i.indexOf('zt') === 0)
  const iface = args?.interface || zt_interfaces.length > 0 ? zt_interfaces[0] : null
  if (!iface) throw new Error('No zt interface found')
  const address = Object.keys(network_interfaces).reduce((addr,name) => {
    if (addr) return addr
    const nets = network_interfaces[name]
    const net = nets.reduce((__net, _net) => {
      if (_net.family === 'IPv4' && !_net.internal && name === iface) return _net
      return __net
    }, null) 
    return net?.address
  }, null)
  if (!address) throw new Error('Unable to parse address')
  return address
}

export function find_not_zerotier_address(args) {
  const network_interfaces = os.networkInterfaces()
  const zt_interfaces = Object.keys(network_interfaces).filter(i => i.indexOf('zt') !== 0)  
  const address = Object.keys(network_interfaces).reduce((addr,name) => {
    if (addr) return addr
    const nets = network_interfaces[name]
    const net = nets.reduce((__net, _net) => {
      if (_net.family === 'IPv4' && !_net.internal) return _net
      return __net
    }, null) 
    return net?.address
  }, null)
  if (!address) throw new Error('Unable to parse address')
  return address
}

export function cloud_detector() {
  return new Promise((resolve, reject) => {
    detector((err, cloud) => {
      if (err) reject(err)
      else resolve(cloud)
    })
  })
}

export function load_certificates_maybe(args, state) {
  const secretpath = args.secretpath
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
      state.cert.tlsCert = fs.readFileSync(path.join(secretpath, secrets.find(e => e.match("client-cert.pem")))).toString()
      state.cert.tlsKey = fs.readFileSync(path.join(secretpath, secrets.find(e => e.match("client-key.pem")))).toString()
      state.cert.tlsCA = fs.readFileSync(path.join(secretpath, secrets.find(e => e.match("ca.pem")))).toString()
      state.tls = true
    } catch(err) {
      console.log(err)
    }
    log("Running in TLS mode")
  }
  else {
    log("Running without TLS")
  }
}

export async function register_with_agent(args, cloud, zt_ip) {
  const agent_response = await fetch(`http://${args.register_api_host}:${args.register_api_port}/`, {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    body: JSON.stringify({
      hostname: os.hostname(),
      type: cloud?.labels?.swarmtype || args?.type,
      labels: Object.assign({
        zone: cloud?.zone,
        cloud: cloud?.cloud,
        zt: zt_ip
      }, cloud?.labels)
    }),
  })
  if (!agent_response.ok) {
    const agent_response_text = await agent_response.text()
    throw new Error('Unable to register with agent: '+agent_response_text)
  }
  const agent_response_payload = agent_response.json()
  return agent_response_payload
}

export async function join_docker_swarm(args, state, address, join_token) {
  const swarm_response = await fetch(`${state.tls ? 'https' : 'http'}://${args.docker_host}:${args.docker_port}/swarm/join`, {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    body: JSON.stringify({
      ListenAddr: `${address}:${args.swarm_listen_address}`,
      AdvertiseAddr: `${address}:${args.swarm_listen_address}`,
      RemoteAddrs: [`${args.register_api_host}:${args.swarm_listen_address}`],
      JoinToken: join_token,
    }),
    ...https_agent_maybe(state.tls, state.cert) 
  })
  if (!swarm_response.ok) {
    const swarm_response_text = await swarm_response.text()
    throw new Error('Unable to join swarm: '+swarm_response_text)
  }
}
