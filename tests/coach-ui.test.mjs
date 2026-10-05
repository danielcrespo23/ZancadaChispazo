import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {chatReply} from '../lib/coach-chat.mjs';
import {coachFixture} from './helpers/coach-fixture.mjs';
const require=createRequire(new URL('../app/coach-chat.tsx',import.meta.url)),loaded={exports:{}};
new Function('require','module','exports',ts.transpileModule(readFileSync(new URL('../app/coach-chat.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(require,loaded,loaded.exports);
const Chat=loaded.exports.default,render=(state,messages,scopeKey='ana:real',dirty=false)=>renderToStaticMarkup(React.createElement(Chat,{state,messages,scopeKey,dirty,revision:1,demo:true,busy:false,question:'',onSave:async()=>true,onMessages:()=>{},onQuestion:()=>{}}));
test('chat shows all seven useful examples and hides another account or demo conversation',async()=>{
 const state=coachFixture(),r=await chatReply(state,{question:'Estoy cansado; reduce mi próxima sesión',mode:'rules'}),html=render(state,[{...r,q:'ANA QUESTION',scopeKey:'ana:real'},{...r,q:'PRIVATE OTHER USER',scopeKey:'luis:real'},{...r,q:'DEMO OTHER',scopeKey:'ana:demo'}]);assert.match(html,/ANA QUESTION/);assert(!html.includes('PRIVATE OTHER USER'));assert(!html.includes('DEMO OTHER'));for(const text of ['hoy tengo este entrenamiento','Ayer hice CrossFit','No tengo dolor','tirada al viernes','parte de los intervalos','todavía no ha cambiado','referencia necesitas'])assert(html.includes(text));
});
test('stale or dirty replies keep the explanation visible and disable saving a draft',async()=>{
 const state=coachFixture(),r=await chatReply(state,{question:'Estoy cansado; reduce mi próxima sesión',mode:'rules'});assert(r.proposal);const messages=[{...r,q:'QUESTION',scopeKey:'ana:real'}],fresh=render(state,messages);assert.match(fresh,/<button>Guardar propuesta para revisar/);
 const changed={...state,activities:[{id:'new',date:r.date,distance:5,seconds:1800}]},stale=render(changed,messages);assert.match(stale,/Respuesta anterior: tus datos han cambiado/);assert.match(stale,/<button disabled="">Guardar propuesta para revisar/);assert.match(render(state,messages,'ana:real',true),/<button disabled="">Guardar propuesta para revisar/);assert.match(fresh,/sin aplicar/);assert.match(fresh,/al aceptar se vuelven a comprobar/);
});
