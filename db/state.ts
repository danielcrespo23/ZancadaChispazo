import { env } from 'cloudflare:workers';
export function storage(){if(!env.DB)throw Error('Database unavailable');return env.DB;}
