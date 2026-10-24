const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function mongoHosts(uri) {
  const match = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/.exec(uri || '');
  if (!match) return [];
  return match[1].split(',').map(host => host.replace(/:\d+$/, ''));
}

function assertDevSeedAllowed({ nodeEnv, mongoUri, argv }) {
  if (nodeEnv !== 'development') {
    throw new Error('The development seeder only runs with NODE_ENV=development');
  }
  const hosts = mongoHosts(mongoUri);
  if (hosts.length === 0 || !hosts.every(host => LOOPBACK_HOSTS.has(host))) {
    throw new Error('The development seeder only runs against a local MongoDB host');
  }
  if (argv.includes('--fresh') && !argv.includes('--confirm-reset')) {
    throw new Error('--fresh deletes existing data; add --confirm-reset to proceed');
  }
}

module.exports = { assertDevSeedAllowed, mongoHosts, LOOPBACK_HOSTS };
