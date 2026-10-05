const messages={401:'Tu sesión ha caducado. Inicia sesión de nuevo; conserva una copia de los cambios pendientes.',403:'El servidor no permite esta solicitud. Abre Zancada desde su dirección habitual y reintenta.',409:'Tus datos han cambiado en otra pestaña. Exporta los cambios pendientes antes de recargar.',429:'El servidor ha limitado las solicitudes. Espera un momento y reintenta.'};
export function friendlyError(error){
 if(error instanceof TypeError||/fetch|network|failed to load/i.test(error?.message||''))return 'No se pudo contactar con el servidor. Comprueba tu conexión y reintenta; los cambios pendientes siguen en pantalla.';
 if(error instanceof SyntaxError)return 'La respuesta del servidor no se pudo leer. Reintenta; los cambios pendientes siguen en pantalla.';
 return error?.message||'No se pudo completar la acción. Reintenta; tus cambios pendientes siguen en pantalla.';
}
export async function stateResponse(response){
 let data;try{data=await response.json();}catch{throw Error(response.ok?'El servidor devolvió una respuesta incompleta. Reintenta sin cerrar los cambios pendientes.':messages[response.status]||'El servidor no pudo completar la acción. Reintenta; los cambios pendientes siguen en pantalla.');}
 if(!response.ok){if(data?.code==='stale_plan_preview'){const error=Error(data.error||'Tus datos han cambiado. Vuelve a calcular la propuesta.');error.code='stale_plan_preview';throw error;}throw Error(messages[response.status]||(response.status>=500?'El servidor no pudo completar la acción. Reintenta; los cambios pendientes siguen en pantalla.':data.error||'Revisa los datos y reintenta.'));}
 if(!data||!Number.isSafeInteger(data.revision)||data.revision<0)throw Error('El servidor no confirmó el guardado o la lectura. Reintenta; conserva los cambios pendientes.');
 return data;
}
