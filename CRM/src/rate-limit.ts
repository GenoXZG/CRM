import { createHmac, randomBytes } from 'node:crypto';
import { isIP, SocketAddress } from 'node:net';
import { performance } from 'node:perf_hooks';

interface Counter {
  attempts: number;
  expires: number;
}

const shardCount = 32;
const counterKey = randomBytes(32);

export function clientNetwork(address: string | undefined): string {
  if (!address) return 'unknown';
  if (isIP(address) === 4) return address;
  if (isIP(address) !== 6) return 'unknown';
  const canonical = new SocketAddress({ address, family: 'ipv6' }).address;
  if (canonical.startsWith('::ffff:')) return canonical.slice(7);
  const [left, right] = canonical.split('::');
  const leading = left ? left.split(':') : [];
  const trailing = right ? right.split(':') : [];
  const groups = right === undefined ? leading : [
    ...leading, ...Array<string>(8 - leading.length - trailing.length).fill('0'), ...trailing,
  ];
  return groups.slice(0, 4).join(':') + '::/64';
}

export class RateLimit {
  private readonly shards = Array.from({ length: shardCount }, () => new Map<string, Counter>());
  private nextCleanup = 0;

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
    private readonly shardCapacity = 128,
    private readonly clock = () => performance.now(),
  ) {}

  private entry(key: string) {
    const digest = createHmac('sha256', counterKey).update(key).digest();
    return { shard: this.shards[digest[0]! % shardCount]!, id: digest.toString('hex') };
  }

  private expire(shard: Map<string, Counter>, now: number) {
    // Fixed windows expire in insertion order.
    for (const [id, counter] of shard) {
      if (counter.expires > now) break;
      shard.delete(id);
    }
  }

  consume(key: string): number {
    const now = this.clock();
    if (now >= this.nextCleanup) {
      for (const shard of this.shards) this.expire(shard, now);
      this.nextCleanup = now + Math.min(60000, this.windowMs);
    }
    const { shard, id } = this.entry(key);
    this.expire(shard, now);
    const counter = shard.get(id);
    if (counter) {
      if (counter.attempts >= this.maxAttempts) return Math.ceil((counter.expires - now) / 1000);
      counter.attempts++;
    } else {
      if (shard.size >= this.shardCapacity) {
        const oldest = shard.values().next().value as Counter;
        return Math.ceil((oldest.expires - now) / 1000);
      }
      shard.set(id, { attempts: 1, expires: now + this.windowMs });
    }
    return 0;
  }

  reset(key: string) {
    const { shard, id } = this.entry(key);
    shard.delete(id);
  }
}

const quarterHour = 15 * 60 * 1000;
export const authLimits = {
  loginIp: new RateLimit(10, quarterHour),
  loginAccountIp: new RateLimit(5, quarterHour),
  recoveryIp: new RateLimit(5, quarterHour),
  recoveryAccountIp: new RateLimit(3, quarterHour),
  resetIp: new RateLimit(20, quarterHour),
};

export function accountAtNetwork(network: string, email: string) {
  // The network and normalized address are never retained by the limiter.
  return network + '\n' + email;
}
