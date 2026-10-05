import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import ts from 'typescript';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {blankProfile,empty,generate,today,addDays,session} from '../lib/engine.mjs';
import {buildPlanPreview} from '../lib/training.mjs';
const baseRequire=createRequire(import.meta.url);
function load(relative){const source=fs.readFileSync(new URL(relative,import.meta.url),'utf8'),code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,loaded={exports:{}};new Function('require','module','exports',code)(specifier=>specifier.startsWith('../lib/')?baseRequire(fileURLToPath(new URL('../lib/'+specifier.slice(7),import.meta.url))):baseRequire(specifier),loaded,loaded.exports);return loaded.exports;}
const hub=load('../app/training-hub.tsx'),guide=load('../app/session-guide.tsx').default;
const raceCoach=load('../app/race-coach.tsx').default;
const profile={...blankProfile(),experience:'regular',weeklyKm:24,longest:8,easyPace:'6:30',days:[2,4,0],longDay:0,minutes:{2:60,4:60,0:90},goal:{type:'race',distance:10,date:addDays(today(),80),time:'55:00'}},state={...empty(),profile,plan:generate(profile)},props={state,busy:false,save:async()=>true};
test('race dashboard renders upcoming preparation and handles an empty profile',()=>{
 const html=renderToStaticMarkup(React.createElement(raceCoach,{state,onReview:()=>{},onSession:()=>{}}));
 assert(html.includes('80 días'));assert(html.includes('próximas ocho semanas'));assert(!html.includes('NaN'));
 assert.equal(renderToStaticMarkup(React.createElement(raceCoach,{state:empty(),onReview:()=>{},onSession:()=>{}})),'');
});
test('plan, race strategy and statistics render the accepted goal and expose the changed goal as pending',()=>{
 const edited={...state,profile:{...profile,goal:{...profile.goal,date:addDays(today(),7),distance:21.1}}};
 const html=renderToStaticMarkup(React.createElement(raceCoach,{state:edited,onReview:()=>{},onSession:()=>{}}));
 assert(html.includes('80 días'));assert(html.includes('Nuevo objetivo pendiente: 21.1 km'));
 const strategy=renderToStaticMarkup(React.createElement(hub.RaceStrategy,{state:edited}));
 assert(strategy.includes('0–2 km'));assert(strategy.includes('Nuevo objetivo pendiente: 21.1 km'));
 const history=renderToStaticMarkup(React.createElement(hub.HistoryInsights,{...props,state:edited}));
 assert(history.includes('Meta del calendario vigente: 10 km'));assert(history.includes('Nuevo objetivo pendiente: 21.1 km'));
 edited.profile.goal={type:'routine'};assert(renderToStaticMarkup(React.createElement(hub.RaceStrategy,{state:edited})).includes('Preparar el día de la carrera'));
});
test('revision comparison renders both phase and volume, key sessions, and the reason for limiting incomplete history',()=>{
 const p={...profile,goal:{...profile.goal,distance:21.1,date:'2027-01-25'}},state={...empty(),profile:p,plan:generate(p,'2026-10-05')},preview=buildPlanPreview(state,{},'2026-11-09');
 const html=renderToStaticMarkup(React.createElement(hub.PlanRevisionComparison,{preview}));
 assert(html.includes('Comparar fases, volumen y sesiones clave'));assert(html.includes('Fases: actual → propuesta'));assert(html.includes('Desarrollo → Desarrollo'));assert(html.includes('Carrera larga'));
 assert(html.includes('Historial sin confirmar'));assert(html.includes('actual → propuesta'));assert(!html.includes('NaN'));
});
test('new training surfaces render real empty and populated states without browser-only crashes',()=>{for(const [name,extra,text] of [['CheckIn',{},'¿Cómo estás hoy?'],['PlanStudio',{request:0,onConsumed:()=>{}},'Revisar mi preparación'],['PlanOverview',{date:today()},'Exportar calendario'],['HistoryInsights',{},'Tu base reciente'],['RaceStrategy',{},'Preparar el día de la carrera']]){const html=renderToStaticMarkup(React.createElement(hub[name],{...props,...extra}));assert(html.includes(text),`${name} should render a usable surface`);assert(!html.includes('NaN'));}assert.equal(renderToStaticMarkup(React.createElement(hub.PlanOverview,{...props,state:empty(),date:today()})),'');assert.equal(renderToStaticMarkup(React.createElement(hub.PlanStudio,{...props,state:empty(),request:0,onConsumed:()=>{}})),'');});
test('session guide and strength recording remain distinct from GPS and fabricated running logs',()=>{const s=session(profile,'strength',today(),0,25,0),own={...state,plan:{...state.plan,sessions:[...state.plan.sessions,s]}};assert(renderToStaticMarkup(React.createElement(guide,{s,onRegister:()=>{}})).includes('Seguir sesión por bloques'));const html=renderToStaticMarkup(React.createElement(hub.StrengthCompletion,{...props,state:own,s}));assert(html.includes('Minutos realizados'));assert(html.includes('No suma kilómetros'));assert(html.includes('Marcar fuerza como realizada'));});
test('calibration shows separate estimates, observations and goals, explains contradictions and proposes a level-appropriate reference',()=>{
 const mark={date:addDays(today(),-14),distance:5,time:'25:00',elapsedTime:'25:00',measurement:'measured',effort:'race',context:'competition',terrain:'asphalt',elevation:0,temperature:16,conditions:'normal'};
 const edited={...state,profile:{...profile,experience:'beginner',marks:[{...mark,id:'first'},{...mark,id:'second',date:addDays(today(),-7),time:'20:00',elapsedTime:'20:00'}]}};
 const html=renderToStaticMarkup(React.createElement(hub.CalibrationPanel,{state:edited,onReview:()=>{}}));
 for(const text of ['Capacidad de competición estimada','Ritmo cómodo observado','Ritmo objetivo de competición','referencias contradictorias','no se propone una prueba máxima','Revisar ritmos con mis registros','Por qué se utiliza'])assert(html.includes(text),text);
 assert(!html.includes('NaN'));assert.equal(renderToStaticMarkup(React.createElement(hub.CalibrationPanel,{state:empty()})),'');
});
