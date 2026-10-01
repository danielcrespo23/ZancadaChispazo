import {env} from 'cloudflare:workers';
import {storage} from '../db/state';
import {StravaService} from './strava-service.mjs';
export function stravaService(){return new StravaService(storage(),env as any);}
