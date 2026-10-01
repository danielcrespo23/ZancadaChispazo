'use client';
import React from 'react';
export const terrainOptions=[['asphalt','Asfalto'],['trail','Caminos'],['treadmill','Cinta']];
export const painOptions=[['none','Sin molestias'],['mild','Leves'],['relevant','Relevantes / afectan la zancada']];
export const goalOptions=[['start','Empezar a correr','Construir el hábito desde cero'],['nonstop','Correr sin parar','Completar una distancia'],['time','Mejorar mi marca','5 km, 10 km, media o maratón'],['race','Preparar una carrera','Una fecha en el calendario'],['routine','Resistencia y rutina','Correr de forma constante']];
export function Field({label,value,onChange,hint,...props}:any){return <label className="field">{label}<input {...props} value={value??''} onChange={e=>onChange(e.target.value)}/>{hint&&<small>{hint}</small>}</label>}
export function Select({label,value,onChange,options,hint}:any){return <label className="field">{label}<select value={value} onChange={e=>onChange(e.target.value)}>{options.map(([v,l]:any)=><option key={v} value={v}>{l}</option>)}</select>{hint&&<small>{hint}</small>}</label>}
export function TextArea({label,value,onChange,...props}:any){return <label className="field">{label}<textarea {...props} rows={3} value={value??''} onChange={e=>onChange(e.target.value)}/></label>}
