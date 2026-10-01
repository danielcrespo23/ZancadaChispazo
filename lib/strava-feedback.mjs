export const oauthMessages={connected:'Autorización completada. Se han consultado automáticamente las carreras de los últimos 7 días.',sync_failed:'Tu cuenta se ha vinculado, pero la primera consulta falló. Revisa el error y pulsa Sincronizar ahora.',authorization_denied:'Has cancelado la autorización en Strava.',login_required:'El retorno de Strava no encontró tu sesión local. Inicia sesión en esta dirección y vuelve a conectar.',invalid_oauth_state:'El retorno de Strava perdió la cookie de autorización o la solicitud caducó. Vuelve a conectar desde esta misma dirección.',authorization_expired:'Strava rechazó la autorización. Vuelve a conectar; el código de autorización solo se puede usar una vez.',insufficient_permissions:'No se concedió permiso para leer tus carreras. Vuelve a conectar y acepta los permisos de actividades.',rate_limited:'Strava ha limitado temporalmente las consultas. Espera antes de sincronizar.',connection_error:'No se pudo completar la conexión con Strava. Comprueba que el servidor del PC tenga acceso a Internet y vuelve a conectar.'};
export function stravaView(data,busy=false){
 if(!data)return 'loading';
 if(busy&&data.account)return 'syncing';
 if(data.error||['authorization_expired','insufficient_permissions','rate_limited','connection_error','unavailable'].includes(data.state))return 'error';
 if(!data.account)return 'disconnected';
 if(busy||data.pending>0||data.state==='syncing')return 'syncing';
 if(data.activities?.length)return 'ready';
 if(data.syncCompleted||data.lastSync)return 'empty';
 return 'syncing';
}
