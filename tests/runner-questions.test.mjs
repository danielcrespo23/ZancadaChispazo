import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import ts from 'typescript';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {blankProfile,empty,generate,addDays,today} from '../lib/engine.mjs';
const baseRequire=createRequire(import.meta.url),cache={},root=fileURLToPath(new URL('..',import.meta.url));
function load(file){if(cache[file])return cache[file].exports;const module={exports:{}},code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;cache[file]=module;new Function('require','module','exports',code)(specifier=>{if(!specifier.startsWith('.'))return baseRequire(specifier);const target=path.resolve(path.dirname(file),specifier);return target.endsWith('.mjs')?baseRequire(target):load(target+'.tsx');},module,module.exports);return module.exports;}
const questions=load(path.join(root,'app/runner-questions.tsx')),Review=load(path.join(root,'app/continuity-review.tsx')).default;
const render=(component,props)=>renderToStaticMarkup(React.createElement(component,props));
test('race questions are conditional and unknown answers explain pace limits',()=>{
 const profile=blankProfile(),props={profile,onChange:()=>{}};assert.equal(render(questions.RaceQuestions,props),'');
 const html=render(questions.RaceQuestions,{...props,profile:{...profile,goal:{type:'race',date:addDays(today(),49)}}});assert.match(html,/Terminar con control/);assert.match(html,/Mejorar mi marca/);assert.match(html,/Correr sin parar/);assert.match(html,/Flexibilidad/);assert.doesNotMatch(html,/Tiempo deseado/);const improving=render(questions.RaceQuestions,{...props,profile:{...profile,goal:{type:'race',intent:'improve'}}});assert.match(improving,/Tiempo deseado/);assert.match(improving,/tiempo concreto/);assert.match(html,/No lo sé/);assert.match(html,/Desnivel/);
});
test('returning runner skips irrelevant consecutive-week input and references ask effort and pause context',()=>{
 const html=render(questions.BaseQuestions,{profile:{...blankProfile(),consistency:'returning'},onChange:()=>{}});assert.doesNotMatch(html,/Semanas consecutivas con esta rutina/);assert.match(html,/No lo sé/);
 const mark=render(questions.MarkQuestions,{mark:{effort:'unknown'},onChange:()=>{}});assert.match(mark,/Rodaje suave/);assert.match(mark,/Tiempo total con pausas/);assert.match(mark,/pendiente de confirmar/);
});
test('sports and care are editable structured inputs and do not imply automatic Strava analysis',()=>{
 const profile={...blankProfile(),otherSports:[{id:'sport',type:'crossfit',day:2,minutes:45,intensity:'hard'}]},props={profile,onChange:()=>{}};
 assert.match(render(questions.SportQuestions,props),/CrossFit/);assert.match(render(questions.CareQuestions,props),/lesión reciente/);
 assert.match(render(questions.OwnHistoryConfirmation,{...props,state:empty()}),/condiciones actuales impiden/);
});
test('continuity review presents unregistered sessions as unconfirmed, with an explicit action',()=>{
 const profile={...blankProfile(),weeklyKm:12,longest:4,easyPace:'7:00',goal:{type:'race',distance:5,date:addDays(today(),49)}},state={...empty(),profile,plan:generate(profile,addDays(today(),-14))};
 const html=render(Review,{state,save:async()=>true,busy:false,onReview:()=>{}});assert.match(html,/no demuestra/);assert.match(html,/confirmadas como omitidas/);assert.match(html,/Confirma|Confirmar omisiones/);assert.doesNotMatch(html,/NaN|undefined/);
});
test('follow-up questions depend on relevant answers and summary exposes unknowns and edit controls',()=>{
 const profile=blankProfile(),base=render(questions.BaseQuestions,{profile,onChange:()=>{}});assert.doesNotMatch(base,/¿Cómo resultó esa tirada|Origen del ritmo cómodo|Origen de los kilómetros semanales/);
 const expanded=render(questions.BaseQuestions,{profile:{...profile,weeklyKm:20,longest:8,easyPace:'6:30'},onChange:()=>{}});assert.match(expanded,/Variación entre las últimas semanas/);assert.match(expanded,/¿Cómo resultó esa tirada/);assert.match(expanded,/¿Puedes conversar/);
 const summary=render(questions.RunnerSummary,{profile,onEdit:()=>{}});assert.match(summary,/resumen editable/);assert.match(summary,/Información fiable/);assert.match(summary,/Información ausente/);assert.match(summary,/Editar objetivo/);assert.match(summary,/Kilómetros: No lo sé/);assert.doesNotMatch(summary,/undefined|NaN/);
 const restricted=render(questions.CareQuestions,{profile:{...profile,runningRestriction:'time-limit'},onChange:()=>{}});assert.match(restricted,/Máximo permitido por sesión/);assert.doesNotMatch(render(questions.CareQuestions,{profile,onChange:()=>{}}),/Máximo permitido por sesión/);
});
test('unknown official distance never renders fictitious zero-kilometre race segments',()=>{
 const profile={...blankProfile(),goal:{type:'race',intent:'finish',distance:'',date:addDays(today(),42)}};
 const RaceStrategy=load(path.join(root,'app/training-hub.tsx')).RaceStrategy,html=render(RaceStrategy,{state:{...empty(),profile,plan:generate(profile)}});assert.match(html,/distancia sin confirmar/);assert.doesNotMatch(html,/0–0 km|NaN|undefined/);
});
