import {env} from 'cloudflare:workers';
import {storage} from '../db/state';
import {StravaService} from './strava-service.mjs';
import {LocalStravaService} from './strava-local.mjs';
import {localRedirect} from './strava-diagnostics.mjs';
export function stravaService(request?:Request){
 const redirect=(env as any).STRAVA_REDIRECT_URI;
 let loopback=false;
 try{loopback=['localhost','127.0.0.1','[::1]'].includes(new URL(redirect).hostname);}catch{}
 const Service=import.meta.env.DEV&&loopback?LocalStravaService:StravaService;
 const config={...env as any};
 if(Service===LocalStravaService&&request)config.STRAVA_REDIRECT_URI=localRedirect(request,redirect);
 return new Service(storage(),config);
}
