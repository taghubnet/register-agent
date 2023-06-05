import minimist from 'minimist'
import {
  log,
  cloud_detector,
  join_docker_swarm,
  register_with_agent,
  find_zerotier_address,
  load_certificates_maybe,
  find_not_zerotier_address
} from './utils.js'

const args = minimist(process.argv.slice(2), {
  default: {
    type: 'worker',
    retries: 5,
    secretpath: '/run/secrets',
    docker_port: '4243',
    docker_host: '127.0.0.1',
    detectInterval: 10000,
    register_api_host: '127.0.0.1',
    register_api_port: '3210',
    swarm_listen_address: '2377',
    use_zt_network: false
  }
})
console.log(args)

const state = {
  tls: false,
  cert: {
    tlsCert: "",
    tlsKey: "",
    tlsCA: ""
  }
}
let retries = 0

load_certificates_maybe(args, state)

async function detectAndUpdate() {
  log('Finding ZT interface')
  let address = find_zerotier_address(args)
  log(`Found ZT interface: ${address}`)

  log('Detecting cloud environment...')
  let cloud = { cloud: 'unknown', zone: 'unknown', labels: {} }
  try { cloud = await cloud_detector() } catch(e) { console.error('ERROR: Unable to detect cloud environment, using default') }
  log(`Found cloud environment: ${cloud?.cloud}`)

  log('Registering with agent')
  
  const agent_response = await register_with_agent(args, cloud, address)
  log('Successfully registered with agent.')

  log('Joining swarm')
  if (args.use_zt_network) {
    await join_docker_swarm(args, state, address, agent_response?.token)
  }  
  else {
    await join_docker_swarm(args, state, find_not_zerotier_address(), agent_response?.token) 
  }
  
  log('Swarm joined. Exiting...')
  process.exit(0)
}

process.on('uncaughtException', log)

async function loop() {
  try {
    await detectAndUpdate()
  } catch(e) {
    console.error(e)
    retries++
    if (retries >= args.retries) process.exit(1)
    setTimeout(loop, args?.detectInterval)
  }
}

loop()
